import { randomInt } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import type { AuthPrincipal } from '../auth/types/auth-principal';
import {
  InventoryEntity,
  InventoryLogEntity,
} from '../inventory/entities/inventory.entities';
import { centsToAmount, multiplyPriceToCents } from '../orders/money';
import { SkuEntity } from '../products/entities/product.entities';
import { WarehouseEntity } from '../system/entities/system.entities';
import { UserEntity } from '../users/entities/user.entities';
import {
  PurchaseOrderListQueryDto,
  ReceivePurchaseOrderDto,
  SavePurchaseOrderDto,
} from './dto/procurement.dto';
import {
  PurchaseOrderEntity,
  PurchaseOrderItemEntity,
  PurchaseReceiptEntity,
  PurchaseReceiptItemEntity,
  PurchasePriceHistoryEntity,
  SupplierProductEntity,
  SupplierEntity,
} from './entities/procurement.entities';

@Injectable()
export class ProcurementService {
  constructor(private readonly dataSource: DataSource) {}

  async references(tenantId: string) {
    const manager = this.dataSource.manager;
    const [suppliers, warehouses, skus] = await Promise.all([
      manager.find(SupplierEntity, {
        where: { tenantId, status: 'ACTIVE' },
        order: { supplierName: 'ASC' },
      }),
      manager.find(WarehouseEntity, {
        where: { tenantId, status: 'ACTIVE' },
        order: { id: 'ASC' },
      }),
      manager.find(SkuEntity, {
        where: { tenantId, status: 'ACTIVE' },
        relations: { product: true },
        order: { id: 'DESC' },
      }),
    ]);
    return {
      suppliers: suppliers.map((item) => ({
        id: item.id,
        supplier_no: item.supplierNo,
        supplier_name: item.supplierName,
      })),
      warehouses: warehouses.map((item) => ({
        id: item.id,
        warehouse_name: item.warehouseName,
      })),
      skus: skus.map((item) => ({
        id: item.id,
        sku_code: item.skuCode,
        sku_name: item.skuName,
        product_name: item.product.name,
        sale_type: item.saleType,
        stock_unit: item.stockUnit,
        current_cost_price: item.costPrice,
      })),
    };
  }

  async list(tenantId: string, query: PurchaseOrderListQueryDto) {
    const builder = this.dataSource
      .getRepository(PurchaseOrderEntity)
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.supplier', 'supplier')
      .leftJoinAndSelect('purchase.warehouse', 'warehouse')
      .leftJoinAndSelect('purchase.items', 'items')
      .where('purchase.tenant_id = :tenantId', { tenantId });
    if (query.status) {
      builder.andWhere('purchase.status = :status', { status: query.status });
    }
    if (query.supplier_id) {
      builder.andWhere('purchase.supplier_id = :supplierId', {
        supplierId: query.supplier_id,
      });
    }
    if (query.purchase_type) {
      builder.andWhere('purchase.purchase_type = :purchaseType', {
        purchaseType: query.purchase_type,
      });
    }
    if (query.purchaser_id) {
      builder.andWhere('purchase.purchaser_id = :purchaserId', {
        purchaserId: query.purchaser_id,
      });
    }
    if (query.date_from) {
      builder.andWhere('purchase.purchase_date >= :dateFrom', { dateFrom: query.date_from });
    }
    if (query.date_to) {
      builder.andWhere('purchase.purchase_date <= :dateTo', { dateTo: query.date_to });
    }
    if (query.keyword) {
      builder.andWhere(
        `(purchase.purchase_no LIKE :keyword OR supplier.supplier_name LIKE :keyword
          OR EXISTS (
            SELECT 1 FROM purchase_order_items keyword_item
            JOIN skus keyword_sku ON keyword_sku.id = keyword_item.sku_id
            WHERE keyword_item.purchase_order_id = purchase.id
              AND (keyword_item.product_name LIKE :keyword OR keyword_sku.sku_code LIKE :keyword)
          ))`,
        { keyword: `%${query.keyword}%` },
      );
    }
    const rows = await builder.orderBy('purchase.id', 'DESC').getMany();
    return rows.map((row) => this.view(row, false));
  }

  async detail(tenantId: string, id: string) {
    const row = await this.dataSource.getRepository(PurchaseOrderEntity).findOne({
      where: { id, tenantId },
      relations: {
        supplier: true,
        warehouse: true,
        items: true,
        receipts: { items: true },
      },
    });
    if (!row) throw this.notFound();
    return this.view(row, true);
  }

