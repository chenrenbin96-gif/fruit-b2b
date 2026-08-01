import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { config } from 'dotenv';
import Redis from 'ioredis';
import mysql from 'mysql2/promise';

config({ path: '../../.env', quiet: true });

const baseUrl =
  process.env.TEST_API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
const tenantCode = process.env.BOOTSTRAP_TENANT_CODE ?? 'DEFAULT';
const runId = Date.now().toString().slice(-6);
const customerIds = [];
const accountIds = [];
const cartIds = [];
const orderIds = [];
const tokens = [];
const sampleCount = 60;

async function verificationCode(tenantId, phone, response) {
  if (response.body.data.debug_code) return response.body.data.debug_code;
  const redis = new Redis(process.env.REDIS_URL);
  try {
    const keys = await redis.keys(`*auth:customer-code:${tenantId}:${phone}`);
    assert.equal(keys.length, 1, 'verification code must exist in test Redis');
    const keyPrefix = process.env.REDIS_KEY_PREFIX ?? '';
    const value = await redis.get(
      keyPrefix && keys[0].startsWith(keyPrefix)
        ? keys[0].slice(keyPrefix.length)
        : keys[0],
    );
    assert.ok(value, 'verification code must be readable in test environment');
    return value;
  } finally {
    await redis.quit();
  }
}

async function request(path, options = {}) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.token
        ? { authorization: `Bearer ${options.token}` }
        : {}),
      ...(options.headers ?? {}),
    },
    body:
      options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const responseText = await response.text();
  let body;
  try {
    body = JSON.parse(responseText);
  } catch {
    body = {
      code: 'NON_JSON_RESPONSE',
      message: responseText.slice(0, 200),
    };
  }
  return {
    status: response.status,
    body,
    duration: performance.now() - started,
  };
}

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * ratio) - 1] ?? 0;
}

