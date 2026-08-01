import assert from 'node:assert/strict';

import { hash } from 'bcryptjs';
import { config } from 'dotenv';
import mysql from 'mysql2/promise';

config({ path: '../../.env', quiet: true });

const baseUrl =
  process.env.TEST_API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
const suffix = Date.now().toString().slice(-8);
const tenantCode = process.env.BOOTSTRAP_TENANT_CODE ?? 'DEFAULT';
const testUsername = `stage5b_${suffix}`;
const testPassword = `Stage5B_${suffix}!`;
const ids = {};
let accessToken = '';

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(accessToken
        ? { authorization: `Bearer ${accessToken}` }
        : {}),
    },
    body:
      options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
  });
  const json = await response.json();
  if (options.expected !== undefined) {
    assert.equal(
      response.status,
      options.expected,
      `${options.method ?? 'GET'} ${path}: ${JSON.stringify(json)}`,
    );
  } else {
    assert.ok(
      response.ok,
      `${options.method ?? 'GET'} ${path}: ${response.status} ${JSON.stringify(json)}`,
    );
  }
  return json;
}

async function main() {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');
  const database = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [tenants] = await database.query(
      'SELECT id FROM tenants WHERE tenant_code = ?',
      [tenantCode],
    );
    ids.tenant = String(tenants[0].id);
    const [roles] = await database.query(
      "SELECT id FROM roles WHERE tenant_id = ? AND role_code = 'ADMIN'",
      [ids.tenant],
    );
    const [warehouses] = await database.query(
      'SELECT id, store_id FROM warehouses WHERE tenant_id = ? ORDER BY id LIMIT 1',
      [ids.tenant],
    );
    ids.warehouse = String(warehouses[0].id);
    const [userResult] = await database.execute(
      "INSERT INTO users (tenant_id, username, password_hash, name, role_id, store_id, warehouse_id, status) VALUES (?, ?, ?, '阶段5-B测试管理员', ?, ?, ?, 'ACTIVE')",
      [
        ids.tenant,
        testUsername,
        await hash(testPassword, 4),
        String(roles[0].id),
        String(warehouses[0].store_id),
        ids.warehouse,
      ],
    );
    ids.user = String(userResult.insertId);

    const login = await api('/auth/employee/login', {
      method: 'POST',
      body: {
        tenant_code: tenantCode,
        username: testUsername,
        password: testPassword,
      },
    });
    accessToken = login.data.access_token;

    const [levels] = await database.query(
      "SELECT id FROM customer_levels WHERE tenant_id = ? AND level_code = 'NORMAL'",
      [ids.tenant],
    );
    ids.level = String(levels[0].id);
    const [customerResult] = await database.execute(
      "INSERT INTO customers (tenant_id, customer_no, customer_name, contact_name, phone, address, business_type, level_id, status) VALUES (?, ?, ?, '测试联系人', ?, '测试地址', 'FRUIT_RETAIL', ?, 'ACTIVE')",
      [
        ids.tenant,
        `T${suffix}`,
        `测试客户${suffix}`,
        `139${suffix}`.slice(0, 11),
        ids.level,
      ],
    );
    ids.customer = String(customerResult.insertId);

    let result = await api('/admin/categories', {
      method: 'POST',
      body: { name: `测试水果${suffix}`, sort: 1, status: 'ACTIVE' },
    });
    ids.root = result.data.id;
    result = await api('/admin/categories', {
      method: 'POST',
      body: {
        parent_id: ids.root,
        name: `测试苹果${suffix}`,
        sort: 1,
        status: 'ACTIVE',
      },
    });
    ids.child = result.data.id;
    await api('/admin/categories', {
      method: 'POST',
      body: {
        parent_id: ids.child,
        name: '非法三级分类',
        sort: 1,
        status: 'ACTIVE',
      },
      expected: 400,
    });
    const tree = await api('/admin/categories/tree');
    assert.ok(
      tree.data.some(
        (root) =>
          root.id === ids.root &&
          root.children.some((child) => child.id === ids.child),
      ),
    );

    result = await api('/admin/products', {
      method: 'POST',
      body: {
        category_id: ids.child,
        product_code: `P${suffix}`,
        name: `测试芒果${suffix}`,
        origin: '海南',
        brand: '测试品牌',
        description: '阶段5-B集成测试',
        status: 'DRAFT',
      },
    });
    ids.product = result.data.id;
    await api(`/admin/products/${ids.product}/media`, {
      method: 'POST',
      body: {
        media_type: 'IMAGE',
        url: 'https://dummyimage.com/400x400',
        sort: 0,
      },
    });
    result = await api('/admin/skus', {
      method: 'POST',
      body: {
        product_id: ids.product,
        sku_code: `BOX${suffix}`,
        sku_name: '10斤箱装',
        specification: '标准箱',
        sale_type: 'PIECE',
        piece_unit: '箱',
        stock_unit: '箱',
        price_unit: '箱',
        delivery_weight_per_piece: 5,
        delivery_weight_unit: '公斤',
        cost_price: 70,
        base_price: 100,
        stock_warning: 10,
        status: 'ACTIVE',
      },
    });
    ids.piece = result.data.id;
    result = await api('/admin/skus', {
      method: 'POST',
      body: {
        product_id: ids.product,
        sku_code: `WGT${suffix}`,
        sku_name: '20斤装',
        specification: '固定规格，实际称重结算',
        sale_type: 'WEIGHT',
        piece_unit: '件',
        weight_unit: '斤',
        stock_unit: '斤',
        price_unit: '件',
        standard_weight: 20,
        weight_price_type: 'ACTUAL_WEIGHT',
        gross_weight_unit_price: 10,
        net_weight_unit_price: 11,
        cost_price: 3.5,
        base_price: 200,
        stock_warning: 50,
        status: 'ACTIVE',
      },
    });
    ids.weight = result.data.id;
    await api('/admin/skus', {
      method: 'POST',
      body: {
        product_id: ids.product,
        sku_code: `BAD${suffix}`,
        sku_name: '错误单位',
        sale_type: 'PIECE',
        weight_unit: '斤',
        stock_unit: '斤',
        price_unit: '斤',
        cost_price: 1,
        base_price: 2,
        stock_warning: 0,
      },
      expected: 400,
    });
    const skus = await api(`/admin/skus?product_id=${ids.product}`);
    assert.deepEqual(
      new Set(skus.data.map((sku) => sku.sale_type)),
      new Set(['PIECE', 'WEIGHT']),
    );
    await api(`/admin/products/${ids.product}/status`, {
      method: 'PATCH',
      body: { status: 'ON_SALE' },
    });

    result = await api('/admin/inventory/adjustments', {
      method: 'POST',
      body: {
        warehouse_id: ids.warehouse,
        sku_id: ids.piece,
        operation_type: 'ADJUST_IN',
        quantity: 100,
        reason: '阶段5-B测试入库',
      },
    });
    assert.equal(result.data.stock_unit, '箱');
    assert.equal(result.data.available_quantity, '100.000');
    await api('/admin/inventory/adjustments', {
      method: 'POST',
      body: {
        warehouse_id: ids.warehouse,
        sku_id: ids.piece,
        operation_type: 'ADJUST_IN',
        quantity: 0.5,
        reason: '非法件数',
      },
      expected: 400,
    });
    result = await api('/admin/inventory/adjustments', {
      method: 'POST',
      body: {
        warehouse_id: ids.warehouse,
        sku_id: ids.weight,
        operation_type: 'ADJUST_IN',
        quantity: 500.5,
        reason: '阶段5-B测试入库',
      },
    });
    assert.equal(result.data.stock_unit, '斤');
    assert.equal(result.data.available_quantity, '500.500');

    await api('/admin/prices/levels', {
      method: 'PUT',
      body: {
        level_id: ids.level,
        sku_id: ids.piece,
        price: 90,
        status: 'ACTIVE',
      },
    });
    await api('/admin/prices/customers', {
      method: 'PUT',
      body: {
        customer_id: ids.customer,
        sku_id: ids.piece,
        price: 85,
        status: 'ACTIVE',
      },
    });
    await api('/admin/prices/quantities', {
      method: 'POST',
      body: {
        sku_id: ids.piece,
        min_quantity: 50,
        price: 80,
        status: 'ACTIVE',
      },
    });
    await api('/admin/prices/quantities', {
      method: 'POST',
      body: {
        sku_id: ids.weight,
        min_quantity: 100,
        price: 180,
        status: 'ACTIVE',
      },
    });

    const customerPrice = await api('/admin/prices/calculate', {
      method: 'POST',
      body: {
        sku_id: ids.piece,
        customer_id: ids.customer,
        purchase_quantity: 10,
      },
    });
    assert.equal(customerPrice.data.base_price, '100.0000');
    assert.equal(customerPrice.data.level_price, '90.0000');
    assert.equal(customerPrice.data.customer_price, '85.0000');
    assert.equal(customerPrice.data.final_unit_price, '85.0000');
    assert.equal(customerPrice.data.price_source, 'CUSTOMER');

    const tierPrice = await api('/admin/prices/calculate', {
      method: 'POST',
      body: {
        sku_id: ids.piece,
        customer_id: ids.customer,
        purchase_quantity: 50,
      },
    });
    assert.equal(tierPrice.data.quantity_price, '80.0000');
    assert.equal(tierPrice.data.final_unit_price, '80.0000');
    assert.equal(tierPrice.data.price_source, 'QUANTITY');

    const weightPrice = await api('/admin/prices/calculate', {
      method: 'POST',
      body: { sku_id: ids.weight, purchase_quantity: 120 },
    });
    assert.equal(weightPrice.data.final_unit_price, '180.0000');
    assert.equal(weightPrice.data.price_unit, '件');
    await api('/admin/prices/calculate', {
      method: 'POST',
      body: { sku_id: ids.piece, purchase_quantity: 1.5 },
      expected: 400,
    });

    const product = await api(`/admin/products/${ids.product}`);
    assert.equal(product.data.skus.length, 2);
    assert.ok(product.data.skus.every((sku) => sku.grade === '标准级'));
    const catalogFilters = await api(
      `/catalog/filters?category_id=${ids.child}`,
    );
    assert.ok(catalogFilters.data.levels.includes('标准级'));
    assert.equal(
      product.data.skus.find((sku) => sku.sale_type === 'PIECE').inventory
        .stock_unit,
      '箱',
    );
    assert.equal(
      product.data.skus.find((sku) => sku.sale_type === 'WEIGHT').inventory
        .stock_unit,
      '斤',
    );
    await api(`/admin/categories/${ids.child}`, {
      method: 'DELETE',
      expected: 409,
    });
    const auditLogs = await api('/admin/operation-logs?page_size=100');
    const auditModules = new Set(
      auditLogs.data.items.map((item) => item.module_code),
    );
    assert.ok(auditModules.has('PRICE'));
    assert.ok(auditModules.has('INVENTORY'));
    assert.ok(
      auditLogs.data.items.some(
        (item) => item.before_data !== null && item.after_data !== null,
      ),
    );

    console.log(
      JSON.stringify({
        category_tree: 'PASS',
        spu_sku_relation: 'PASS',
        mixed_sale_types: 'PASS',
        catalog_grade_filter: 'PASS',
        inventory_units: 'PASS',
        price_priority: 'PASS',
        validation: 'PASS',
        price_inventory_audit: 'PASS',
      }),
    );
  } finally {
    try {
      if (ids.tenant) {
        await database.query(
          "DELETE FROM operation_logs WHERE tenant_id = ? AND operator_name = '阶段5-B测试管理员'",
          [ids.tenant],
        );
        if (ids.product) {
          const skuIds = [ids.piece ?? '0', ids.weight ?? '0'];
          await database.query(
            'DELETE FROM quantity_prices WHERE tenant_id = ? AND sku_id IN (?, ?)',
            [ids.tenant, ...skuIds],
          );
          await database.query(
            'DELETE FROM customer_prices WHERE tenant_id = ? AND sku_id IN (?, ?)',
            [ids.tenant, ...skuIds],
          );
          await database.query(
            'DELETE FROM price_levels WHERE tenant_id = ? AND sku_id IN (?, ?)',
            [ids.tenant, ...skuIds],
          );
          await database.query(
            'DELETE FROM inventory_logs WHERE tenant_id = ? AND sku_id IN (?, ?)',
            [ids.tenant, ...skuIds],
          );
          await database.query(
            'DELETE FROM inventory WHERE tenant_id = ? AND sku_id IN (?, ?)',
            [ids.tenant, ...skuIds],
          );
          await database.query(
            'DELETE FROM skus WHERE tenant_id = ? AND product_id = ?',
            [ids.tenant, ids.product],
          );
          await database.query(
            'DELETE FROM product_media WHERE tenant_id = ? AND product_id = ?',
            [ids.tenant, ids.product],
          );
          await database.query(
            'DELETE FROM products WHERE tenant_id = ? AND id = ?',
            [ids.tenant, ids.product],
          );
        }
        if (ids.customer) {
          await database.query(
            'DELETE FROM customers WHERE tenant_id = ? AND id = ?',
            [ids.tenant, ids.customer],
          );
        }
        if (ids.child) {
          await database.query(
            'DELETE FROM categories WHERE tenant_id = ? AND id = ?',
            [ids.tenant, ids.child],
          );
        }
        if (ids.root) {
          await database.query(
            'DELETE FROM categories WHERE tenant_id = ? AND id = ?',
            [ids.tenant, ids.root],
          );
        }
        if (ids.user) {
          await database.query(
            'DELETE FROM users WHERE tenant_id = ? AND id = ?',
            [ids.tenant, ids.user],
          );
        }
      }
    } finally {
      await database.end();
    }
  }
}

await main();
