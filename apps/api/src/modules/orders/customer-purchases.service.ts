import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { ProductsService } from '../products/products.service';

type PurchaseAggregate = {
  sku_id: string;
  product_id: string;
  purchase_count: string | number;
  total_purchase_quantity: string;
  last_purchase_time: Date | string;
};

type LatestPurchase = {
  sku_id: string;
  order_id: string;
  order_no: string;
  purchased_at: Date | string;
  last_quantity: string;
  last_unit_price: string;
};

@Injectable()
export class CustomerPurchasesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly products: ProductsService,
  ) {}

  async purchasedProducts(
    tenantId: string,
    customerId: string,
    frequent = false,
  ) {
    const rows = (await this.dataSource.query(
      `SELECT
         oi.sku_id,
         s.product_id,
         COUNT(DISTINCT o.id) AS purchase_count,
         SUM(COALESCE(oi.actual_quantity, oi.planned_quantity, 0))
           AS total_purchase_quantity,
         MAX(o.created_at) AS last_purchase_time
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN skus s ON s.id = oi.sku_id
       WHERE o.tenant_id = ? AND o.customer_id = ?
         AND o.status <> 'CANCELLED'
       GROUP BY oi.sku_id, s.product_id
       ORDER BY ${
         frequent
           ? 'purchase_count DESC, last_purchase_time DESC'
           : 'last_purchase_time DESC'
       }
       LIMIT ?`,
      [tenantId, customerId, frequent ? 12 : 50],
    )) as PurchaseAggregate[];
    if (rows.length === 0) return [];

    const latestRows = (await this.dataSource.query(
      `SELECT
         oi.sku_id, o.id AS order_id, o.order_no, o.created_at AS purchased_at,
         COALESCE(oi.actual_quantity, oi.planned_quantity, 0)
           AS last_quantity,
         COALESCE(oi.final_unit_price, oi.unit_price) AS last_unit_price
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.tenant_id = ? AND o.customer_id = ?
         AND o.status <> 'CANCELLED'
       ORDER BY o.created_at DESC, oi.id DESC`,
      [tenantId, customerId],
    )) as LatestPurchase[];
    const latest = new Map<string, LatestPurchase>();
    for (const item of latestRows) {
      if (!latest.has(String(item.sku_id))) {
        latest.set(String(item.sku_id), item);
      }
    }
    const products = new Map<string, Awaited<ReturnType<ProductsService['detail']>>>();
    for (const productId of [...new Set(rows.map((item) => String(item.product_id)))]) {
      try {
        products.set(
          productId,
          await this.products.detail(tenantId, productId, {
            catalogOnly: false,
            customerId,
          }),
        );
      } catch {
        // Historical rows remain queryable even when the product was removed.
      }
    }
    return rows.flatMap((row) => {
      const product = products.get(String(row.product_id));
      const sku = product?.skus.find((item) => item.id === String(row.sku_id));
      const history = latest.get(String(row.sku_id));
      if (!product || !sku || !history) return [];
      return [{
        sku_id: sku.id,
        product_id: product.id,
        product_name: product.name,
        main_image: product.main_image,
        category_id: product.category_id,
        category_name: product.category.name,
        sku_name: sku.sku_name,
        specification: sku.specification,
        sale_type: sku.sale_type,
        unit: sku.unit,
        price_unit: sku.price_unit,
        last_quantity: Number(history.last_quantity).toFixed(3),
        last_unit_price: Number(history.last_unit_price).toFixed(4),
        last_order_id: String(history.order_id),
        last_order_no: history.order_no,
        last_purchase_time: new Date(history.purchased_at).toISOString(),
        purchase_count: Number(row.purchase_count),
        total_purchase_quantity: Number(row.total_purchase_quantity).toFixed(3),
        current_price: sku.price.final_unit_price,
        current_price_source: sku.price.price_source,
        available_quantity: sku.inventory?.available_quantity ?? '0.000',
        stock_unit: sku.stock_unit,
        purchasable:
          sku.status === 'ACTIVE' &&
          product.status === 'ON_SALE' &&
          Number(sku.inventory?.available_quantity ?? 0) > 0,
      }];
    });
  }

  async summary(tenantId: string, customerId: string) {
    const [monthRows, frequent] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*) AS purchase_count,
           COALESCE(SUM(COALESCE(final_amount, estimated_amount)), 0) AS amount
         FROM orders
         WHERE tenant_id = ? AND customer_id = ?
           AND status <> 'CANCELLED'
           AND created_at >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')`,
        [tenantId, customerId],
      ) as Promise<Array<{ purchase_count: string; amount: string }>>,
      this.purchasedProducts(tenantId, customerId, true),
    ]);
    return {
      month: {
        purchase_amount: Number(monthRows[0]?.amount ?? 0).toFixed(2),
        purchase_count: Number(monthRows[0]?.purchase_count ?? 0),
      },
      most_purchased: frequent[0] ?? null,
    };
  }

  async adminAnalysis(tenantId: string) {
    const rows = (await this.dataSource.query(
      `SELECT
         c.id AS customer_id, c.customer_no, c.customer_name,
         COUNT(DISTINCT o.id) AS purchase_count,
         COALESCE(SUM(COALESCE(o.final_amount, o.estimated_amount)), 0)
           AS purchase_amount,
         MAX(o.created_at) AS last_purchase_time,
         (
           SELECT p2.name
           FROM orders o2
           JOIN order_items oi2 ON oi2.order_id = o2.id
           JOIN skus s2 ON s2.id = oi2.sku_id
           JOIN products p2 ON p2.id = s2.product_id
           WHERE o2.tenant_id = c.tenant_id
             AND o2.customer_id = c.id
             AND o2.status <> 'CANCELLED'
           GROUP BY p2.id, p2.name
           ORDER BY COUNT(DISTINCT o2.id) DESC, MAX(o2.created_at) DESC
           LIMIT 1
         ) AS frequent_product
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id
         AND o.tenant_id = c.tenant_id
         AND o.status <> 'CANCELLED'
       WHERE c.tenant_id = ? AND c.status = 'ACTIVE'
       GROUP BY c.id, c.customer_no, c.customer_name
       ORDER BY purchase_amount DESC, last_purchase_time DESC`,
      [tenantId],
    )) as Array<Record<string, unknown>>;
    return rows.map((item) => ({
      ...item,
      purchase_count: Number(item.purchase_count ?? 0),
      purchase_amount: Number(item.purchase_amount ?? 0).toFixed(2),
      last_purchase_time: item.last_purchase_time
        ? new Date(item.last_purchase_time as string).toISOString()
        : null,
    }));
  }
}
