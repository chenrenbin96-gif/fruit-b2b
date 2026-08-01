import assert from 'node:assert/strict';

import { hash } from 'bcryptjs';
import { config } from 'dotenv';
import mysql from 'mysql2/promise';

config({ path: '../../.env', quiet: true });

const baseUrl =
  process.env.TEST_API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
const tenantCode = process.env.BOOTSTRAP_TENANT_CODE ?? 'DEFAULT';
const suffix = Date.now().toString().slice(-8);
const ids = {};
const userIds = [];
let adminToken = '';
let purchaserToken = '';
let warehouseToken = '';

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(options.token
        ? { authorization: `Bearer ${options.token}` }
        : {}),
    },
    body:
      options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const json = await response.json();
  assert.equal(
    response.status,
    options.expected ?? (options.method === 'POST' ? 201 : 200),
    `${options.method ?? 'GET'} ${path}: ${JSON.stringify(json)}`,
  );
  return json.data;
}

async function login(username, password) {
  return (
    await api('/auth/employee/login', {
      method: 'POST',
      body: { tenant_code: tenantCode, username, password },
    })
  ).access_token;
}

async function main() {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  const password = `Procurement_${suffix}!`;
  try {
    const [[tenant]] = await db.query(
      'SELECT id FROM tenants WHERE tenant_code = ?',
      [tenantCode],
    );
    ids.tenant = String(tenant.id);
    const [[warehouse]] = await db.query(
      "SELECT id, store_id FROM warehouses WHERE tenant_id = ? AND status = 'ACTIVE' ORDER BY id LIMIT 1",
      [ids.tenant],
    );
    ids.warehouse = String(warehouse.id);
    const [roles] = await db.query(
      "SELECT id, role_code FROM roles WHERE tenant_id = ? AND role_code IN ('ADMIN', 'PURCHASER', 'WAREHOUSE')",
      [ids.tenant],
    );
    const roleMap = Object.fromEntries(
      roles.map((role) => [role.role_code, String(role.id)]),
    );
    assert.ok(roleMap.ADMIN && roleMap.PURCHASER && roleMap.WAREHOUSE);
    const passwordHash = await hash(password, 4);
    for (const role of ['ADMIN', 'PURCHASER', 'WAREHOUSE']) {
      const username = `${role.toLowerCase()}_proc_${suffix}`;
      const [user] = await db.execute(
        "INSERT INTO users (tenant_id, username, password_hash, name, role_id, store_id, warehouse_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')",
        [
          ids.tenant,
          username,
          passwordHash,
          `${role}采购测试`,
          roleMap[role],
          String(warehouse.store_id),
          ids.warehouse,
        ],
      );
      ids[`${role.toLowerCase()}Username`] = username;
      ids[`${role.toLowerCase()}User`] = String(user.insertId);
      userIds.push(String(user.insertId));
    }
    adminToken = await login(ids.adminUsername, password);
    purchaserToken = await login(ids.purchaserUsername, password);
    await api('/admin/warehouse/tasks', {
      token: purchaserToken,
      expected: 403,
    });
    warehouseToken = await login(ids.warehouseUsername, password);

    const [root] = await db.execute(
      "INSERT INTO categories (tenant_id, name, sort, status) VALUES (?, ?, 0, 'ACTIVE')",
      [ids.tenant, `采购测试水果${suffix}`],
    );
    ids.root = String(root.insertId);
    const [child] = await db.execute(
      "INSERT INTO categories (tenant_id, parent_id, name, sort, status) VALUES (?, ?, ?, 0, 'ACTIVE')",
      [ids.tenant, ids.root, `采购测试分类${suffix}`],
    );
    ids.child = String(child.insertId);
    const [product] = await db.execute(
      "INSERT INTO products (tenant_id, category_id, product_code, name, status) VALUES (?, ?, ?, ?, 'ON_SALE')",
      [ids.tenant, ids.child, `PRP${suffix}`, `采购测试商品${suffix}`],
    );
    ids.product = String(product.insertId);
    const [piece] = await db.execute(
      "INSERT INTO skus (tenant_id, product_id, sku_code, sku_name, sale_type, piece_unit, stock_unit, price_unit, delivery_weight_per_piece, delivery_weight_unit, cost_price, base_price, stock_warning, status) VALUES (?, ?, ?, '整箱', 'PIECE', '箱', '箱', '箱', 10, '公斤', 20, 60, 1, 'ACTIVE')",
      [ids.tenant, ids.product, `PRPI${suffix}`],
    );
    ids.pieceSku = String(piece.insertId);
    const [weight] = await db.execute(
      "INSERT INTO skus (tenant_id, product_id, sku_code, sku_name, sale_type, piece_unit, weight_unit, stock_unit, price_unit, standard_weight, weight_price_type, gross_weight_unit_price, net_weight_unit_price, cost_price, base_price, stock_warning, status) VALUES (?, ?, ?, '10斤标准装', 'WEIGHT', '件', '斤', '斤', '件', 10, 'ACTUAL_WEIGHT', 18, 18, 8, 180, 1, 'ACTIVE')",
      [ids.tenant, ids.product, `PRWE${suffix}`],
    );
    ids.weightSku = String(weight.insertId);
    const [pieceInventory] = await db.execute(
      "INSERT INTO inventory (tenant_id, warehouse_id, sku_id, stock_unit, stock_quantity, locked_quantity, cost_price) VALUES (?, ?, ?, '箱', 10, 0, 20)",
      [ids.tenant, ids.warehouse, ids.pieceSku],
    );
    ids.pieceInventory = String(pieceInventory.insertId);
    const [weightInventory] = await db.execute(
      "INSERT INTO inventory (tenant_id, warehouse_id, sku_id, stock_unit, stock_quantity, locked_quantity, cost_price) VALUES (?, ?, ?, '斤', 100, 0, 8)",
      [ids.tenant, ids.warehouse, ids.weightSku],
    );
    ids.weightInventory = String(weightInventory.insertId);

    const supplier = await api('/admin/suppliers', {
      method: 'POST',
      token: adminToken,
      body: {
        supplier_name: `岭南果业${suffix}`,
        contact_name: '供应商联系人',
        phone: '13800001111',
        address: '广东省采购测试地址',
        supply_categories: ['芒果', '荔枝'],
        remark: '稳定供货',
      },
    });
    ids.supplier = supplier.id;
    assert.equal(supplier.status, 'ACTIVE');
    const updatedSupplier = await api(`/admin/suppliers/${ids.supplier}`, {
      method: 'PUT',
      token: adminToken,
      body: {
        supplier_name: `岭南果业供应链${suffix}`,
        contact_name: '新联系人',
        phone: '13800002222',
        address: '广东省更新地址',
        supply_categories: ['芒果', '荔枝', '龙眼'],
        remark: '供应商资料已更新',
        status: 'ACTIVE',
      },
    });
    assert.equal(updatedSupplier.supply_categories.length, 3);
    const purchaserSuppliers = await api('/admin/suppliers', {
      token: purchaserToken,
    });
    assert.ok(purchaserSuppliers.some((item) => item.id === ids.supplier));
    await api('/admin/suppliers', {
      token: warehouseToken,
      expected: 403,
    });
    const supplierProducts = await api(`/admin/suppliers/${ids.supplier}/products`, {
      method: 'POST',
      token: purchaserToken,
      body: { sku_id: ids.pieceSku, purchase_price: 39.5 },
    });
    assert.ok(supplierProducts.some((item) => item.sku_id === ids.pieceSku));

    const purchase = await api('/admin/purchases', {
      method: 'POST',
      token: purchaserToken,
      body: {
        supplier_id: ids.supplier,
        warehouse_id: ids.warehouse,
        remark: '采购测试单',
        items: [
          { sku_id: ids.pieceSku, quantity: 5, purchase_price: 40 },
          {
            sku_id: ids.weightSku,
            quantity: 10.5,
            purchase_price: 12.25,
          },
        ],
      },
    });
    ids.purchase = purchase.id;
    assert.equal(purchase.status, 'PENDING_PURCHASE');
    assert.equal(purchase.total_amount, '328.63');
    assert.deepEqual(
      purchase.items.map((item) => item.sale_type).sort(),
      ['PIECE', 'WEIGHT'],
    );
    await api('/admin/purchases', {
      method: 'POST',
      token: warehouseToken,
      body: {
        supplier_id: ids.supplier,
        warehouse_id: ids.warehouse,
        items: [{ sku_id: ids.pieceSku, quantity: 1, purchase_price: 30 }],
      },
      expected: 403,
    });
    const submitted = await api(`/admin/purchases/${ids.purchase}/submit`, {
      method: 'POST',
      token: purchaserToken,
      body: {},
    });
    assert.equal(submitted.status, 'PURCHASING');
    const arrived = await api(`/admin/purchases/${ids.purchase}/arrive`, {
      method: 'POST',
      token: purchaserToken,
      body: {},
    });
    assert.equal(arrived.status, 'ARRIVED');

    const firstReceiptInput = purchase.items.map((item) => ({
      purchase_order_item_id: item.id,
      received_quantity: item.sale_type === 'PIECE' ? 2 : 5,
      ...(item.sale_type === 'WEIGHT'
        ? { gross_weight: 5.2, net_weight: 5 }
        : {}),
    }));
    const partiallyReceived = await api(`/admin/purchases/${ids.purchase}/receive`, {
      method: 'POST',
      token: warehouseToken,
      body: { items: firstReceiptInput, remark: '第一次部分收货' },
    });
    ids.receipts = [partiallyReceived.receipt_id];
    assert.equal(partiallyReceived.order.status, 'PARTIALLY_RECEIVED');
    const secondReceiptInput = purchase.items.map((item) => ({
      purchase_order_item_id: item.id,
      received_quantity: item.sale_type === 'PIECE' ? 3 : 5.5,
      ...(item.sale_type === 'WEIGHT'
        ? { gross_weight: 5.8, net_weight: 5.5 }
        : {}),
    }));
    const received = await api(`/admin/purchases/${ids.purchase}/receive`, {
      method: 'POST',
      token: warehouseToken,
      body: { items: secondReceiptInput, remark: '第二次全部收货' },
    });
    ids.receipts.push(received.receipt_id);
    assert.equal(received.order.status, 'RECEIVED');
    assert.equal(received.order.receipts.length, 2);

    const [inventory] = await db.query(
      'SELECT sku_id, stock_quantity, cost_price FROM inventory WHERE id IN (?, ?) ORDER BY sku_id',
      [ids.pieceInventory, ids.weightInventory],
    );
    const inventoryMap = Object.fromEntries(
      inventory.map((item) => [String(item.sku_id), item]),
    );
    assert.equal(Number(inventoryMap[ids.pieceSku].stock_quantity), 15);
    assert.ok(Math.abs(Number(inventoryMap[ids.pieceSku].cost_price) - 26.6667) < 0.001);
    assert.equal(Number(inventoryMap[ids.weightSku].stock_quantity), 110.5);
    assert.ok(Math.abs(Number(inventoryMap[ids.weightSku].cost_price) - 8.404) < 0.001);
    const [skuCosts] = await db.query(
      'SELECT id, cost_price FROM skus WHERE id IN (?, ?)',
      [ids.pieceSku, ids.weightSku],
    );
    const skuCostMap = Object.fromEntries(
      skuCosts.map((item) => [String(item.id), Number(item.cost_price)]),
    );
    assert.ok(Math.abs(skuCostMap[ids.pieceSku] - 26.6667) < 0.001);
    assert.ok(Math.abs(skuCostMap[ids.weightSku] - 8.404) < 0.001);

    const costs = await api('/admin/supply-chain/costs', {
      token: adminToken,
    });
    assert.ok(costs.some((item) => item.sku_id === ids.pieceSku));
    const alerts = await api('/admin/supply-chain/inventory-alerts', {
      token: adminToken,
    });
    assert.ok(Array.isArray(alerts.low_stock));
    const suggestions = await api('/admin/supply-chain/purchase-suggestions', {
      token: adminToken,
    });
    assert.ok(Array.isArray(suggestions));
    const profit = await api('/admin/supply-chain/profit-analysis', {
      token: adminToken,
    });
    assert.equal(profit.cost_basis, 'CURRENT_WEIGHTED_AVERAGE');

    const [receiptItems] = await db.query(
      'SELECT sku_id, purchase_price, inventory_cost_before, inventory_cost_after FROM purchase_receipt_items WHERE receipt_id = ?',
      [ids.receipts[0]],
    );
    const costMap = Object.fromEntries(
      receiptItems.map((item) => [String(item.sku_id), item]),
    );
    assert.equal(Number(costMap[ids.pieceSku].purchase_price), 40);
    assert.equal(Number(costMap[ids.pieceSku].inventory_cost_before), 20);
    assert.equal(Number(costMap[ids.pieceSku].inventory_cost_after), 23.3333);
    assert.equal(Number(costMap[ids.weightSku].purchase_price), 12.25);
    const [[logCount]] = await db.query(
      "SELECT COUNT(*) AS count FROM inventory_logs WHERE operation_type = 'PURCHASE_IN' AND reference_id = ?",
      [ids.receipts[0]],
    );
    assert.equal(Number(logCount.count), 2);
    const [[auditCount]] = await db.query(
      "SELECT COUNT(*) AS count FROM operation_logs WHERE action_code = 'PURCHASE_RECEIVE' AND target_id = ?",
      [ids.purchase],
    );
    assert.equal(Number(auditCount.count), 2);
    const prices = await api('/admin/purchase-prices', { token: purchaserToken });
    assert.ok(prices.some((item) => item.sku_id === ids.pieceSku));
    const history = await api(`/admin/purchase-prices/history/${ids.pieceSku}`, {
      token: purchaserToken,
    });
    assert.equal(history.length, 2);
    const plans = await api('/admin/purchase-plans/generate', {
      method: 'POST',
      token: purchaserToken,
      body: {},
    });
    assert.ok(Array.isArray(plans));
    const analysis = await api('/admin/purchase-analysis?period=month', {
      token: purchaserToken,
    });
    assert.equal(analysis.period, 'month');

    const purchaseReturn = await api('/admin/purchase-returns', {
      method: 'POST',
      token: purchaserToken,
      body: {
        purchase_order_id: ids.purchase,
        reason: '采购验收质量问题',
        items: [{
          purchase_order_item_id: purchase.items.find((item) => item.sale_type === 'PIECE').id,
          return_quantity: 1,
        }],
      },
    });
    ids.purchaseReturn = purchaseReturn.id;
    await api(`/admin/purchase-returns/${ids.purchaseReturn}`, {
      method: 'PUT',
      token: purchaserToken,
      body: { status: 'APPROVED' },
    });
    const completedReturn = await api(`/admin/purchase-returns/${ids.purchaseReturn}`, {
      method: 'PUT',
      token: purchaserToken,
      body: { status: 'COMPLETED' },
    });
    assert.equal(completedReturn.status, 'COMPLETED');
    const [[returnedInventory]] = await db.query(
      'SELECT stock_quantity FROM inventory WHERE id = ?',
      [ids.pieceInventory],
    );
    assert.equal(Number(returnedInventory.stock_quantity), 14);

    console.log(
      JSON.stringify({
        supplier_create_update: 'PASS',
        purchase_piece_weight: 'PASS',
        purchase_submit: 'PASS',
        warehouse_receipt: 'PASS',
        inventory_increment: 'PASS',
        weighted_inventory_cost: 'PASS',
        historical_purchase_cost: 'PASS',
        inventory_log: 'PASS',
        supplier_admin_scope: 'PASS',
        purchaser_scope: 'PASS',
        warehouse_receive_scope: 'PASS',
        partial_and_full_receipt: 'PASS',
        supplier_product_catalog: 'PASS',
        purchase_price_history: 'PASS',
        purchase_plan_generation: 'PASS',
        purchase_analysis: 'PASS',
        purchase_return_inventory_sync: 'PASS',
      }),
    );
  } finally {
    if (ids.purchase) {
      await db.query(
        "DELETE FROM operation_logs WHERE target_type IN ('PURCHASE_ORDER', 'SUPPLIER') AND target_id IN (?, ?)",
        [ids.purchase, ids.supplier ?? '0'],
      );
    }
    if (ids.purchaseReturn) {
      await db.query(
        "DELETE FROM inventory_logs WHERE reference_type = 'PURCHASE_RETURN' AND reference_id = ?",
        [ids.purchaseReturn],
      );
      await db.query('DELETE FROM purchase_return_items WHERE purchase_return_id = ?', [ids.purchaseReturn]);
      await db.query('DELETE FROM purchase_returns WHERE id = ?', [ids.purchaseReturn]);
    }
    if (ids.receipts?.length) {
      await db.query(
        "DELETE FROM inventory_logs WHERE reference_type = 'PURCHASE_RECEIPT' AND reference_id IN (?)",
        [ids.receipts],
      );
      await db.query('DELETE FROM purchase_receipt_items WHERE receipt_id IN (?)', [
        ids.receipts,
      ]);
      await db.query('DELETE FROM purchase_receipts WHERE id IN (?)', [ids.receipts]);
    }
    if (ids.purchase) {
      await db.query('DELETE FROM purchase_price_history WHERE purchase_order_id = ?', [ids.purchase]);
      await db.query("DELETE FROM purchase_plans WHERE tenant_id = ? AND status = 'PENDING'", [ids.tenant]);
      await db.query('DELETE FROM supplier_products WHERE supplier_id = ?', [ids.supplier]);
      await db.query(
        'DELETE FROM purchase_order_items WHERE purchase_order_id = ?',
        [ids.purchase],
      );
      await db.query('DELETE FROM purchase_orders WHERE id = ?', [ids.purchase]);
    }
    if (ids.supplier) {
      await db.query('DELETE FROM suppliers WHERE id = ?', [ids.supplier]);
    }
    if (ids.pieceInventory) {
      await db.query('DELETE FROM inventory WHERE id IN (?, ?)', [
        ids.pieceInventory,
        ids.weightInventory,
      ]);
    }
    if (ids.product) {
      await db.query('DELETE FROM skus WHERE product_id = ?', [ids.product]);
      await db.query('DELETE FROM products WHERE id = ?', [ids.product]);
    }
    if (ids.child) await db.query('DELETE FROM categories WHERE id = ?', [ids.child]);
    if (ids.root) await db.query('DELETE FROM categories WHERE id = ?', [ids.root]);
    if (userIds.length) {
      await db.query('DELETE FROM users WHERE id IN (?)', [userIds]);
    }
    await db.end();
  }
}

await main();
