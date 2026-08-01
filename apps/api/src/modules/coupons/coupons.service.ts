import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  Not,
  Repository,
} from 'typeorm';

import {
  CustomerEntity,
  CustomerLevelEntity,
} from '../customers/entities/customer.entities';
import { OrderEntity } from '../orders/entities/order.entities';
import { centsToAmount } from '../orders/money';
import { CategoryEntity, ProductEntity } from '../products/entities/product.entities';
import { SaveCouponDto } from './dto/coupon.dto';
import {
  CouponCategoryEntity,
  CouponCustomerLevelEntity,
  CouponEntity,
  CouponProductEntity,
  CouponRecordEntity,
  CustomerCouponEntity,
} from './entities/coupon.entities';

export type CouponAmountItem = {
  productId: string;
  categoryId: string;
  amount: string;
};

@Injectable()
export class CouponsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CouponEntity)
    private readonly coupons: Repository<CouponEntity>,
    @InjectRepository(CustomerCouponEntity)
    private readonly customerCoupons: Repository<CustomerCouponEntity>,
  ) {}

  async adminList(
    tenantId: string,
    query: { status?: string; page: number; page_size: number },
  ) {
    const [items, total] = await this.coupons.findAndCount({
      where: {
        tenantId,
        ...(query.status ? { status: query.status as CouponEntity['status'] } : {}),
      },
      relations: { products: true, categories: true, levels: true },
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    });
    return {
      items: items.map((item) => this.view(item)),
      pagination: {
        page: query.page,
        page_size: query.page_size,
        total,
        total_pages: Math.ceil(total / query.page_size),
      },
    };
  }

  async create(tenantId: string, userId: string, dto: SaveCouponDto) {
    const id = await this.dataSource.transaction(async (manager) => {
      this.validateTargets(dto);
      await this.validateReferences(manager, tenantId, dto);
      const coupon = await manager.getRepository(CouponEntity).save({
        tenantId,
        name: dto.name.trim(),
        couponType: dto.coupon_type,
        discountAmount: dto.discount_amount.toFixed(2),
        minAmount: dto.min_amount.toFixed(2),
        totalLimit: dto.total_limit ?? null,
        perCustomerLimit: dto.per_customer_limit ?? 1,
        startTime: new Date(dto.start_time),
        endTime: new Date(dto.end_time),
        status: dto.status ?? 'DRAFT',
        createdBy: userId,
      });
      await this.replaceTargets(manager, tenantId, coupon.id, dto);
      return coupon.id;
    });
    return this.detail(tenantId, id);
  }

  async update(tenantId: string, id: string, dto: SaveCouponDto) {
    await this.dataSource.transaction(async (manager) => {
      this.validateTargets(dto);
      await this.validateReferences(manager, tenantId, dto);
      const coupon = await manager.getRepository(CouponEntity).findOneBy({
        id,
        tenantId,
      });
      if (!coupon) throw this.notFound();
      Object.assign(coupon, {
        name: dto.name.trim(),
        couponType: dto.coupon_type,
        discountAmount: dto.discount_amount.toFixed(2),
        minAmount: dto.min_amount.toFixed(2),
        totalLimit: dto.total_limit ?? null,
        perCustomerLimit: dto.per_customer_limit ?? 1,
        startTime: new Date(dto.start_time),
        endTime: new Date(dto.end_time),
        status: dto.status ?? coupon.status,
      });
      await manager.getRepository(CouponEntity).save(coupon);
      await this.replaceTargets(manager, tenantId, id, dto);
    });
    return this.detail(tenantId, id);
  }

  async disable(tenantId: string, id: string) {
    const coupon = await this.coupons.findOneBy({ id, tenantId });
    if (!coupon) throw this.notFound();
    coupon.status = 'DISABLED';
    await this.coupons.save(coupon);
    return this.detail(tenantId, id);
  }

  async issue(tenantId: string, couponId: string, customerIds: string[]) {
    const uniqueIds = [...new Set(customerIds)];
    const issued = await this.dataSource.transaction(async (manager) => {
      const coupon = await manager
        .getRepository(CouponEntity)
        .createQueryBuilder('coupon')
        .setLock('pessimistic_write')
        .where('coupon.id = :couponId', { couponId })
        .andWhere('coupon.tenant_id = :tenantId', { tenantId })
        .getOne();
      if (!coupon || coupon.status === 'DISABLED') throw this.notFound();
      const customers = await manager.getRepository(CustomerEntity).findBy({
        tenantId,
        id: In(uniqueIds),
        status: 'ACTIVE',
      });
      if (customers.length !== uniqueIds.length) {
        throw new BadRequestException({
          code: 'COUPON_CUSTOMER_INVALID',
          message: '存在无效客户',
        });
      }
      let count = 0;
      for (const customerId of uniqueIds) {
        const owned = await manager.getRepository(CustomerCouponEntity).countBy({
          tenantId,
          customerId,
          couponId,
          status: Not('INVALID'),
        });
        if (owned >= coupon.perCustomerLimit) continue;
        if (
          coupon.totalLimit !== null &&
          coupon.issuedCount >= coupon.totalLimit
        ) {
          throw new BadRequestException({
            code: 'COUPON_ISSUE_LIMIT_REACHED',
            message: '优惠券发放总量已达到上限',
          });
        }
        await manager.getRepository(CustomerCouponEntity).save({
          tenantId,
          customerId,
          couponId,
          status: 'AVAILABLE',
          receiveTime: new Date(),
        });
        coupon.issuedCount += 1;
        count += 1;
      }
      await manager.getRepository(CouponEntity).save(coupon);
      return count;
    });
    return { issued };
  }

  async customerList(tenantId: string, customerId: string) {
    const items = await this.customerCoupons.find({
      where: { tenantId, customerId },
      relations: { coupon: true },
      order: { id: 'DESC' },
    });
    return items.map((item) => this.customerCouponView(item));
  }

  async issuedCustomers(tenantId: string, couponId: string) {
    const items = await this.customerCoupons.find({
      where: { tenantId, couponId },
      relations: { customer: true },
      order: { id: 'DESC' },
    });
    return items.map((item) => ({
      id: item.id,
      customer_id: item.customerId,
      customer_name: item.customer.customerName,
      status: item.status,
      receive_time: item.receiveTime,
      use_time: item.useTime,
    }));
  }

  async usageRecords(tenantId: string, couponId: string) {
    const records = await this.dataSource.getRepository(CouponRecordEntity).find({
      where: { tenantId, couponId },
      order: { id: 'DESC' },
    });
    return records.map((record) => ({
      id: record.id,
      customer_id: record.customerId,
      order_id: record.orderId,
      status: record.status,
      eligible_amount: record.eligibleAmount,
      discount_amount: record.discountAmount,
      reason: record.reason,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    }));
  }

  async claimable(tenantId: string, customerId: string) {
    const customer = await this.dataSource.getRepository(CustomerEntity).findOneBy({
      id: customerId,
      tenantId,
    });
    if (!customer) return [];
    const now = new Date();
    const coupons = await this.coupons
      .createQueryBuilder('coupon')
      .leftJoinAndSelect('coupon.levels', 'levels')
      .where('coupon.tenant_id = :tenantId', { tenantId })
      .andWhere("coupon.status = 'ACTIVE'")
      .andWhere('coupon.start_time <= :now AND coupon.end_time >= :now', { now })
      .andWhere("coupon.coupon_type <> 'CUSTOMER_EXCLUSIVE'")
      .getMany();
    const result = [];
    for (const coupon of coupons) {
      if (
        coupon.levels.length > 0 &&
        !coupon.levels.some((level) => level.levelId === customer.levelId)
      ) {
        continue;
      }
      const owned = await this.customerCoupons.countBy({
        tenantId,
        customerId,
        couponId: coupon.id,
        status: Not('INVALID'),
      });
      if (owned < coupon.perCustomerLimit) result.push(this.view(coupon));
    }
    return result;
  }

  async claim(tenantId: string, customerId: string, couponId: string) {
    const coupon = await this.coupons.findOneBy({ id: couponId, tenantId });
    const now = Date.now();
    if (
      !coupon ||
      coupon.status !== 'ACTIVE' ||
      coupon.couponType === 'CUSTOMER_EXCLUSIVE' ||
      coupon.startTime.getTime() > now ||
      coupon.endTime.getTime() < now
    ) {
      throw new BadRequestException({
        code: 'COUPON_NOT_CLAIMABLE',
        message: '该优惠券当前不可领取',
      });
    }
    await this.issue(tenantId, couponId, [customerId]);
    const item = await this.customerCoupons.findOne({
      where: { tenantId, customerId, couponId },
      relations: { coupon: true },
      order: { id: 'DESC' },
    });
    if (!item) {
      throw new BadRequestException({
        code: 'COUPON_CLAIM_LIMIT_REACHED',
        message: '该优惠券已领取或达到领取上限',
      });
    }
    return this.customerCouponView(item);
  }

  async lockForOrder(input: {
    manager: EntityManager;
    tenantId: string;
    customerId: string;
    customerCouponId: string;
    orderId: string;
    isFirstOrder: boolean;
    items: CouponAmountItem[];
  }): Promise<{ couponId: string; discountAmount: string }> {
    const customerCoupon = await input.manager
      .getRepository(CustomerCouponEntity)
      .createQueryBuilder('owned')
      .leftJoinAndSelect('owned.coupon', 'coupon')
      .leftJoinAndSelect('coupon.products', 'products')
      .leftJoinAndSelect('coupon.categories', 'categories')
      .leftJoinAndSelect('coupon.levels', 'levels')
      .setLock('pessimistic_write')
      .where('owned.id = :id', { id: input.customerCouponId })
      .andWhere('owned.tenant_id = :tenantId', { tenantId: input.tenantId })
      .andWhere('owned.customer_id = :customerId', {
        customerId: input.customerId,
      })
      .getOne();
    if (!customerCoupon || customerCoupon.status !== 'AVAILABLE') {
      throw new BadRequestException({
        code: 'CUSTOMER_COUPON_NOT_AVAILABLE',
        message: '优惠券不存在、已使用或已被其他订单占用',
      });
    }
    const customer = await input.manager.getRepository(CustomerEntity).findOneByOrFail({
      id: input.customerId,
      tenantId: input.tenantId,
    });
    const result = this.evaluate(
      customerCoupon.coupon,
      customer.levelId,
      input.isFirstOrder,
      input.items,
    );
    if (!result.valid) {
      throw new BadRequestException({
        code: 'COUPON_CONDITION_NOT_MET',
        message: result.reason,
      });
    }
    customerCoupon.status = 'LOCKED';
    customerCoupon.lockedOrderId = input.orderId;
    customerCoupon.lockedAt = new Date();
    await input.manager.getRepository(CustomerCouponEntity).save(customerCoupon);
    await input.manager.getRepository(CouponRecordEntity).save({
      tenantId: input.tenantId,
      couponId: customerCoupon.couponId,
      customerCouponId: customerCoupon.id,
      customerId: input.customerId,
      orderId: input.orderId,
      status: 'LOCKED',
      eligibleAmount: result.eligibleAmount,
      discountAmount: result.discountAmount,
      reason: '订单提交预占优惠券',
    });
    return {
      couponId: customerCoupon.couponId,
      discountAmount: result.discountAmount,
    };
  }

  async finalizeForOrder(input: {
    manager: EntityManager;
    order: OrderEntity;
    items: CouponAmountItem[];
    isFirstOrder: boolean;
  }): Promise<string> {
    if (!input.order.customerCouponId) return '0.00';
    const record = await input.manager
      .getRepository(CouponRecordEntity)
      .createQueryBuilder('record')
      .setLock('pessimistic_write')
      .where('record.order_id = :orderId', { orderId: input.order.id })
      .getOne();
    const owned = await input.manager
      .getRepository(CustomerCouponEntity)
      .createQueryBuilder('owned')
      .leftJoinAndSelect('owned.coupon', 'coupon')
      .leftJoinAndSelect('coupon.products', 'products')
      .leftJoinAndSelect('coupon.categories', 'categories')
      .leftJoinAndSelect('coupon.levels', 'levels')
      .setLock('pessimistic_write')
      .where('owned.id = :id', { id: input.order.customerCouponId })
      .getOne();
    if (!record || !owned || owned.status !== 'LOCKED') {
      throw new BadRequestException({
        code: 'COUPON_LOCK_INCONSISTENT',
        message: '订单优惠券锁定数据异常',
      });
    }
    const customer = await input.manager.getRepository(CustomerEntity).findOneByOrFail({
      id: input.order.customerId,
      tenantId: input.order.tenantId,
    });
    const result = this.evaluate(
      owned.coupon,
      customer.levelId,
      input.isFirstOrder,
      input.items,
    );
    if (!result.valid) {
      owned.status = 'AVAILABLE';
      owned.lockedOrderId = null;
      owned.lockedAt = null;
      record.status = 'INVALIDATED';
      record.eligibleAmount = result.eligibleAmount;
      record.discountAmount = '0.00';
      record.reason = result.reason;
      await input.manager.getRepository(CustomerCouponEntity).save(owned);
      await input.manager.getRepository(CouponRecordEntity).save(record);
      return '0.00';
    }
    owned.status = 'USED';
    owned.lockedOrderId = null;
    owned.useTime = new Date();
    record.status = 'USED';
    record.eligibleAmount = result.eligibleAmount;
    record.discountAmount = result.discountAmount;
    record.reason = '履约金额复核通过';
    const coupon = await input.manager
      .getRepository(CouponEntity)
      .createQueryBuilder('coupon')
      .setLock('pessimistic_write')
      .where('coupon.id = :id', { id: owned.couponId })
      .getOneOrFail();
    coupon.usedCount += 1;
    await input.manager.getRepository(CustomerCouponEntity).save(owned);
    await input.manager.getRepository(CouponRecordEntity).save(record);
    await input.manager.getRepository(CouponEntity).save(coupon);
    return result.discountAmount;
  }

  async releaseForOrder(manager: EntityManager, orderId: string): Promise<void> {
    const record = await manager.getRepository(CouponRecordEntity).findOneBy({
      orderId,
      status: 'LOCKED',
    });
    if (!record) return;
    const owned = await manager.getRepository(CustomerCouponEntity).findOneBy({
      id: record.customerCouponId,
      lockedOrderId: orderId,
      status: 'LOCKED',
    });
    if (owned) {
      owned.status = 'AVAILABLE';
      owned.lockedOrderId = null;
      owned.lockedAt = null;
      await manager.getRepository(CustomerCouponEntity).save(owned);
    }
    record.status = 'RELEASED';
    record.reason = '订单取消释放优惠券';
    await manager.getRepository(CouponRecordEntity).save(record);
  }

  private evaluate(
    coupon: CouponEntity,
    levelId: string,
    isFirstOrder: boolean,
    items: CouponAmountItem[],
  ): { valid: boolean; eligibleAmount: string; discountAmount: string; reason: string } {
    const now = Date.now();
    if (
      coupon.status !== 'ACTIVE' ||
      coupon.startTime.getTime() > now ||
      coupon.endTime.getTime() < now
    ) {
      return this.invalid('优惠券不在有效期内');
    }
    if (
      (coupon.levels ?? []).length > 0 &&
      !coupon.levels.some((item) => item.levelId === levelId)
    ) {
      return this.invalid('客户等级不符合优惠券条件');
    }
    if (coupon.couponType === 'NEW_CUSTOMER' && !isFirstOrder) {
      return this.invalid('该优惠券仅限首单使用');
    }
    let eligible = items;
    if (coupon.couponType === 'PRODUCT') {
      const ids = new Set((coupon.products ?? []).map((item) => item.productId));
      eligible = items.filter((item) => ids.has(item.productId));
    }
    if (coupon.couponType === 'CATEGORY') {
      const ids = new Set((coupon.categories ?? []).map((item) => item.categoryId));
      eligible = items.filter((item) => ids.has(item.categoryId));
    }
    const cents = eligible.reduce(
      (sum, item) => sum + BigInt(Math.round(Number(item.amount) * 100)),
      0n,
    );
    const eligibleAmount = centsToAmount(cents);
    if (
      cents === 0n &&
      (coupon.couponType === 'PRODUCT' || coupon.couponType === 'CATEGORY')
    ) {
      return {
        valid: false,
        eligibleAmount,
        discountAmount: '0.00',
        reason: '订单不包含优惠券适用范围内的商品',
      };
    }
    if (Number(eligibleAmount) < Number(coupon.minAmount)) {
      return {
        valid: false,
        eligibleAmount,
        discountAmount: '0.00',
        reason: `优惠范围金额未达到${coupon.minAmount}元`,
      };
    }
    return {
      valid: true,
      eligibleAmount,
      discountAmount: Math.min(
        Number(coupon.discountAmount),
        Number(eligibleAmount),
      ).toFixed(2),
      reason: '',
    };
  }

  private invalid(reason: string) {
    return {
      valid: false,
      eligibleAmount: '0.00',
      discountAmount: '0.00',
      reason,
    };
  }

  private async detail(tenantId: string, id: string) {
    const coupon = await this.coupons.findOne({
      where: { id, tenantId },
      relations: { products: true, categories: true, levels: true },
    });
    if (!coupon) throw this.notFound();
    return this.view(coupon);
  }

  private view(coupon: CouponEntity) {
    return {
      id: coupon.id,
      name: coupon.name,
      coupon_type: coupon.couponType,
      discount_amount: coupon.discountAmount,
      min_amount: coupon.minAmount,
      total_limit: coupon.totalLimit,
      issued_count: coupon.issuedCount,
      used_count: coupon.usedCount,
      per_customer_limit: coupon.perCustomerLimit,
      start_time: coupon.startTime,
      end_time: coupon.endTime,
      status: coupon.status,
      product_ids: (coupon.products ?? []).map((item) => item.productId),
      category_ids: (coupon.categories ?? []).map((item) => item.categoryId),
      level_ids: (coupon.levels ?? []).map((item) => item.levelId),
    };
  }

  private customerCouponView(item: CustomerCouponEntity) {
    return {
      id: item.id,
      status: item.status,
      receive_time: item.receiveTime,
      use_time: item.useTime,
      coupon: this.view(item.coupon),
    };
  }

  private validateTargets(dto: SaveCouponDto): void {
    if (new Date(dto.end_time) <= new Date(dto.start_time)) {
      throw new BadRequestException({
        code: 'COUPON_TIME_INVALID',
        message: '优惠券结束时间必须晚于开始时间',
      });
    }
    if (dto.coupon_type === 'PRODUCT' && !dto.product_ids?.length) {
      throw new BadRequestException({
        code: 'COUPON_TARGET_REQUIRED',
        message: '商品优惠券必须选择适用商品',
      });
    }
    if (dto.coupon_type === 'CATEGORY' && !dto.category_ids?.length) {
      throw new BadRequestException({
        code: 'COUPON_TARGET_REQUIRED',
        message: '品类优惠券必须选择适用品类',
      });
    }
  }

  private async validateReferences(
    manager: EntityManager,
    tenantId: string,
    dto: SaveCouponDto,
  ): Promise<void> {
    if (dto.product_ids?.length) {
      const count = await manager.getRepository(ProductEntity).countBy({
        tenantId,
        id: In([...new Set(dto.product_ids)]),
      });
      if (count !== new Set(dto.product_ids).size) {
        throw new BadRequestException({ code: 'COUPON_PRODUCT_INVALID', message: '存在无效商品' });
      }
    }
    if (dto.category_ids?.length) {
      const count = await manager.getRepository(CategoryEntity).countBy({
        tenantId,
        id: In([...new Set(dto.category_ids)]),
      });
      if (count !== new Set(dto.category_ids).size) {
        throw new BadRequestException({ code: 'COUPON_CATEGORY_INVALID', message: '存在无效分类' });
      }
    }
    if (dto.level_ids?.length) {
      const count = await manager.getRepository(CustomerLevelEntity).countBy({
        tenantId,
        id: In([...new Set(dto.level_ids)]),
      });
      if (count !== new Set(dto.level_ids).size) {
        throw new BadRequestException({
          code: 'COUPON_LEVEL_INVALID',
          message: '存在无效客户等级',
        });
      }
    }
  }

  private async replaceTargets(
    manager: EntityManager,
    tenantId: string,
    couponId: string,
    dto: SaveCouponDto,
  ) {
    await manager.getRepository(CouponProductEntity).delete({ couponId });
    await manager.getRepository(CouponCategoryEntity).delete({ couponId });
    await manager.getRepository(CouponCustomerLevelEntity).delete({ couponId });
    if (dto.product_ids?.length) {
      await manager.getRepository(CouponProductEntity).save(
        [...new Set(dto.product_ids)].map((productId) => ({ tenantId, couponId, productId })),
      );
    }
    if (dto.category_ids?.length) {
      await manager.getRepository(CouponCategoryEntity).save(
        [...new Set(dto.category_ids)].map((categoryId) => ({ tenantId, couponId, categoryId })),
      );
    }
    if (dto.level_ids?.length) {
      await manager.getRepository(CouponCustomerLevelEntity).save(
        [...new Set(dto.level_ids)].map((levelId) => ({ tenantId, couponId, levelId })),
      );
    }
  }

  private notFound() {
    return new NotFoundException({
      code: 'COUPON_NOT_FOUND',
      message: '优惠券不存在',
    });
  }
}
