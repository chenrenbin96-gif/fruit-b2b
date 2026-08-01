import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

import type { AuthPrincipal } from '../auth/types/auth-principal';
import { OrderEntity, OrderItemEntity } from '../orders/entities/order.entities';
import { AdminAfterSaleListQueryDto, AfterSaleListQueryDto, ApproveAfterSaleDto, CreateAfterSaleDto, ReasonDto, UpdateAfterSaleDto } from './dto/after-sale.dto';
import { AfterSaleItemEntity, AfterSaleMediaEntity, AfterSaleOrderEntity, AfterSaleReasonEntity, AfterSaleRefundEntity } from './entities/after-sale.entities';

@Injectable()
export class AfterSalesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(AfterSaleOrderEntity) private readonly orders: Repository<AfterSaleOrderEntity>,
    @InjectRepository(AfterSaleReasonEntity) private readonly reasons: Repository<AfterSaleReasonEntity>,
  ) {}

  async activeReasons(tenantId: string) {
    const rows = await this.reasons.find({ where: { tenantId, status: 'ACTIVE' }, order: { sort: 'ASC', id: 'ASC' } });
    return rows.map((row) => this.reasonView(row));
  }

  async create(principal: AuthPrincipal, dto: CreateAfterSaleDto) {
    const customerId = principal.customerId;
    if (!customerId) throw new ForbiddenException({ code: 'CUSTOMER_REQUIRED', message: '仅采购客户可申请售后' });
    const imageCount = dto.media.filter((item) => item.media_type === 'IMAGE').length;
    const videoCount = dto.media.filter((item) => item.media_type === 'VIDEO').length;
    if (imageCount > 6 || videoCount > 3) throw new BadRequestException({ code: 'AFTER_SALE_MEDIA_LIMIT', message: '售后凭证最多6张图片和3个视频' });

    const id = await this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(OrderEntity).findOne({ where: { id: dto.order_id, tenantId: principal.tenantId, customerId }, relations: { items: true }, lock: { mode: 'pessimistic_read' } });
      if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: '订单不存在' });
      if (order.status !== 'COMPLETED') throw new ConflictException({ code: 'ORDER_NOT_AFTER_SALE_ELIGIBLE', message: '仅已完成订单可申请售后' });
      const reason = await manager.getRepository(AfterSaleReasonEntity).findOneBy({ id: dto.reason_id, tenantId: principal.tenantId, status: 'ACTIVE' });
      if (!reason) throw new BadRequestException({ code: 'AFTER_SALE_REASON_INVALID', message: '售后原因不可用' });
      const requestedIds = dto.items.map((item) => item.order_item_id);
      if (new Set(requestedIds).size !== requestedIds.length) throw new BadRequestException({ code: 'AFTER_SALE_ITEM_DUPLICATED', message: '售后商品不能重复' });
      const orderItems = new Map(order.items.map((item) => [item.id, item]));
      const prior = await manager.getRepository(AfterSaleItemEntity).createQueryBuilder('item')
        .innerJoin(AfterSaleOrderEntity, 'sale', 'sale.id = item.after_sale_id')
        .select('item.order_item_id', 'order_item_id')
        .addSelect('COALESCE(SUM(item.quantity), 0)', 'quantity')
        .addSelect('COALESCE(SUM(item.requested_weight), 0)', 'weight')
        .where('sale.tenant_id = :tenantId', { tenantId: principal.tenantId })
        .andWhere('sale.status NOT IN (:...excluded)', { excluded: ['REJECTED', 'CANCELLED'] })
        .andWhere('item.order_item_id IN (:...ids)', { ids: requestedIds })
        .groupBy('item.order_item_id').getRawMany<{ order_item_id: string; quantity: string; weight: string }>();
      const claimed = new Map(prior.map((row) => [String(row.order_item_id), row]));
      let estimatedRefund = 0;
      const itemValues = dto.items.map((request) => {
        const item = orderItems.get(request.order_item_id);
        if (!item) throw new BadRequestException({ code: 'ORDER_ITEM_INVALID', message: '售后商品不属于该订单' });
        const earlier = claimed.get(item.id);
        const price = this.refundPrice(item);
        if (item.saleType === 'PIECE') {
          if (request.requested_weight !== undefined || request.quantity === undefined || !Number.isInteger(request.quantity)) throw new BadRequestException({ code: 'PIECE_AFTER_SALE_QUANTITY_INVALID', message: '按件商品必须填写整数售后数量' });
          const purchased = Number(item.actualQuantity ?? item.plannedQuantity ?? 0);
          if (request.quantity + Number(earlier?.quantity ?? 0) > purchased) throw new BadRequestException({ code: 'AFTER_SALE_QUANTITY_EXCEEDED', message: '售后数量超过可申请数量' });
          const amount = this.money(request.quantity * price); estimatedRefund += amount;
          return { tenantId: principal.tenantId, orderItemId: item.id, skuId: item.skuId, quantity: this.decimal(request.quantity), approvedQuantity: null, saleType: item.saleType, requestedWeight: null, approvedWeight: null, refundPrice: this.price(price), refundAmount: this.moneyText(amount) };
        }
        if (request.quantity !== undefined || request.requested_weight === undefined) throw new BadRequestException({ code: 'WEIGHT_AFTER_SALE_WEIGHT_INVALID', message: '称重商品必须填写申请售后重量' });
        const purchased = Number(item.actualNetWeight ?? item.actualWeight ?? item.plannedWeight ?? 0);
        if (request.requested_weight + Number(earlier?.weight ?? 0) > purchased) throw new BadRequestException({ code: 'AFTER_SALE_WEIGHT_EXCEEDED', message: '售后重量超过可申请重量' });
        const amount = this.money(request.requested_weight * price); estimatedRefund += amount;
        return { tenantId: principal.tenantId, orderItemId: item.id, skuId: item.skuId, quantity: null, approvedQuantity: null, saleType: item.saleType, requestedWeight: this.decimal(request.requested_weight), approvedWeight: null, refundPrice: this.price(price), refundAmount: this.moneyText(amount) };
      });
      const saleRepo = manager.getRepository(AfterSaleOrderEntity);
      const sale = await saleRepo.save(saleRepo.create({ tenantId: principal.tenantId, orderId: order.id, customerId, afterSaleNo: this.number(), status: 'PENDING', reasonId: reason.id, description: dto.description?.trim() || null, refundAmount: this.moneyText(estimatedRefund), refundType: dto.refund_type, reviewRemark: null, reviewedBy: null, reviewedAt: null, completedAt: null }));
      await manager.getRepository(AfterSaleItemEntity).save(itemValues.map((value) => manager.getRepository(AfterSaleItemEntity).create({ ...value, afterSaleId: sale.id })));
      if (dto.media.length) await manager.getRepository(AfterSaleMediaEntity).save(dto.media.map((item, index) => manager.getRepository(AfterSaleMediaEntity).create({ tenantId: principal.tenantId, afterSaleId: sale.id, mediaType: item.media_type, url: item.url, thumbnailUrl: item.thumbnail_url ?? null, sort: item.sort ?? index })));
      return sale.id;
    });
    return this.customerDetail(principal, id);
  }

  customerList(principal: AuthPrincipal, query: AfterSaleListQueryDto) {
    if (!principal.customerId) throw new ForbiddenException();
    return this.list(principal.tenantId, query, principal.customerId);
  }
  async customerDetail(principal: AuthPrincipal, id: string) {
    if (!principal.customerId) throw new ForbiddenException();
    const sale = await this.findDetailed(principal.tenantId, id);
    if (sale.customerId !== principal.customerId) throw new NotFoundException({ code: 'AFTER_SALE_NOT_FOUND', message: '售后申请不存在' });
    return this.view(sale);
  }
  adminList(principal: AuthPrincipal, query: AdminAfterSaleListQueryDto) { return this.list(principal.tenantId, query, query.customer_id, query); }
  async adminDetail(principal: AuthPrincipal, id: string) { return this.view(await this.findDetailed(principal.tenantId, id)); }

  async approve(principal: AuthPrincipal, id: string, dto: ApproveAfterSaleDto) {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AfterSaleOrderEntity);
      const sale = await repo.findOne({ where: { id, tenantId: principal.tenantId }, relations: { items: true }, lock: { mode: 'pessimistic_write' } });
      if (!sale) throw new NotFoundException({ code: 'AFTER_SALE_NOT_FOUND', message: '售后申请不存在' });
      if (sale.status !== 'PENDING') throw new ConflictException({ code: 'AFTER_SALE_STATUS_INVALID', message: '当前状态不可审核' });
      await this.applyApproval(manager, sale, dto);
      if (dto.refund_amount !== undefined) sale.refundAmount = this.moneyText(dto.refund_amount);
      sale.status = 'APPROVED'; sale.reviewedBy = principal.userId; sale.reviewedAt = new Date(); sale.reviewRemark = dto.remark ?? null; sale.refundType = dto.refund_type ?? sale.refundType;
      await repo.save(sale);
      const refunds = manager.getRepository(AfterSaleRefundEntity);
      await refunds.save(refunds.create({ tenantId: sale.tenantId, afterSaleId: sale.id, amount: sale.refundAmount, status: 'PENDING', completedBy: null, completedAt: null }));
    });
    return this.adminDetail(principal, id);
  }
  async reject(principal: AuthPrincipal, id: string, reason: string) {
    const sale = await this.orders.findOneBy({ id, tenantId: principal.tenantId });
    if (!sale) throw new NotFoundException({ code: 'AFTER_SALE_NOT_FOUND', message: '售后申请不存在' });
    if (sale.status !== 'PENDING') throw new ConflictException({ code: 'AFTER_SALE_STATUS_INVALID', message: '当前状态不可驳回' });
    sale.status = 'REJECTED'; sale.reviewRemark = reason; sale.reviewedBy = principal.userId; sale.reviewedAt = new Date(); await this.orders.save(sale);
    return this.adminDetail(principal, id);
  }
  async update(principal: AuthPrincipal, id: string, dto: UpdateAfterSaleDto) {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(AfterSaleOrderEntity);
      const sale = await repo.findOne({ where: { id, tenantId: principal.tenantId }, relations: { items: true }, lock: { mode: 'pessimistic_write' } });
      if (!sale) throw new NotFoundException({ code: 'AFTER_SALE_NOT_FOUND', message: '售后申请不存在' });
      if (!['PENDING', 'APPROVED', 'PROCESSING'].includes(sale.status)) throw new ConflictException({ code: 'AFTER_SALE_STATUS_INVALID', message: '当前状态不可修改' });
      await this.applyApproval(manager, sale, dto); if (dto.refund_amount !== undefined) sale.refundAmount = this.moneyText(dto.refund_amount); sale.refundType = dto.refund_type ?? sale.refundType; sale.reviewRemark = dto.remark ?? sale.reviewRemark; await repo.save(sale);
      if (sale.status !== 'PENDING') await manager.getRepository(AfterSaleRefundEntity).update({ afterSaleId: sale.id }, { amount: sale.refundAmount });
    });
    return this.adminDetail(principal, id);
  }
  async complete(principal: AuthPrincipal, id: string) {
    await this.dataSource.transaction(async (manager) => {
      const saleRepo = manager.getRepository(AfterSaleOrderEntity);
      const sale = await saleRepo.findOne({ where: { id, tenantId: principal.tenantId }, lock: { mode: 'pessimistic_write' } });
      if (!sale) throw new NotFoundException({ code: 'AFTER_SALE_NOT_FOUND', message: '售后申请不存在' });
      if (!['APPROVED', 'PROCESSING'].includes(sale.status)) throw new ConflictException({ code: 'AFTER_SALE_STATUS_INVALID', message: '售后尚未审批，不能完成退款' });
      const refundRepo = manager.getRepository(AfterSaleRefundEntity); const refund = await refundRepo.findOneBy({ afterSaleId: sale.id });
      if (!refund) throw new ConflictException({ code: 'AFTER_SALE_REFUND_NOT_FOUND', message: '退款记录不存在' });
      refund.status = 'COMPLETED'; refund.completedBy = principal.userId; refund.completedAt = new Date(); await refundRepo.save(refund);
      sale.status = 'COMPLETED'; sale.completedAt = new Date(); await saleRepo.save(sale);
    });
    return this.adminDetail(principal, id);
  }

  async reasonList(principal: AuthPrincipal) { return (await this.reasons.find({ where: { tenantId: principal.tenantId }, order: { sort: 'ASC', id: 'ASC' } })).map((r) => this.reasonView(r)); }
  async createReason(principal: AuthPrincipal, dto: ReasonDto) { const row = await this.reasons.save(this.reasons.create({ tenantId: principal.tenantId, name: dto.name.trim(), sort: dto.sort, status: dto.status })); return this.reasonView(row); }
  async updateReason(principal: AuthPrincipal, id: string, dto: ReasonDto) { const row = await this.reasons.findOneBy({ id, tenantId: principal.tenantId }); if (!row) throw new NotFoundException({ code: 'AFTER_SALE_REASON_NOT_FOUND', message: '售后原因不存在' }); Object.assign(row, { name: dto.name.trim(), sort: dto.sort, status: dto.status }); return this.reasonView(await this.reasons.save(row)); }
  async deleteReason(principal: AuthPrincipal, id: string) { const row = await this.reasons.findOneBy({ id, tenantId: principal.tenantId }); if (!row) throw new NotFoundException({ code: 'AFTER_SALE_REASON_NOT_FOUND', message: '售后原因不存在' }); const count = await this.orders.countBy({ reasonId: id }); if (count) { row.status = 'INACTIVE'; await this.reasons.save(row); return { deleted: false, disabled: true }; } await this.reasons.remove(row); return { deleted: true, disabled: false }; }

  private async applyApproval(manager: import('typeorm').EntityManager, sale: AfterSaleOrderEntity, dto: ApproveAfterSaleDto) {
    const updates = new Map((dto.items ?? []).map((item) => [item.id, item])); let total = 0;
    for (const item of sale.items) {
      const update = updates.get(item.id);
      if (item.saleType === 'PIECE') { const value = update?.approved_quantity ?? Number(item.quantity ?? 0); if (!Number.isInteger(value) || value < 0 || value > Number(item.quantity ?? 0)) throw new BadRequestException({ code: 'APPROVED_QUANTITY_INVALID', message: '核准数量无效' }); item.approvedQuantity = this.decimal(value); item.refundAmount = this.moneyText(value * Number(item.refundPrice)); }
      else { const value = update?.approved_weight ?? Number(item.requestedWeight ?? 0); if (value < 0 || value > Number(item.requestedWeight ?? 0)) throw new BadRequestException({ code: 'APPROVED_WEIGHT_INVALID', message: '核准重量无效' }); item.approvedWeight = this.decimal(value); item.refundAmount = this.moneyText(value * Number(item.refundPrice)); }
      total += Number(item.refundAmount);
    }
    if ([...updates.keys()].some((key) => !sale.items.some((item) => item.id === key))) throw new BadRequestException({ code: 'AFTER_SALE_ITEM_INVALID', message: '核准明细无效' });
    sale.refundAmount = this.moneyText(total); await manager.getRepository(AfterSaleItemEntity).save(sale.items);
  }
  private async list(tenantId: string, query: AfterSaleListQueryDto, customerId?: string, admin?: AdminAfterSaleListQueryDto) {
    const qb = this.orders.createQueryBuilder('sale').leftJoinAndSelect('sale.reason', 'reason').leftJoinAndSelect('sale.customer', 'customer').leftJoinAndSelect('sale.order', 'order').where('sale.tenant_id = :tenantId', { tenantId });
    if (customerId) qb.andWhere('sale.customer_id = :customerId', { customerId }); if (query.status) qb.andWhere('sale.status = :status', { status: query.status });
    if (admin?.reason_id) qb.andWhere('sale.reason_id = :reasonId', { reasonId: admin.reason_id });
    if (admin?.keyword) qb.andWhere('(sale.after_sale_no LIKE :keyword OR order.order_no LIKE :keyword OR customer.customer_name LIKE :keyword)', { keyword: `%${admin.keyword}%` });
    if (admin?.start_date) qb.andWhere('sale.created_at >= :start', { start: `${admin.start_date} 00:00:00` }); if (admin?.end_date) qb.andWhere('sale.created_at <= :end', { end: `${admin.end_date} 23:59:59` });
    const [rows, total] = await qb.orderBy('sale.createdAt', 'DESC').skip((query.page - 1) * query.page_size).take(query.page_size).getManyAndCount();
    return { items: rows.map((row) => this.summary(row)), pagination: { page: query.page, page_size: query.page_size, total } };
  }
  private async findDetailed(tenantId: string, id: string) { const row = await this.orders.findOne({ where: { id, tenantId }, relations: { reason: true, customer: true, order: true, items: { orderItem: true }, media: true, refund: true }, order: { media: { sort: 'ASC' } } }); if (!row) throw new NotFoundException({ code: 'AFTER_SALE_NOT_FOUND', message: '售后申请不存在' }); return row; }
  private summary(row: AfterSaleOrderEntity) { return { id: row.id, after_sale_no: row.afterSaleNo, order_id: row.orderId, order_no: row.order?.orderNo, customer_id: row.customerId, customer_name: row.customer?.customerName, status: row.status, reason: row.reason ? this.reasonView(row.reason) : null, refund_type: row.refundType, refund_amount: row.refundAmount, created_at: row.createdAt, updated_at: row.updatedAt }; }
  private view(row: AfterSaleOrderEntity) { return { ...this.summary(row), description: row.description, review_remark: row.reviewRemark, reviewed_at: row.reviewedAt, completed_at: row.completedAt, items: (row.items ?? []).map((i) => ({ id: i.id, order_item_id: i.orderItemId, sku_id: i.skuId, product_name: i.orderItem?.productName, sku_name: i.orderItem?.skuName, sale_type: i.saleType, quantity: i.quantity, approved_quantity: i.approvedQuantity, requested_weight: i.requestedWeight, approved_weight: i.approvedWeight, unit: i.saleType === 'PIECE' ? i.orderItem?.pieceUnit : i.orderItem?.weightUnit, purchased_quantity: i.orderItem?.actualQuantity ?? i.orderItem?.plannedQuantity, purchased_weight: i.orderItem?.actualNetWeight ?? i.orderItem?.actualWeight ?? i.orderItem?.plannedWeight, refund_price: i.refundPrice, refund_amount: i.refundAmount })), media: (row.media ?? []).map((m) => ({ id: m.id, media_type: m.mediaType, url: m.url, thumbnail_url: m.thumbnailUrl, sort: m.sort })), refund: row.refund ? { id: row.refund.id, amount: row.refund.amount, status: row.refund.status, completed_at: row.refund.completedAt } : null }; }
  private reasonView(row: AfterSaleReasonEntity) { return { id: row.id, name: row.name, sort: row.sort, status: row.status }; }
  private refundPrice(item: OrderItemEntity) { return Number(item.saleType === 'WEIGHT' ? (item.netWeightUnitPrice ?? item.grossWeightUnitPrice ?? item.finalUnitPrice ?? item.unitPrice) : (item.finalUnitPrice ?? item.unitPrice)); }
  private number() { const d = new Date(); return `AS${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}${Date.now().toString().slice(-8)}${Math.floor(Math.random()*100).toString().padStart(2,'0')}`; }
  private decimal(value: number) { return value.toFixed(3); } private price(value: number) { return value.toFixed(4); } private money(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; } private moneyText(value: number) { return this.money(value).toFixed(2); }
}
