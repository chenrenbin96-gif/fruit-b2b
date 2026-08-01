import assert from 'node:assert/strict';

import { config } from 'dotenv';
import mysql from 'mysql2/promise';

config({ path: '../../.env', quiet: true });

const checks = [
  {
    name: 'inventory_formula_and_non_negative',
    sql: `SELECT COUNT(*) AS violations
          FROM inventory
          WHERE stock_quantity < 0 OR locked_quantity < 0
             OR available_quantity < 0
             OR ABS(available_quantity - (stock_quantity - locked_quantity)) > 0.0005`,
  },
  {
    name: 'active_order_inventory_locks',
    sql: `SELECT COUNT(*) AS violations
          FROM (
            SELECT i.id
            FROM inventory i
            LEFT JOIN (
              SELECT
                o.tenant_id, o.warehouse_id, oi.sku_id,
                SUM(
                  CASE WHEN oi.sale_type = 'PIECE'
                    THEN oi.planned_quantity ELSE oi.planned_weight END
                ) AS expected_locked
              FROM orders o
              JOIN order_items oi ON oi.order_id = o.id
              WHERE o.status IN (
                'WAITING_REVIEW', 'APPROVED', 'PICKING', 'WEIGHING'
              )
              GROUP BY o.tenant_id, o.warehouse_id, oi.sku_id
            ) active_orders
              ON active_orders.tenant_id = i.tenant_id
             AND active_orders.warehouse_id = i.warehouse_id
             AND active_orders.sku_id = i.sku_id
            WHERE ABS(
              i.locked_quantity - COALESCE(active_orders.expected_locked, 0)
            ) > 0.0005
          ) inconsistent`,
  },
  {
    name: 'estimated_order_product_amount',
    sql: `SELECT COUNT(*) AS violations
          FROM orders o
          JOIN (
            SELECT order_id, ROUND(SUM(estimated_amount), 2) AS item_amount
            FROM order_items GROUP BY order_id
          ) items ON items.order_id = o.id
          WHERE ABS(o.estimated_product_amount - items.item_amount) > 0.005`,
  },
  {
    name: 'final_order_amount',
    sql: `SELECT COUNT(*) AS violations
          FROM orders
          WHERE final_amount IS NOT NULL
            AND ABS(
              final_amount
              - GREATEST(final_product_amount + shipping_fee - discount_amount, 0)
            ) > 0.005`,
  },
  {
    name: 'final_order_item_amount',
    sql: `SELECT COUNT(*) AS violations
          FROM orders o
          JOIN (
            SELECT order_id, ROUND(SUM(final_amount), 2) AS item_amount
            FROM order_items
            WHERE final_amount IS NOT NULL
            GROUP BY order_id
          ) items ON items.order_id = o.id
          WHERE o.final_product_amount IS NOT NULL
            AND ABS(o.final_product_amount - items.item_amount) > 0.005`,
  },
  {
    name: 'coupon_discount_and_single_coupon',
    sql: `SELECT COUNT(*) AS violations
          FROM (
            SELECT o.id
            FROM orders o
            LEFT JOIN coupon_records cr ON cr.order_id = o.id
            GROUP BY o.id, o.discount_amount
            HAVING COUNT(cr.id) > 1
              OR ABS(o.discount_amount - COALESCE(SUM(cr.discount_amount), 0)) > 0.005
          ) inconsistent`,
  },
  {
    name: 'shipping_record_amount',
    sql: `SELECT COUNT(*) AS violations
          FROM orders o
          JOIN shipping_records sr ON sr.order_id = o.id
          WHERE sr.status = 'COMPLETED'
            AND (
              ABS(o.shipping_fee - sr.shipping_fee) > 0.005
              OR ABS(o.actual_weight - sr.actual_weight) > 0.0005
            )`,
  },
  {
    name: 'completed_order_receivable',
    sql: `SELECT COUNT(*) AS violations
          FROM orders o
          LEFT JOIN receivables r ON r.order_id = o.id
          WHERE o.status = 'COMPLETED'
            AND (
              r.id IS NULL
              OR ABS(r.final_amount - o.final_amount) > 0.005
              OR ABS(r.receivable_amount - o.final_amount) > 0.005
            )`,
  },
  {
    name: 'customer_balance_due',
    sql: `SELECT COUNT(*) AS violations
          FROM customers c
          LEFT JOIN (
            SELECT customer_id, SUM(remaining_amount) AS remaining
            FROM receivables
            WHERE status IN ('UNPAID', 'PARTIALLY_PAID')
            GROUP BY customer_id
          ) debt ON debt.customer_id = c.id
          WHERE ABS(c.balance_due - COALESCE(debt.remaining, 0)) > 0.005`,
  },
  {
    name: 'purchase_receipt_historical_amount',
    sql: `SELECT COUNT(*) AS violations
          FROM purchase_receipts pr
          JOIN (
            SELECT receipt_id, ROUND(SUM(amount), 2) AS item_amount
            FROM purchase_receipt_items GROUP BY receipt_id
          ) items ON items.receipt_id = pr.id
          WHERE ABS(pr.total_amount - items.item_amount) > 0.005`,
  },
];

async function main() {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const results = [];
    for (const check of checks) {
      const [[row]] = await db.query(check.sql);
      const violations = Number(row.violations);
      results.push({
        check: check.name,
        violations,
        status: violations === 0 ? 'PASS' : 'FAIL',
      });
    }
    console.log(JSON.stringify({ checks: results }, null, 2));
    const failed = results.filter((item) => item.violations > 0);
    assert.deepEqual(failed, [], `consistency violations: ${JSON.stringify(failed)}`);
  } finally {
    await db.end();
  }
}

await main();