async function main() {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  let tenantId;
  let rootId;
  let childId;
  let productId;
  let skuId;
  let inventoryId;
  try {
    const [[tenant]] = await db.query(
      'SELECT id FROM tenants WHERE tenant_code = ?',
      [tenantCode],
    );
    tenantId = String(tenant.id);
    const [[warehouse]] = await db.query(
      "SELECT id FROM warehouses WHERE tenant_id = ? AND status = 'ACTIVE' ORDER BY id LIMIT 1",
      [tenantId],
    );
    const [[level]] = await db.query(
      "SELECT id FROM customer_levels WHERE tenant_id = ? AND level_code = 'NORMAL'",
      [tenantId],
    );
    const [root] = await db.execute(
      "INSERT INTO categories (tenant_id, name, sort, status) VALUES (?, ?, 0, 'ACTIVE')",
      [tenantId, `性能测试水果${runId}`],
    );
    rootId = String(root.insertId);
    const [child] = await db.execute(
      "INSERT INTO categories (tenant_id, parent_id, name, sort, status) VALUES (?, ?, ?, 0, 'ACTIVE')",
      [tenantId, rootId, `性能测试分类${runId}`],
    );
    childId = String(child.insertId);
    const [product] = await db.execute(
      "INSERT INTO products (tenant_id, category_id, product_code, name, status) VALUES (?, ?, ?, ?, 'ON_SALE')",
      [tenantId, childId, `PERF${runId}`, `并发库存测试商品${runId}`],
    );
    productId = String(product.insertId);
    const [sku] = await db.execute(
      "INSERT INTO skus (tenant_id, product_id, sku_code, sku_name, sale_type, piece_unit, stock_unit, price_unit, delivery_weight_per_piece, delivery_weight_unit, cost_price, base_price, stock_warning, status) VALUES (?, ?, ?, '整箱', 'PIECE', '箱', '箱', '箱', 5, '公斤', 50, 100, 1, 'ACTIVE')",
      [tenantId, productId, `PERFSKU${runId}`],
    );
    skuId = String(sku.insertId);
    const [inventory] = await db.execute(
      "INSERT INTO inventory (tenant_id, warehouse_id, sku_id, stock_unit, stock_quantity, locked_quantity, cost_price) VALUES (?, ?, ?, '箱', 5, 0, 50)",
      [tenantId, String(warehouse.id), skuId],
    );
    inventoryId = String(inventory.insertId);

    for (let index = 0; index < 12; index += 1) {
      const phone = `139${runId}${String(index).padStart(2, '0')}`;
      const [customer] = await db.execute(
        "INSERT INTO customers (tenant_id, customer_no, customer_name, contact_name, phone, address, business_type, level_id, status) VALUES (?, ?, ?, '性能采购员', ?, '性能测试地址', 'FRUIT_RETAIL', ?, 'ACTIVE')",
        [
          tenantId,
          `PC${runId}${index}`,
          `性能客户${runId}-${index}`,
          phone,
          String(level.id),
        ],
      );
      const customerId = String(customer.insertId);
      customerIds.push(customerId);
      const [account] = await db.execute(
        "INSERT INTO customer_accounts (tenant_id, customer_id, account_name, phone, is_primary, status) VALUES (?, ?, '性能账号', ?, 1, 'ACTIVE')",
        [tenantId, customerId, phone],
      );
      accountIds.push(String(account.insertId));
      await db.execute(
        'INSERT INTO customer_settings (tenant_id, customer_id, first_order_min_amount, enabled) VALUES (?, ?, 0, 1)',
        [tenantId, customerId],
      );
      const code = await request('/auth/customer/verification-code', {
        method: 'POST',
        body: { tenant_code: tenantCode, phone },
      });
      assert.equal(code.status, 201);
      const login = await request('/auth/customer/login', {
        method: 'POST',
        body: {
          tenant_code: tenantCode,
          phone,
          verification_code: await verificationCode(tenantId, phone, code),
        },
      });
      assert.equal(login.status, 201);
      const token = login.body.data.access_token;
      tokens.push(token);
      const cart = await request('/purchase-cart/items', {
        method: 'POST',
        token,
        body: { sku_id: skuId, quantity: 1 },
      });
      assert.equal(cart.status, 201);
      cartIds.push(cart.body.data.id);
    }

    const listDurations = [];
    const detailDurations = [];
    for (let index = 0; index < sampleCount; index += 1) {
      const list = await request('/catalog/products?page=1&page_size=20', {
        token: tokens[0],
      });
      assert.equal(list.status, 200);
      listDurations.push(list.duration);
      await new Promise((resolve) => setTimeout(resolve, 40));
      const detail = await request(`/catalog/products/${productId}`, {
        token: tokens[0],
      });
      assert.equal(detail.status, 200);
      detailDurations.push(detail.duration);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }

    const submissionKeys = tokens.map(
      (_, index) => `performance_${runId}_${index}`,
    );
    const submissions = await Promise.all(
      tokens.map((token, index) =>
        request('/purchase-cart/submit', {
          method: 'POST',
          token,
          headers: { 'idempotency-key': submissionKeys[index] },
          body: {},
        }),
      ),
    );
    const successful = submissions.filter((result) => result.status === 201);
    const rejected = submissions.filter(
      (result) =>
        result.status === 400 &&
        result.body.code === 'INSUFFICIENT_AVAILABLE_STOCK',
    );
    orderIds.push(...successful.map((result) => result.body.data.id));
    assert.equal(successful.length, 5, 'only available stock may succeed');
    assert.equal(
      rejected.length,
      7,
      `remaining submissions must be rejected: ${JSON.stringify(
        submissions.map((item) => ({
          status: item.status,
          code: item.body.code,
        })),
      )}`,
    );
    const [[stock]] = await db.query(
      'SELECT stock_quantity, locked_quantity, available_quantity FROM inventory WHERE id = ?',
      [inventoryId],
    );
    assert.equal(Number(stock.stock_quantity), 5);
    assert.equal(Number(stock.locked_quantity), 5);
    assert.equal(Number(stock.available_quantity), 0);
    const successfulIndex = submissions.findIndex(
      (result) => result.status === 201,
    );
    const repeated = await request('/purchase-cart/submit', {
      method: 'POST',
      token: tokens[successfulIndex],
      headers: { 'idempotency-key': submissionKeys[successfulIndex] },
      body: {},
    });
    assert.equal(repeated.status, 201);
    assert.equal(
      repeated.body.data.id,
      submissions[successfulIndex].body.data.id,
      'same idempotency key must return the original order',
    );

    const result = {
      samples: sampleCount,
      catalog_list_ms: {
        p50: Number(percentile(listDurations, 0.5).toFixed(2)),
        p95: Number(percentile(listDurations, 0.95).toFixed(2)),
      },
      product_detail_ms: {
        p50: Number(percentile(detailDurations, 0.5).toFixed(2)),
        p95: Number(percentile(detailDurations, 0.95).toFixed(2)),
      },
      concurrent_orders: {
        attempted: submissions.length,
        succeeded: successful.length,
        stock_rejected: rejected.length,
        p95_ms: Number(
          percentile(
            submissions.map((item) => item.duration),
            0.95,
          ).toFixed(2),
        ),
        final_stock: Number(stock.stock_quantity),
        final_locked: Number(stock.locked_quantity),
        final_available: Number(stock.available_quantity),
        oversold: false,
        idempotent_retry: true,
      },
    };
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (orderIds.length) {
      await db.query('DELETE FROM order_status_logs WHERE order_id IN (?)', [
        orderIds,
      ]);
      await db.query('DELETE FROM inventory_logs WHERE reference_type = ? AND reference_id IN (?)', [
        'ORDER',
        orderIds,
      ]);
      await db.query('DELETE FROM order_items WHERE order_id IN (?)', [orderIds]);
      await db.query('DELETE FROM orders WHERE id IN (?)', [orderIds]);
    }
    if (cartIds.length) {
      await db.query('DELETE FROM purchase_cart_items WHERE cart_id IN (?)', [
        cartIds,
      ]);
      await db.query('DELETE FROM purchase_carts WHERE id IN (?)', [cartIds]);
    }
    if (customerIds.length) {
      await db.query('DELETE FROM customer_settings WHERE customer_id IN (?)', [
        customerIds,
      ]);
      await db.query('DELETE FROM customer_accounts WHERE customer_id IN (?)', [
        customerIds,
      ]);
      await db.query('DELETE FROM customers WHERE id IN (?)', [customerIds]);
    }
    if (inventoryId) await db.query('DELETE FROM inventory WHERE id = ?', [inventoryId]);
    if (skuId) await db.query('DELETE FROM skus WHERE id = ?', [skuId]);
    if (productId) await db.query('DELETE FROM products WHERE id = ?', [productId]);
    if (childId) await db.query('DELETE FROM categories WHERE id = ?', [childId]);
    if (rootId) await db.query('DELETE FROM categories WHERE id = ?', [rootId]);
    await db.end();
  }
}

await main();
