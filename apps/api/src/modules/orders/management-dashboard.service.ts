import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { DataSource } from 'typeorm';

import { REDIS_CLIENT } from '../../infrastructure/redis/redis.constants';

@Injectable()
export class ManagementDashboardService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  async summary(tenantId: string) {
    const cacheKey = `dashboard:business:${tenantId}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as Record<string, unknown>;
    } catch {
      // Dashboard falls back to database when Redis is unavailable.
    }

    const [
      salesRows,
      statusRows,
      warningRows,
      debtRows,
      debtSummaryRows,
      profitRows,
      inventoryValueRows,
      customerRows,
    ] =
      await Promise.all([
        this.dataSource.query(
          `SELECT
             SUM(created_at >= CURRENT_DATE()) AS today_orders,
             SUM(
               status = 'COMPLETED' AND created_at >= CURRENT_DATE()
             ) AS today_completed_orders,
             SUM(
               CASE WHEN status = 'COMPLETED'
                 AND created_at >= CURRENT_DATE()
               THEN final_amount ELSE 0 END
             ) AS today_sales,
             SUM(
               CASE WHEN status = 'COMPLETED'
                 AND created_at >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
               THEN final_amount ELSE 0 END
             ) AS month_sales,
             AVG(
               CASE WHEN status = 'COMPLETED' THEN final_amount END
             ) AS average_order_amount
           FROM orders
           WHERE tenant_id = ?`,
          [tenantId],
        ),
        this.dataSource.query(
          `SELECT status, COUNT(*) AS count
           FROM orders
           WHERE tenant_id = ?
           GROUP BY status`,
          [tenantId],
        ),
        this.dataSource.query(
          `SELECT
             i.id, i.sku_id, p.name AS product_name, s.sku_name,
             i.available_quantity, s.stock_warning, i.stock_unit
             , COUNT(*) OVER() AS warning_count
           FROM inventory i
           JOIN skus s ON s.id = i.sku_id
             AND s.tenant_id = i.tenant_id
           JOIN products p ON p.id = s.product_id
             AND p.tenant_id = i.tenant_id
           WHERE i.tenant_id = ?
             AND i.available_quantity <= s.stock_warning
             AND s.status = 'ACTIVE'
             AND s.deleted_at IS NULL
             AND p.deleted_at IS NULL
           ORDER BY (i.available_quantity - s.stock_warning) ASC, i.id ASC
           LIMIT 10`,
          [tenantId],
        ),
        this.dataSource.query(
          `SELECT
             id, customer_no, customer_name, balance_due,
             credit_limit, credit_days
           FROM customers
           WHERE tenant_id = ? AND status = 'ACTIVE' AND balance_due > 0
           ORDER BY balance_due DESC, id ASC
           LIMIT 10`,
          [tenantId],
        ),
        this.dataSource.query(
          `SELECT
             COUNT(CASE WHEN balance_due > 0 THEN 1 END) AS debt_customers,
             COALESCE(SUM(balance_due), 0) AS total_debt
           FROM customers
           WHERE tenant_id = ? AND status = 'ACTIVE'`,
          [tenantId],
        ),
        this.dataSource.query(
          `SELECT
             COALESCE(SUM(COALESCE(oi.final_amount, oi.estimated_amount)), 0)
               AS product_sales,
             COALESCE(SUM(
               COALESCE(
                 oi.actual_quantity, oi.actual_weight,
                 oi.planned_quantity, oi.planned_weight, 0
               ) * s.cost_price
             ), 0) AS product_cost
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
             AND oi.tenant_id = o.tenant_id
           JOIN skus s ON s.id = oi.sku_id AND s.tenant_id = o.tenant_id
           WHERE o.tenant_id = ? AND o.status = 'COMPLETED'
             AND o.created_at >= CURRENT_DATE()`,
          [tenantId],
        ),
        this.dataSource.query(
          `SELECT
             COALESCE(SUM(i.stock_quantity * i.cost_price), 0) AS stock_value,
             SUM(i.available_quantity <= 0) AS out_of_stock_count,
             SUM(
               i.available_quantity > 0
               AND i.available_quantity <= s.stock_warning
             ) AS low_stock_count
           FROM inventory i
           JOIN skus s ON s.id = i.sku_id AND s.tenant_id = i.tenant_id
           WHERE i.tenant_id = ?`,
          [tenantId],
        ),
        this.dataSource.query(
          `SELECT
             SUM(created_at >= CURRENT_DATE()) AS new_customers,
             (
               SELECT COUNT(DISTINCT customer_id)
               FROM orders
               WHERE tenant_id = ?
                 AND status <> 'CANCELLED'
                 AND created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
             ) AS active_customers
           FROM customers WHERE tenant_id = ?`,
          [tenantId, tenantId],
        ),
      ]);

    const sales = salesRows[0] ?? {};
    const debtSummary = debtSummaryRows[0] ?? {};
    const profit = profitRows[0] ?? {};
    const inventoryValue = inventoryValueRows[0] ?? {};
    const customers = customerRows[0] ?? {};
    const productSales = Number(profit.product_sales ?? 0);
    const productCost = Number(profit.product_cost ?? 0);
    const result = {
      sales: {
        today_orders: Number(sales.today_orders ?? 0),
        today_completed_orders: Number(sales.today_completed_orders ?? 0),
        today_sales: this.amount(sales.today_sales),
        month_sales: this.amount(sales.month_sales),
        average_order_amount: this.amount(sales.average_order_amount),
        today_gross_profit: this.amount(productSales - productCost),
        today_gross_margin_rate: this.amount(
          productSales > 0
            ? ((productSales - productCost) / productSales) * 100
            : 0,
        ),
      },
      order_status: Object.fromEntries(
        statusRows.map((row: { status: string; count: string | number }) => [
          row.status,
          Number(row.count),
        ]),
      ),
      inventory: {
        warning_count: Number(warningRows[0]?.warning_count ?? 0),
        stock_value: this.amount(inventoryValue.stock_value),
        low_stock_count: Number(inventoryValue.low_stock_count ?? 0),
        out_of_stock_count: Number(inventoryValue.out_of_stock_count ?? 0),
        warnings: warningRows.map((row: Record<string, unknown>) => ({
          ...row,
          available_quantity: String(row.available_quantity),
          stock_warning: String(row.stock_warning),
        })),
      },
      receivables: {
        total_debt: this.amount(debtSummary.total_debt),
        debt_customers: Number(debtSummary.debt_customers ?? 0),
        customers: debtRows.map((row: Record<string, unknown>) => ({
          ...row,
          balance_due: this.amount(row.balance_due),
          credit_limit: this.amount(row.credit_limit),
        })),
      },
      customers: {
        new_customers: Number(customers.new_customers ?? 0),
        active_customers: Number(customers.active_customers ?? 0),
      },
      generated_at: new Date().toISOString(),
    };
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        this.config.get<number>('DASHBOARD_CACHE_TTL_SECONDS', 15),
      );
    } catch {
      // Caching is best effort.
    }
    return result;
  }

  private amount(value: unknown): string {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
  }
}
