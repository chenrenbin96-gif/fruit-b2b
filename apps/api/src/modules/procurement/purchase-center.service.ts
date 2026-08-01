import { randomInt } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { AuthPrincipal } from '../auth/types/auth-principal';
import {
  InventoryEntity,
  InventoryLogEntity,
} from '../inventory/entities/inventory.entities';
import { SkuEntity } from '../products/entities/product.entities';
import {
  CreatePurchaseReturnDto,
  SaveSupplierProductDto,
  UpdatePurchaseReturnDto,
} from './dto/procurement.dto';
import {
  PurchaseOrderEntity,
  PurchaseOrderItemEntity,
  PurchasePlanEntity,
  PurchaseReturnEntity,
  PurchaseReturnItemEntity,
  SupplierEntity,
  SupplierProductEntity,
} from './entities/procurement.entities';

@Injectable()
export class PurchaseCenterService {
  constructor(private readonly dataSource: DataSource) {}

  async supplierProducts(tenantId: string, supplierId: string) {
    return this.dataSource.query(
      `SELECT sp.id, sp.supplier_id, sp.product_id, sp.sku_id, sp.purchase_price,
         sp.last_purchase_time, sp.status, p.name AS product_name, s.sku_name, s.sku_code
       FROM supplier_products sp
       JOIN products p ON p.id = sp.product_id
       JOIN skus s ON s.id = sp.sku_id
       WHERE sp.tenant_id = ? AND sp.supplier_id = ?
       ORDER BY p.name, s.id`,
      [tenantId, supplierId],
    );
  }

  async saveSupplierProduct(
    tenantId: string,
    supplierId: string,
    dto: SaveSupplierProductDto,
  ) {
    const supplier = await this.dataSource.manager.findOneBy(SupplierEntity, {
      id: supplierId,
      tenantId,
    });
    const sku = await this.dataSource.manager.findOneBy(SkuEntity, {
      id: dto.sku_id,
      tenantId,
    });
    if (!supplier || !sku) throw new NotFoundException('供应商或SKU不存在');
    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(SupplierProductEntity)
      .values({
        tenantId,
        supplierId,
        productId: sku.productId,
        skuId: sku.id,
        purchasePrice: dto.purchase_price.toFixed(4),
        status: 'ACTIVE',
      })
      .orUpdate(['purchase_price', 'status'], ['tenant_id', 'supplier_id', 'sku_id'])
      .execute();
    return this.supplierProducts(tenantId, supplierId);
  }

  async prices(tenantId: string) {
    return this.dataSource.query(
      `SELECT h.sku_id, MAX(p.name) AS product_name, MAX(s.sku_name) AS sku_name,
         MAX(s.sku_code) AS sku_code, MAX(s.stock_unit) AS unit,
         MAX(CASE WHEN h.purchase_date = latest.latest_date THEN h.price END) AS latest_price,
         MIN(h.price) AS lowest_price, MAX(h.price) AS highest_price,
         SUM(h.price * h.quantity) / NULLIF(SUM(h.quantity), 0) AS average_price,
         MAX(h.purchase_date) AS updated_at
       FROM purchase_price_history h
       JOIN skus s ON s.id = h.sku_id
       JOIN products p ON p.id = s.product_id
       JOIN (
         SELECT tenant_id, sku_id, MAX(purchase_date) AS latest_date
         FROM purchase_price_history GROUP BY tenant_id, sku_id
       ) latest ON latest.tenant_id = h.tenant_id AND latest.sku_id = h.sku_id
       WHERE h.tenant_id = ? GROUP BY h.sku_id ORDER BY updated_at DESC`,
      [tenantId],
    );
  }

  history(tenantId: string, skuId?: string) {
    return this.dataSource.query(
      `SELECT h.id, h.purchase_date, h.purchase_order_id, po.purchase_no,
         h.supplier_id, sup.supplier_name, h.sku_id, p.name AS product_name,
         s.sku_name, h.quantity, h.price, h.quantity * h.price AS amount
       FROM purchase_price_history h
       JOIN purchase_orders po ON po.id = h.purchase_order_id
       JOIN suppliers sup ON sup.id = h.supplier_id
       JOIN skus s ON s.id = h.sku_id JOIN products p ON p.id = s.product_id
       WHERE h.tenant_id = ? ${skuId ? 'AND h.sku_id = ?' : ''}
       ORDER BY h.purchase_date DESC LIMIT 1000`,
      skuId ? [tenantId, skuId] : [tenantId],
    );
  }

  returns(tenantId: string) {
    return this.dataSource.getRepository(PurchaseReturnEntity).find({
      where: { tenantId },
      relations: { items: true },
      order: { id: 'DESC' },
    });
  }