  async create(principal: AuthPrincipal, dto: SavePurchaseOrderDto) {
    const id = await this.dataSource.transaction((manager) =>
      this.saveDraft(manager, principal, null, dto),
    );
    return this.detail(principal.tenantId, id);
  }

  async update(
    principal: AuthPrincipal,
    id: string,
    dto: SavePurchaseOrderDto,
  ) {
    await this.dataSource.transaction((manager) =>
      this.saveDraft(manager, principal, id, dto),
    );
    return this.detail(principal.tenantId, id);
  }

  async submit(principal: AuthPrincipal, id: string) {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, principal.tenantId, id);
      if (order.status !== 'PENDING_PURCHASE') {
        throw new BadRequestException({
          code: 'PURCHASE_ORDER_NOT_DRAFT',
          message: '只有待采购订单可以开始采购',
        });
      }
      const count = await manager.countBy(PurchaseOrderItemEntity, {
        purchaseOrderId: order.id,
      });
      if (count === 0) {
        throw new BadRequestException({
          code: 'PURCHASE_ORDER_EMPTY',
          message: '采购单没有商品明细',
        });
      }
      order.status = 'PURCHASING';
      order.purchaseDate ??= new Date().toISOString().slice(0, 10);
      order.submittedAt = new Date();
      await manager.save(order);
    });
    return this.detail(principal.tenantId, id);
  }

  async markArrived(principal: AuthPrincipal, id: string) {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, principal.tenantId, id);
      if (order.status !== 'PURCHASING') {
        throw new BadRequestException({
          code: 'PURCHASE_ORDER_NOT_PURCHASING',
          message: '只有采购中的订单可以确认到货',
        });
      }
      order.status = 'ARRIVED';
      order.arrivedAt = new Date();
      await manager.save(order);
    });
    return this.detail(principal.tenantId, id);
  }

  async cancel(principal: AuthPrincipal, id: string) {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, principal.tenantId, id);
      if (!['PENDING_PURCHASE', 'PURCHASING', 'ARRIVED'].includes(order.status)) {
        throw new BadRequestException({
          code: 'PURCHASE_ORDER_NOT_CANCELLABLE',
          message: '当前采购订单不能取消',
        });
      }
      order.status = 'CANCELLED';
      await manager.save(order);
    });
    return this.detail(principal.tenantId, id);
  }

  async receive(
    principal: AuthPrincipal,
    id: string,
    dto: ReceivePurchaseOrderDto,
  ) {
    const receiptId = await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, principal.tenantId, id);
      if (!['ARRIVED', 'PURCHASING', 'PARTIALLY_RECEIVED'].includes(order.status)) {
        throw new BadRequestException({
          code: 'PURCHASE_ORDER_NOT_RECEIVABLE',
          message: '当前采购单不能收货',
        });
      }
      await this.assertWarehouseScope(manager, principal, order.warehouseId);
      const items = await manager.find(PurchaseOrderItemEntity, {
        where: { tenantId: principal.tenantId, purchaseOrderId: order.id },
        relations: { sku: true },
        order: { id: 'ASC' },
      });
      const inputMap = new Map(
        dto.items.map((item) => [item.purchase_order_item_id, item]),
      );
      if (inputMap.size !== dto.items.length) {
        throw new BadRequestException({
          code: 'PURCHASE_RECEIPT_ITEMS_MISMATCH',
          message: '收货明细存在重复商品',
        });
      }

      let totalCents = 0n;
      for (const item of items) {
        const input = inputMap.get(item.id);
        if (!input) continue;
        if (item.saleType === 'WEIGHT') {
          if (!input.gross_weight || !input.net_weight || input.net_weight > input.gross_weight) {
            throw new BadRequestException({
              code: 'WEIGHT_RECEIPT_WEIGHT_REQUIRED',
              message: `${item.productName} ${item.skuName} 必须填写有效毛重和净重`,
            });
          }
          input.received_quantity = input.net_weight;
        }
        const remaining = Number(item.orderedQuantity) - Number(item.receivedQuantity);
        if (input.received_quantity > remaining + 0.0001) {
          throw new BadRequestException({
            code: 'PURCHASE_RECEIPT_EXCEEDS_REMAINING',
            message: `${item.productName} ${item.skuName} 本次收货超过未收数量`,
          });
        }
        if (
          item.saleType === 'PIECE' &&
          !Number.isInteger(input.received_quantity)
        ) {
          throw new BadRequestException({
            code: 'PIECE_RECEIPT_INTEGER_REQUIRED',
            message: `${item.productName} ${item.skuName} 的入库数量必须为整数`,
          });
        }
        totalCents += multiplyPriceToCents(
          item.purchasePrice,
          input.received_quantity.toFixed(3),
        );
      }

      const now = new Date();
      const receipt = await manager.save(PurchaseReceiptEntity, {
        tenantId: principal.tenantId,
        receiptNo: this.generateNo('PR'),
        purchaseOrderId: order.id,
        supplierId: order.supplierId,
        warehouseId: order.warehouseId,
        totalAmount: centsToAmount(totalCents),
        status: 'CONFIRMED',
        receivedBy: principal.userId ?? '',
        receivedAt: now,
        remark: dto.remark?.trim() || null,
      });

      for (const item of items) {
        const input = inputMap.get(item.id);
        if (!input) continue;
        await manager.query(
          `INSERT INTO inventory (
             tenant_id, warehouse_id, sku_id, stock_unit,
             stock_quantity, locked_quantity, cost_price, version
           ) VALUES (?, ?, ?, ?, 0, 0, ?, 0)
           ON DUPLICATE KEY UPDATE id = id`,
          [
            principal.tenantId,
            order.warehouseId,
            item.skuId,
            item.purchaseUnit,
            item.purchasePrice,
          ],
        );
        const inventory = await manager
          .getRepository(InventoryEntity)
          .createQueryBuilder('inventory')
          .setLock('pessimistic_write')
          .where('inventory.tenant_id = :tenantId', {
            tenantId: principal.tenantId,
          })
          .andWhere('inventory.warehouse_id = :warehouseId', {
            warehouseId: order.warehouseId,
          })
          .andWhere('inventory.sku_id = :skuId', { skuId: item.skuId })
          .getOneOrFail();
        const beforeQuantity = Number(inventory.stockQuantity);
        const receivedQuantity = input.received_quantity;
        const afterQuantity = beforeQuantity + receivedQuantity;
        const beforeCost = Number(inventory.costPrice);
        const afterCost =
          afterQuantity === 0
            ? Number(item.purchasePrice)
            : (beforeQuantity * beforeCost +
                receivedQuantity * Number(item.purchasePrice)) /
              afterQuantity;

        inventory.stockQuantity = afterQuantity.toFixed(3);
        inventory.costPrice = afterCost.toFixed(4);
        inventory.version += 1;
        await manager.save(inventory);
        item.sku.costPrice = afterCost.toFixed(4);
        await manager.save(item.sku);

        const amount = centsToAmount(
          multiplyPriceToCents(
            item.purchasePrice,
            receivedQuantity.toFixed(3),
          ),
        );
        await manager.save(PurchaseReceiptItemEntity, {
          tenantId: principal.tenantId,
          receiptId: receipt.id,
          purchaseOrderItemId: item.id,
          skuId: item.skuId,
          receivedQuantity: receivedQuantity.toFixed(3),
          grossWeight: input.gross_weight?.toFixed(3) ?? null,
          netWeight: input.net_weight?.toFixed(3) ?? null,
          purchaseUnit: item.purchaseUnit,
          purchasePrice: item.purchasePrice,
          amount,
          inventoryCostBefore: beforeCost.toFixed(4),
          inventoryCostAfter: afterCost.toFixed(4),
        });
        await manager.save(InventoryLogEntity, {
          tenantId: principal.tenantId,
          inventoryId: inventory.id,
          warehouseId: order.warehouseId,
          skuId: item.skuId,
          operationType: 'PURCHASE_IN',
          changeQuantity: receivedQuantity.toFixed(3),
          lockedChangeQuantity: '0.000',
          beforeQuantity: beforeQuantity.toFixed(3),
          afterQuantity: afterQuantity.toFixed(3),
          beforeLockedQuantity: inventory.lockedQuantity,
          afterLockedQuantity: inventory.lockedQuantity,
          stockUnit: item.purchaseUnit,
          reason: `采购单${order.purchaseNo}到货入库`,
          referenceType: 'PURCHASE_RECEIPT',
          referenceId: receipt.id,
          operatorType: 'EMPLOYEE',
          operatorId: principal.userId,
        });
        item.receivedQuantity = (
          Number(item.receivedQuantity) + receivedQuantity
        ).toFixed(3);
        await manager.save(item);
        await manager.save(PurchasePriceHistoryEntity, {
          tenantId: principal.tenantId,
          supplierId: order.supplierId,
          purchaseOrderId: order.id,
          skuId: item.skuId,
          price: item.purchasePrice,
          quantity: receivedQuantity.toFixed(3),
          purchaseDate: now,
        });
        if (order.updateLastPurchasePrice) {
          await manager
            .createQueryBuilder()
            .insert()
            .into(SupplierProductEntity)
            .values({
              tenantId: principal.tenantId,
              supplierId: order.supplierId,
              productId: item.sku.productId,
              skuId: item.skuId,
              purchasePrice: item.purchasePrice,
              lastPurchaseTime: now,
              status: 'ACTIVE',
            })
            .orUpdate(['purchase_price', 'last_purchase_time', 'status'], [
              'tenant_id',
              'supplier_id',
              'sku_id',
            ])
            .execute();
        }
      }

      const fullyReceived = items.every(
        (item) => Number(item.receivedQuantity) >= Number(item.orderedQuantity) - 0.0001,
      );
      order.receivedAmount = (
        Number(order.receivedAmount) + Number(centsToAmount(totalCents))
      ).toFixed(2);
      order.status = fullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
      order.receivedBy = principal.userId;
      order.receivedAt = now;
      await manager.save(order);
      return receipt.id;
    });
    return {
      order: await this.detail(principal.tenantId, id),
      receipt_id: receiptId,
    };
  }

  private async saveDraft(
    manager: EntityManager,
    principal: AuthPrincipal,
    id: string | null,
    dto: SavePurchaseOrderDto,
  ) {
    const supplier = await manager.findOneBy(SupplierEntity, {
      id: dto.supplier_id,
      tenantId: principal.tenantId,
      status: 'ACTIVE',
    });
    const warehouse = await manager.findOneBy(WarehouseEntity, {
      id: dto.warehouse_id,
      tenantId: principal.tenantId,
      status: 'ACTIVE',
    });
    if (!supplier || !warehouse) {
      throw new NotFoundException({
        code: 'PURCHASE_REFERENCE_NOT_FOUND',
        message: '供应商或仓库不存在或已停用',
      });
    }
    if (new Set(dto.items.map((item) => item.sku_id)).size !== dto.items.length) {
      throw new BadRequestException({
        code: 'PURCHASE_SKU_DUPLICATED',
        message: '同一采购单不能重复添加相同SKU',
      });
    }

    let order: PurchaseOrderEntity;
    if (id) {
      order = await this.lockOrder(manager, principal.tenantId, id);
      if (order.status !== 'PENDING_PURCHASE') {
        throw new BadRequestException({
          code: 'PURCHASE_ORDER_NOT_DRAFT',
          message: '只有待采购订单可以编辑',
        });
      }
      await manager.delete(PurchaseOrderItemEntity, {
        tenantId: principal.tenantId,
        purchaseOrderId: order.id,
      });
    } else {
      order = manager.create(PurchaseOrderEntity, {
        tenantId: principal.tenantId,
        purchaseNo: this.generateNo('PO'),
        status: 'PENDING_PURCHASE',
        totalAmount: '0.00',
        createdBy: principal.userId ?? '',
      });
    }
    order.supplierId = supplier.id;
    order.warehouseId = warehouse.id;
    order.purchaseType = dto.purchase_type ?? order.purchaseType ?? 'SUPPLIER';
    order.sourceType = dto.source_type ?? order.sourceType ?? 'MANUAL';
    order.responsiblePersonId = dto.responsible_person_id ?? principal.userId ?? null;
    order.purchaserId = dto.purchaser_id ?? principal.userId ?? null;
    order.purchaseDate = dto.purchase_date ?? order.purchaseDate ?? null;
    order.plannedDeliveryDate = dto.planned_delivery_date ?? null;
    order.sortMode = dto.sort_mode ?? 'ADDED';
    order.updateLastPurchasePrice = dto.update_last_purchase_price ?? true;
    order.remark = dto.remark?.trim() || null;
    order = await manager.save(order);

    let totalCents = 0n;
    for (const input of dto.items) {
      const sku = await manager.findOne(SkuEntity, {
        where: {
          id: input.sku_id,
          tenantId: principal.tenantId,
          status: 'ACTIVE',
        },
        relations: { product: true },
      });
      if (!sku) {
        throw new NotFoundException({
          code: 'PURCHASE_SKU_NOT_FOUND',
          message: `SKU ${input.sku_id} 不存在或已停用`,
        });
      }
      if (sku.saleType === 'PIECE' && !Number.isInteger(input.quantity)) {
        throw new BadRequestException({
          code: 'PIECE_PURCHASE_INTEGER_REQUIRED',
          message: `${sku.product.name} ${sku.skuName} 的采购数量必须为整数`,
        });
      }
      const amountCents = multiplyPriceToCents(
        input.purchase_price.toFixed(4),
        input.quantity.toFixed(3),
      );
      totalCents += amountCents;
      await manager.save(PurchaseOrderItemEntity, {
        tenantId: principal.tenantId,
        purchaseOrderId: order.id,
        skuId: sku.id,
        productName: sku.product.name,
        skuName: sku.skuName,
        saleType: sku.saleType,
        orderedQuantity: input.quantity.toFixed(3),
        receivedQuantity: '0.000',
        purchaseUnit: sku.stockUnit,
        purchasePrice: input.purchase_price.toFixed(4),
        amount: centsToAmount(amountCents),
      });
    }
    order.totalAmount = centsToAmount(totalCents);
    await manager.save(order);
    return order.id;
  }

  private async lockOrder(
    manager: EntityManager,
    tenantId: string,
    id: string,
  ) {
    const order = await manager
      .getRepository(PurchaseOrderEntity)
      .createQueryBuilder('purchase')
      .setLock('pessimistic_write')
      .where('purchase.id = :id', { id })
      .andWhere('purchase.tenant_id = :tenantId', { tenantId })
      .getOne();
    if (!order) throw this.notFound();
    return order;
  }

  private async assertWarehouseScope(
    manager: EntityManager,
    principal: AuthPrincipal,
    warehouseId: string,
  ) {
    if (principal.roleCode === 'ADMIN') return;
    const user = await manager.findOneBy(UserEntity, {
      id: principal.userId ?? '',
      tenantId: principal.tenantId,
      status: 'ACTIVE',
    });
    if (!user || user.warehouseId !== warehouseId) {
      throw new ForbiddenException({
        code: 'WAREHOUSE_SCOPE_FORBIDDEN',
        message: '不能为其他仓库确认采购入库',
      });
    }
  }

  private view(order: PurchaseOrderEntity, detailed: boolean) {
    return {
      id: order.id,
      purchase_no: order.purchaseNo,
      purchase_type: order.purchaseType,
      source_type: order.sourceType,
      supplier_id: order.supplierId,
      supplier_name: order.supplier?.supplierName,
      warehouse_id: order.warehouseId,
      warehouse_name: order.warehouse?.warehouseName,
      responsible_person_id: order.responsiblePersonId,
      purchaser_id: order.purchaserId,
      status: order.status,
      purchase_date: order.purchaseDate,
      planned_delivery_date: order.plannedDeliveryDate,
      sort_mode: order.sortMode,
      update_last_purchase_price: order.updateLastPurchasePrice,
      total_amount: order.totalAmount,
      received_amount: order.receivedAmount,
      progress: Number(order.totalAmount) > 0
        ? Math.min(100, Number(order.receivedAmount) / Number(order.totalAmount) * 100).toFixed(1)
        : '0.0',
      remark: order.remark,
      submitted_at: order.submittedAt,
      arrived_at: order.arrivedAt,
      received_at: order.receivedAt,
      created_at: order.createdAt,
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        sku_id: item.skuId,
        product_name: item.productName,
        sku_name: item.skuName,
        sale_type: item.saleType,
        ordered_quantity: item.orderedQuantity,
        received_quantity: item.receivedQuantity,
        purchase_unit: item.purchaseUnit,
        purchase_price: item.purchasePrice,
        amount: item.amount,
      })),
      ...(detailed
        ? {
            receipts: (order.receipts ?? []).map((receipt) => ({
              id: receipt.id,
              receipt_no: receipt.receiptNo,
              total_amount: receipt.totalAmount,
              received_at: receipt.receivedAt,
              remark: receipt.remark,
              items: (receipt.items ?? []).map((item) => ({
                id: item.id,
                sku_id: item.skuId,
                received_quantity: item.receivedQuantity,
                gross_weight: item.grossWeight,
                net_weight: item.netWeight,
                purchase_unit: item.purchaseUnit,
                purchase_price: item.purchasePrice,
                amount: item.amount,
                inventory_cost_before: item.inventoryCostBefore,
                inventory_cost_after: item.inventoryCostAfter,
              })),
            })),
          }
        : {}),
    };
  }

  private generateNo(prefix: 'PO' | 'PR') {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replaceAll('-', '');
    return `${prefix}${date}${String(now.getTime()).slice(-6)}${randomInt(
      0,
      1000,
    )
      .toString()
      .padStart(3, '0')}`;
  }

  private notFound() {
    return new NotFoundException({
      code: 'PURCHASE_ORDER_NOT_FOUND',
      message: '采购订单不存在',
    });
  }
}
