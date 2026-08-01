import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SupplyChainAnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  async costs(tenantId: string) {
    const rows = await this.dataSource.query(
      `SELECT
         s.id AS sku_id, p.name AS product_name, s.sku_name,
         s.stock_unit, s.cost_price, s.base_price,
         (s.base_price - s.cost_price) AS gross_profit_amount,
         CASE WHEN s.base_price > 0
           THEN (s.base_price - s.cost_price) / s.base_price * 100
           ELSE 0 END AS gross_margin_rate,
         COALESCE(SUM(i.stock_quantity), 0) AS stock_quantity,
         COALESCE(SUM(i.stock_quantity * i.cost_price), 0) AS stock_value
       FROM skus s
       JOIN products p ON p.id = s.product_id AND p.tenant_id = s.tenant_id
       LEFT JOIN inventory i ON i.sku_id = s.id AND i.tenant_id = s.tenant_id
       WHERE s.tenant_id = ? AND s.deleted_at IS NULL
         AND p.deleted_at IS NULL
       GROUP BY s.id, p.name, s.sku_name, s.stock_unit,
         s.cost_price, s.base_price
       ORDER BY p.name, s.id`,
      [tenantId],
    );
    return rows.map((row: Record<string, unknown>) => ({
      ...row,
      cost_price: this.amount(row.cost_price, 4),
      base_price: this.amount(row.base_price, 4),
      gross_profit_amount: this.amount(row.gross_profit_amount, 4),
      gross_margin_rate: this.amount(row.gross_margin_rate),
      stock_quantity: this.amount(row.stock_quantity, 3),
      stock_value: this.amount(row.stock_value),
    }));
  }

  async profitAnalysis(tenantId: string) {
    const [summaryRows, productRows] = await Promise.all([
      this.dataSource.query(
        `SELECT
           COALESCE(SUM(COALESCE(oi.final_amount, oi.estimated_amount)), 0)
             AS sales_amount,
           COALESCE(SUM(
             COALESCE(
               oi.actual_quantity, oi.actual_weight,
               oi.planned_quantity, oi.planned_weight, 0
             ) * s.cost_price
           ), 0) AS cost_amount
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id AND oi.tenant_id = o.tenant_id
         JOIN skus s ON s.id = oi.sku_id AND s.tenant_id = o.tenant_id
         WHERE o.tenant_id = ? AND o.status = 'COMPLETED'
           AND o.created_at >= CURRENT_DATE()`,
        [tenantId],
      ),
      this.dataSource.query(
        `SELECT
           oi.sku_id, MAX(oi.product_name) AS product_name,
           MAX(oi.sku_name) AS sku_name, MAX(oi.stock_unit) AS stock_unit,
           COUNT(DISTINCT o.id) AS order_count,
           COALESCE(SUM(COALESCE(
             oi.actual_quantity, oi.actual_weight,
             oi.planned_quantity, oi.planned_weight, 0
           )), 0) AS sold_quantity,
           COALESCE(SUM(COALESCE(oi.final_amount, oi.estimated_amount)), 0)
             AS sales_amount,
           COALESCE(SUM(
             COALESCE(
               oi.actual_quantity, oi.actual_weight,
               oi.planned_quantity, oi.planned_weight, 0
             ) * s.cost_price
           ), 0) AS cost_amount
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id AND oi.tenant_id = o.tenant_id
         JOIN skus s ON s.id = oi.sku_id AND s.tenant_id = o.tenant_id
         WHERE o.tenant_id = ? AND o.status = 'COMPLETED'
           AND o.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
         GROUP BY oi.sku_id
         ORDER BY sales_amount DESC`,
        [tenantId],
      ),
    ]);
    const summary = summaryRows[0] ?? {};
    const sales = Number(summary.sales_amount ?? 0);
    const cost = Number(summary.cost_amount ?? 0);
    const products: Array<Record<string, unknown> & {
      sold_quantity: string;
      gross_profit: string;
    }> = productRows.map((row: Record<string, unknown>) => {
      const rowSales = Number(row.sales_amount ?? 0);
      const rowCost = Number(row.cost_amount ?? 0);
      const grossProfit = rowSales - rowCost;
      return {
        ...row,
        order_count: Number(row.order_count ?? 0),
        sold_quantity: this.amount(row.sold_quantity, 3),
        sales_amount: this.amount(rowSales),
        cost_amount: this.amount(rowCost),
        gross_profit: this.amount(grossProfit),
        gross_margin_rate: this.amount(
          rowSales > 0 ? (grossProfit / rowSales) * 100 : 0,
        ),
      };
    });
    return {
      today: {
        sales_amount: this.amount(sales),
        cost_amount: this.amount(cost),
        gross_profit: this.amount(sales - cost),
        gross_margin_rate: this.amount(
          sales > 0 ? ((sales - cost) / sales) * 100 : 0,
        ),
      },
      hot_products: [...products]
        .sort((a, b) => Number(b.sold_quantity) - Number(a.sold_quantity))
        .slice(0, 10),
      profit_products: [...products]
        .sort((a, b) => Number(b.gross_profit) - Number(a.gross_profit))
        .slice(0, 10),
      loss_warnings: products.filter((item) => Number(item.gross_profit) < 0),
      cost_basis: 'CURRENT_WEIGHTED_AVERAGE',
    };
  }

  async inventoryAlerts(tenantId: string) {
    const rows = await this.dataSource.query(
      `SELECT
         s.id AS sku_id, p.name AS product_name, s.sku_name,
         s.stock_unit, s.stock_warning,
         COALESCE(SUM(i.stock_quantity), 0) AS stock_quantity,
         COALESCE(SUM(i.available_quantity), 0) AS available_quantity,
         MAX(sales.last_sale_at) AS last_sale_at
       FROM skus s
       JOIN products p ON p.id = s.product_id AND p.tenant_id = s.tenant_id
       LEFT JOIN inventory i ON i.sku_id = s.id AND i.tenant_id = s.tenant_id
       LEFT JOIN (
         SELECT oi.tenant_id, oi.sku_id, MAX(o.created_at) AS last_sale_at
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id
         WHERE o.status = 'COMPLETED'
         GROUP BY oi.tenant_id, oi.sku_id
       ) sales ON sales.tenant_id = s.tenant_id AND sales.sku_id = s.id
       WHERE s.tenant_id = ? AND s.status = 'ACTIVE'
         AND s.deleted_at IS NULL AND p.deleted_at IS NULL
       GROUP BY s.id, p.name, s.sku_name, s.stock_unit, s.stock_warning
       ORDER BY available_quantity ASC, s.id`,
      [tenantId],
    );
    const normalized: Array<Record<string, unknown> & {
      stock_warning: string;
      stock_quantity: string;
      available_quantity: string;
    }> = rows.map((row: Record<string, unknown>) => ({
      ...row,
      stock_warning: this.amount(row.stock_warning, 3),
      stock_quantity: this.amount(row.stock_quantity, 3),
      available_quantity: this.amount(row.available_quantity, 3),
    }));
    return {
      low_stock: normalized.filter(
        (item) =>
          Number(item.available_quantity) > 0 &&
          Number(item.available_quantity) <= Number(item.stock_warning),
      ),
      out_of_stock: normalized.filter(
        (item) => Number(item.available_quantity) <= 0,
      ),
      slow_moving: normalized.filter(
        (item) =>
          Number(item.stock_quantity) > 0 &&
          (!item.last_sale_at ||
            Date.now() - new Date(String(item.last_sale_at)).getTime() >
              30 * 86400_000),
      ),
      slow_moving_days: 30,
    };
  }

  async purchaseSuggestions(tenantId: string) {
    const rows = await this.dataSource.query(
      `SELECT
         s.id AS sku_id, p.name AS product_name, s.sku_name,
         s.stock_unit, s.stock_warning,
         COALESCE(inv.available_quantity, 0) AS available_quantity,
         COALESCE(sales.sold_quantity / 30, 0) AS average_daily_sales,
         COALESCE(lead_time.average_lead_days, 7) AS purchase_lead_days
       FROM skus s
       JOIN products p ON p.id = s.product_id AND p.tenant_id = s.tenant_id
       LEFT JOIN (
         SELECT tenant_id, sku_id, SUM(available_quantity) AS available_quantity
         FROM inventory GROUP BY tenant_id, sku_id
       ) inv ON inv.tenant_id = s.tenant_id AND inv.sku_id = s.id
       LEFT JOIN (
         SELECT oi.tenant_id, oi.sku_id,
           SUM(COALESCE(
             oi.actual_quantity, oi.actual_weight,
             oi.planned_quantity, oi.planned_weight, 0
           )) AS sold_quantity
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id AND o.tenant_id = oi.tenant_id
         WHERE o.status = 'COMPLETED'
           AND o.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
         GROUP BY oi.tenant_id, oi.sku_id
       ) sales ON sales.tenant_id = s.tenant_id AND sales.sku_id = s.id
       LEFT JOIN (
         SELECT poi.tenant_id, poi.sku_id,
           AVG(GREATEST(DATEDIFF(po.arrived_at, po.purchase_date), 1))
             AS average_lead_days
         FROM purchase_order_items poi
         JOIN purchase_orders po ON po.id = poi.purchase_order_id
           AND po.tenant_id = poi.tenant_id
         WHERE po.status = 'STOCKED' AND po.arrived_at IS NOT NULL
           AND po.purchase_date IS NOT NULL
         GROUP BY poi.tenant_id, poi.sku_id
       ) lead_time ON lead_time.tenant_id = s.tenant_id
         AND lead_time.sku_id = s.id
       WHERE s.tenant_id = ? AND s.status = 'ACTIVE'
         AND s.deleted_at IS NULL AND p.deleted_at IS NULL`,
      [tenantId],
    );
    const suggestions: Array<Record<string, unknown> & {
      suggested_quantity: string;
    }> = rows
      .map((row: Record<string, unknown>) => {
        const dailySales = Number(row.average_daily_sales ?? 0);
        const leadDays = Math.max(1, Math.ceil(Number(row.purchase_lead_days)));
        const available = Number(row.available_quantity ?? 0);
        const warning = Number(row.stock_warning ?? 0);
        const target = Math.max(warning, dailySales * (leadDays + 5));
        const suggested = Math.max(0, target - available);
        return {
          ...row,
          available_quantity: this.amount(available, 3),
          stock_warning: this.amount(warning, 3),
          average_daily_sales: this.amount(dailySales, 3),
          purchase_lead_days: leadDays,
          suggested_quantity: this.amount(
            row.stock_unit &&
              ['箱', '件', '盒', '袋', '个'].includes(String(row.stock_unit))
              ? Math.ceil(suggested)
              : suggested,
            3,
          ),
        };
      });
    return suggestions
      .filter((row) => Number(row.suggested_quantity) > 0)
      .sort(
        (a, b) => Number(b.suggested_quantity) - Number(a.suggested_quantity),
      );
  }

  private amount(value: unknown, scale = 2): string {
    const numeric = Number(value ?? 0);
    return (Number.isFinite(numeric) ? numeric : 0).toFixed(scale);
  }
}