  async createReturn(principal: AuthPrincipal, dto: CreatePurchaseReturnDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOneBy(PurchaseOrderEntity, {
        id: dto.purchase_order_id,
        tenantId: principal.tenantId,
      });
      if (!order || !['RECEIVED', 'COMPLETED', 'STOCKED'].includes(order.status)) {
        throw new BadRequestException('仅已收货采购单可申请退货');
      }
      const sourceItems = await manager.findBy(PurchaseOrderItemEntity, {
        tenantId: principal.tenantId,
        purchaseOrderId: order.id,
      });
      const sourceMap = new Map(sourceItems.map((item) => [item.id, item]));
      let amount = 0;
      for (const input of dto.items) {
        const item = sourceMap.get(input.purchase_order_item_id);
        if (!item || input.return_quantity > Number(item.receivedQuantity)) {
          throw new BadRequestException('退货数量超过该采购单已收数量');
        }
        if (item.saleType === 'PIECE' && !Number.isInteger(input.return_quantity)) {
          throw new BadRequestException('按件商品退货数量必须为整数');
        }
        amount += input.return_quantity * Number(item.purchasePrice);
      }
      const row = await manager.save(PurchaseReturnEntity, {
        tenantId: principal.tenantId,
        returnNo: this.generateNo('RT'),
        purchaseOrderId: order.id,
        supplierId: order.supplierId,
        warehouseId: order.warehouseId,
        status: 'PENDING_REVIEW',
        reason: dto.reason.trim(),
        remark: dto.remark?.trim() || null,
        amount: amount.toFixed(2),
        createdBy: principal.userId ?? '',
      });
      for (const input of dto.items) {
        const item = sourceMap.get(input.purchase_order_item_id)!;
        await manager.save(PurchaseReturnItemEntity, {
          tenantId: principal.tenantId,
          purchaseReturnId: row.id,
          purchaseOrderItemId: item.id,
          skuId: item.skuId,
          returnQuantity: input.return_quantity.toFixed(3),
          purchasePrice: item.purchasePrice,
          amount: (input.return_quantity * Number(item.purchasePrice)).toFixed(2),
        });
      }
      return row;
    });
  }

  async updateReturn(
    principal: AuthPrincipal,
    id: string,
    dto: UpdatePurchaseReturnDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const row = await manager
        .getRepository(PurchaseReturnEntity)
        .createQueryBuilder('row')
        .setLock('pessimistic_write')
        .where('row.id = :id AND row.tenant_id = :tenantId', {
          id,
          tenantId: principal.tenantId,
        })
        .getOne();
      if (!row) throw new NotFoundException('采购退货单不存在');
      if (dto.status === 'APPROVED') {
        if (row.status !== 'PENDING_REVIEW') throw new BadRequestException('当前状态不可审核');
        row.status = 'APPROVED';
        row.reviewedBy = principal.userId;
        row.reviewedAt = new Date();
      } else if (dto.status === 'CANCELLED') {
        if (row.status === 'COMPLETED') throw new BadRequestException('已完成退货不可取消');
        row.status = 'CANCELLED';
      } else {
        if (row.status !== 'APPROVED') throw new BadRequestException('退货单必须先审核');
        const items = await manager.findBy(PurchaseReturnItemEntity, {
          tenantId: principal.tenantId,
          purchaseReturnId: row.id,
        });
        for (const item of items) {
          const inventory = await manager
            .getRepository(InventoryEntity)
            .createQueryBuilder('inventory')
            .setLock('pessimistic_write')
            .where(
              'inventory.tenant_id = :tenantId AND inventory.warehouse_id = :warehouseId AND inventory.sku_id = :skuId',
              { tenantId: principal.tenantId, warehouseId: row.warehouseId, skuId: item.skuId },
            )
            .getOne();
          if (!inventory || Number(inventory.availableQuantity) < Number(item.returnQuantity)) {
            throw new BadRequestException('可售库存不足，无法完成采购退货');
          }
          const before = Number(inventory.stockQuantity);
          const after = before - Number(item.returnQuantity);
          const beforeCost = Number(inventory.costPrice);
          const afterCost = after > 0
            ? Math.max(0, (before * beforeCost - Number(item.returnQuantity) * Number(item.purchasePrice)) / after)
            : 0;
          inventory.stockQuantity = after.toFixed(3);
          inventory.costPrice = afterCost.toFixed(4);
          inventory.version += 1;
          await manager.save(inventory);
          await manager.update(SkuEntity, { id: item.skuId }, { costPrice: afterCost.toFixed(4) });
          await manager.save(InventoryLogEntity, {
            tenantId: principal.tenantId,
            inventoryId: inventory.id,
            warehouseId: row.warehouseId,
            skuId: item.skuId,
            operationType: 'PURCHASE_RETURN',
            changeQuantity: (-Number(item.returnQuantity)).toFixed(3),
            lockedChangeQuantity: '0.000',
            beforeQuantity: before.toFixed(3),
            afterQuantity: after.toFixed(3),
            beforeLockedQuantity: inventory.lockedQuantity,
            afterLockedQuantity: inventory.lockedQuantity,
            stockUnit: inventory.stockUnit,
            reason: `采购退货${row.returnNo}`,
            referenceType: 'PURCHASE_RETURN',
            referenceId: row.id,
            operatorType: 'EMPLOYEE',
            operatorId: principal.userId,
          });
        }
        row.status = 'COMPLETED';
        row.completedAt = new Date();
      }
      return manager.save(row);
    });
  }

  plans(tenantId: string) {
    return this.dataSource.query(
      `SELECT pp.*, p.name AS product_name, s.sku_name, s.sku_code, s.stock_unit
       FROM purchase_plans pp JOIN skus s ON s.id = pp.sku_id
       JOIN products p ON p.id = s.product_id
       WHERE pp.tenant_id = ? ORDER BY pp.id DESC`,
      [tenantId],
    );
  }

  async generatePlans(tenantId: string) {
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(PurchasePlanEntity, { tenantId, status: 'PENDING' });
      await manager.query(
        `INSERT INTO purchase_plans
          (tenant_id, sku_id, supplier_id, current_stock, safe_stock,
           thirty_day_sales, supply_cycle_days, suggest_quantity, status)
         SELECT s.tenant_id, s.id, MAX(sp.supplier_id),
           COALESCE(MAX(inv.available_quantity), 0), s.stock_warning,
           COALESCE(MAX(sales.qty), 0), 7,
           GREATEST(
             s.stock_warning,
             COALESCE(MAX(sales.qty), 0) / 30 * 12
           ) - COALESCE(MAX(inv.available_quantity), 0),
           'PENDING'
         FROM skus s
         LEFT JOIN inventory inv ON inv.tenant_id = s.tenant_id AND inv.sku_id = s.id
         LEFT JOIN supplier_products sp ON sp.tenant_id = s.tenant_id
           AND sp.sku_id = s.id AND sp.status = 'ACTIVE'
         LEFT JOIN (
           SELECT oi.tenant_id, oi.sku_id,
             SUM(COALESCE(oi.actual_quantity, oi.actual_weight, oi.planned_quantity, oi.planned_weight, 0)) qty
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE o.status = 'COMPLETED' AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
           GROUP BY oi.tenant_id, oi.sku_id
         ) sales ON sales.tenant_id = s.tenant_id AND sales.sku_id = s.id
         WHERE s.tenant_id = ? AND s.status = 'ACTIVE' AND s.deleted_at IS NULL
         GROUP BY s.tenant_id, s.id, s.stock_warning
         HAVING GREATEST(
           s.stock_warning,
           COALESCE(MAX(sales.qty), 0) / 30 * 12
         ) - COALESCE(MAX(inv.available_quantity), 0) > 0`,
        [tenantId],
      );
    });
    return this.plans(tenantId);
  }

  async analysis(tenantId: string, period: 'day' | 'week' | 'month' = 'month') {
    const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;
    const [summary, suppliers, trend] = await Promise.all([
      this.dataSource.query(
        `SELECT COALESCE(SUM(h.price*h.quantity),0) purchase_amount,
          COALESCE(SUM(h.quantity),0) purchase_quantity,
          COUNT(DISTINCT h.purchase_order_id) purchase_orders,
          COUNT(DISTINCT h.supplier_id) supplier_count
         FROM purchase_price_history h WHERE h.tenant_id = ?
           AND h.purchase_date >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [tenantId, days],
      ),
      this.dataSource.query(
        `SELECT s.supplier_name, SUM(h.price*h.quantity) amount
         FROM purchase_price_history h JOIN suppliers s ON s.id=h.supplier_id
         WHERE h.tenant_id=? AND h.purchase_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY h.supplier_id,s.supplier_name ORDER BY amount DESC LIMIT 10`,
        [tenantId, days],
      ),
      this.dataSource.query(
        `SELECT DATE(h.purchase_date) date, SUM(h.price*h.quantity) amount,
          SUM(h.quantity) quantity
         FROM purchase_price_history h WHERE h.tenant_id=?
           AND h.purchase_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY DATE(h.purchase_date) ORDER BY date`,
        [tenantId, days],
      ),
    ]);
    return { period, summary: summary[0], supplier_ranking: suppliers, cost_trend: trend };
  }

  purchasers(tenantId: string) {
    return this.dataSource.query(
      `SELECT u.id, u.username, u.name, u.phone, u.status
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.tenant_id = ? AND r.role_code = 'PURCHASER'
       ORDER BY u.name`,
      [tenantId],
    );
  }

  private generateNo(prefix: string) {
    const now = new Date();
    return `${prefix}${now.toISOString().slice(0, 10).replaceAll('-', '')}${String(now.getTime()).slice(-6)}${randomInt(0, 1000).toString().padStart(3, '0')}`;
  }
}
