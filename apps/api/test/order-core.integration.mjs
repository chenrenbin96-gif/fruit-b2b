import assert from 'node:assert/strict';

import { hash } from 'bcryptjs';
import { config } from 'dotenv';
import Redis from 'ioredis';
import mysql from 'mysql2/promise';

config({ path: '../../.env', quiet: true });

const baseUrl =
  process.env.TEST_API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1';
const suffix = Date.now().toString().slice(-8);
const tenantCode = process.env.BOOTSTRAP_TENANT_CODE ?? 'DEFAULT';
const ids = {};
let customerToken = '';
let warehouseToken = '';
let deliveryToken = '';
let adminToken = '';

async function verificationCode(tenantId, phone, response) {
  if (response.data.debug_code) return response.data.debug_code;
  const redis = new Redis(process.env.REDIS_URL);
  try {
    const keys = await redis.keys(`*auth:customer-code:${tenantId}:${phone}`);
    assert.equal(keys.length, 1, 'verification code must exist in test Redis');
    const value = await redis.get(
      keys[0].replace(process.env.REDIS_KEY_PREFIX ?? '', ''),
    );
    assert.ok(value, 'verification code must be readable in test environment');
    return value;
  } finally {
    await redis.quit();
  }
}

async function api(path, options = {}) {
  const token = options.token ?? customerToken;
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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

async function employeeLogin(username, password) {
  const response = await api('/auth/employee/login', {
    method: 'POST',
    token: '',
    body: {
      tenant_code: tenantCode,
      username,
      password,
    },
  });
  return response.data.access_token;
}

async function main() {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');
  const database = await mysql.createConnection(process.env.DATABASE_URL);
  const warehouseUsername = `warehouse_${suffix}`;
  const deliveryUsername = `delivery_${suffix}`;
  const employeePassword = `Stage5C_${suffix}!`;
  const customerPhone = `138${suffix}`.slice(0, 11);

  try {
    const [tenants] = await database.query(
      'SELECT id FROM tenants WHERE tenant_code = ?',
      [tenantCode],
    );
    ids.tenant = String(tenants[0].id);
    const [warehouses] = await database.query(
      'SELECT id, store_id FROM warehouses WHERE tenant_id = ? ORDER BY id LIMIT 1',
      [ids.tenant],
    );
    ids.warehouse = String(warehouses[0].id);
    const [roles] = await database.query(
      "SELECT id, role_code FROM roles WHERE tenant_id = ? AND role_code IN ('ADMIN', 'WAREHOUSE', 'DELIVERY')",
      [ids.tenant],
    );
    const roleMap = Object.fromEntries(
      roles.map((role) => [role.role_code, String(role.id)]),
    );
    const passwordHash = await hash(employeePassword, 4);
    const [warehouseUser] = await database.execute(
      "INSERT INTO users (tenant_id, username, password_hash, name, role_id, store_id, warehouse_id, status) VALUES (?, ?, ?, '测试仓库员工', ?, ?, ?, 'ACTIVE')",
      [
        ids.tenant,
        warehouseUsername,
        passwordHash,
        roleMap.WAREHOUSE,
        String(warehouses[0].store_id),
        ids.warehouse,
      ],
    );
    ids.warehouseUser = String(warehouseUser.insertId);
    const [deliveryUser] = await database.execute(
      "INSERT INTO users (tenant_id, username, password_hash, name, role_id, store_id, warehouse_id, status) VALUES (?, ?, ?, '测试配送员工', ?, ?, ?, 'ACTIVE')",
      [
        ids.tenant,
        deliveryUsername,
        passwordHash,
        roleMap.DELIVERY,
        String(warehouses[0].store_id),
        ids.warehouse,
      ],
    );
    ids.deliveryUser = String(deliveryUser.insertId);
    const [adminUser] = await database.execute(
      "INSERT INTO users (tenant_id, username, password_hash, name, role_id, store_id, warehouse_id, status) VALUES (?, ?, ?, '测试管理员', ?, ?, ?, 'ACTIVE')",
      [
        ids.tenant,
        `admin_${suffix}`,
        passwordHash,
        roleMap.ADMIN,
        String(warehouses[0].store_id),
        ids.warehouse,
      ],
    );
    ids.adminUser = String(adminUser.insertId);
    ids.adminUsername = `admin_${suffix}`;

    const [levels] = await database.query(
      "SELECT id FROM customer_levels WHERE tenant_id = ? AND level_code = 'NORMAL'",
      [ids.tenant],
    );
    ids.level = String(levels[0].id);
    const [customer] = await database.execute(
      "INSERT INTO customers (tenant_id, customer_no, customer_name, contact_name, phone, address, business_type, level_id, status) VALUES (?, ?, ?, '采购员', ?, '测试地址', 'FRUIT_RETAIL', ?, 'ACTIVE')",
      [
        ids.tenant,
        `OC${suffix}`,
        `订单测试客户${suffix}`,
        customerPhone,
        ids.level,
      ],
    );
    ids.customer = String(customer.insertId);
    const [account] = await database.execute(
      "INSERT INTO customer_accounts (tenant_id, customer_id, account_name, phone, is_primary, status) VALUES (?, ?, '测试采购账号', ?, 1, 'ACTIVE')",
      [ids.tenant, ids.customer, customerPhone],
    );
    ids.customerAccount = String(account.insertId);

    const [root] = await database.execute(
      "INSERT INTO categories (tenant_id, name, sort, status) VALUES (?, ?, 1, 'ACTIVE')",
      [ids.tenant, `订单测试水果${suffix}`],
    );
    ids.root = String(root.insertId);
    const [child] = await database.execute(
      "INSERT INTO categories (tenant_id, parent_id, name, sort, status) VALUES (?, ?, ?, 1, 'ACTIVE')",
      [ids.tenant, ids.root, `订单测试苹果${suffix}`],
    );
    ids.child = String(child.insertId);
    const [product] = await database.execute(
      "INSERT INTO products (tenant_id, category_id, product_code, name, origin, status) VALUES (?, ?, ?, ?, '测试产地', 'ON_SALE')",
      [ids.tenant, ids.child, `OP${suffix}`, `订单测试商品${suffix}`],
    );
    ids.product = String(product.insertId);
    const [pieceSku] = await database.execute(
      "INSERT INTO skus (tenant_id, product_id, sku_code, sku_name, sale_type, piece_unit, stock_unit, price_unit, delivery_weight_per_piece, delivery_weight_unit, cost_price, base_price, stock_warning, status) VALUES (?, ?, ?, '整箱', 'PIECE', '箱', '箱', '箱', 10, '公斤', 70, 100, 5, 'ACTIVE')",
      [ids.tenant, ids.product, `OPB${suffix}`],
    );
    ids.pieceSku = String(pieceSku.insertId);
    const [exactPieceSku] = await database.execute(
      "INSERT INTO skus (tenant_id, product_id, sku_code, sku_name, sale_type, piece_unit, stock_unit, price_unit, delivery_weight_per_piece, delivery_weight_unit, cost_price, base_price, stock_warning, status) VALUES (?, ?, ?, '百元整箱', 'PIECE', '箱', '箱', '箱', 10, '公斤', 70, 100, 5, 'ACTIVE')",
      [ids.tenant, ids.product, `OPE${suffix}`],
    );
    ids.exactPieceSku = String(exactPieceSku.insertId);
    const [weightSku] = await database.execute(
      "INSERT INTO skus (tenant_id, product_id, sku_code, sku_name, sale_type, piece_unit, weight_unit, stock_unit, price_unit, standard_weight, weight_price_type, gross_weight_unit_price, net_weight_unit_price, cost_price, base_price, stock_warning, status) VALUES (?, ?, ?, '30斤装', 'WEIGHT', '件', '斤', '斤', '件', 30, 'ACTUAL_WEIGHT', 20, 21, 12, 600, 20, 'ACTIVE')",
      [ids.tenant, ids.product, `OPW${suffix}`],
    );
    ids.weightSku = String(weightSku.insertId);
    await database.execute(
      "INSERT INTO inventory (tenant_id, warehouse_id, sku_id, stock_unit, stock_quantity, locked_quantity, cost_price) VALUES (?, ?, ?, '箱', 100, 0, 70), (?, ?, ?, '箱', 100, 0, 70), (?, ?, ?, '斤', 500, 0, 12)",
      [
        ids.tenant,
        ids.warehouse,
        ids.pieceSku,
        ids.tenant,
        ids.warehouse,
        ids.exactPieceSku,
        ids.tenant,
        ids.warehouse,
        ids.weightSku,
      ],
    );
    await database.execute(
      "INSERT INTO customer_prices (tenant_id, customer_id, sku_id, price, status) VALUES (?, ?, ?, 90, 'ACTIVE')",
      [ids.tenant, ids.customer, ids.pieceSku],
    );
    warehouseToken = await employeeLogin(
      warehouseUsername,
      employeePassword,
    );
    deliveryToken = await employeeLogin(deliveryUsername, employeePassword);
    adminToken = await employeeLogin(ids.adminUsername, employeePassword);
    const codeResponse = await api('/auth/customer/verification-code', {
      method: 'POST',
      token: '',
      body: { tenant_code: tenantCode, phone: customerPhone },
    });
    const customerCode = await verificationCode(
      ids.tenant,
      customerPhone,
      codeResponse,
    );
    const customerLogin = await api('/auth/customer/login', {
      method: 'POST',
      token: '',
      body: {
        tenant_code: tenantCode,
        phone: customerPhone,
        verification_code: customerCode,
      },
    });
    customerToken = customerLogin.data.access_token;
    const deliveryRegions = await api('/shipping/regions');
    assert.ok(deliveryRegions.data.length > 0);
    const updatedProfile = await api('/customers/me', {
      method: 'PATCH',
      body: {
        customer_name: `订单测试门店${suffix}`,
        contact_name: '采购负责人',
        address: '上海市城区阶段7-E采购测试地址',
        delivery_region_id: deliveryRegions.data[0].id,
      },
    });
    assert.equal(updatedProfile.data.contact_name, '采购负责人');
    assert.equal(
      updatedProfile.data.delivery_region.id,
      deliveryRegions.data[0].id,
    );
    await api('/admin/shipping/rules', {
      token: customerToken,
      expected: 403,
    });

    const couponWindow = {
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() + 30 * 86400000).toISOString(),
      total_limit: 10,
      per_customer_limit: 1,
      status: 'ACTIVE',
      product_ids: [],
      category_ids: [],
      level_ids: [],
    };
    const invalidCoupon = await api('/admin/coupons', {
      method: 'POST',
      token: adminToken,
      body: {
        ...couponWindow,
        name: '称重门槛复核券',
        coupon_type: 'ORDER_REDUCTION',
        discount_amount: 100,
        min_amount: 500,
      },
    });
    ids.invalidCoupon = invalidCoupon.data.id;
    await api(`/admin/coupons/${ids.invalidCoupon}/issue`, {
      method: 'POST',
      token: adminToken,
      body: { customer_ids: [ids.customer] },
    });
    const validCoupon = await api('/admin/coupons', {
      method: 'POST',
      token: adminToken,
      body: {
        ...couponWindow,
        name: '按件履约券',
        coupon_type: 'ORDER_REDUCTION',
        discount_amount: 20,
        min_amount: 100,
      },
    });
    ids.validCoupon = validCoupon.data.id;
    await api(`/admin/coupons/${ids.validCoupon}/issue`, {
      method: 'POST',
      token: adminToken,
      body: { customer_ids: [ids.customer] },
    });
    const ownedCoupons = await api('/coupons');
    ids.invalidCustomerCoupon = ownedCoupons.data.find(
      (item) => item.coupon.id === ids.invalidCoupon,
    ).id;
    ids.validCustomerCoupon = ownedCoupons.data.find(
      (item) => item.coupon.id === ids.validCoupon,
    ).id;
    const shippingRules = await api('/admin/shipping/rules', {
      token: adminToken,
    });
    assert.equal(shippingRules.data[0].price_per_weight, '1.0000');

    let exactCart = await api('/purchase-cart/items', {
      method: 'POST',
      body: { sku_id: ids.exactPieceSku, quantity: 3 },
    });
    assert.equal(exactCart.data.summary.estimated_product_amount, '300.00');
    assert.equal(exactCart.data.first_order_check.passed, false);
    const exactRejected = await api('/purchase-cart/submit', {
      method: 'POST',
      body: {},
      expected: 400,
    });
    assert.equal(exactRejected.code, 'FIRST_ORDER_AMOUNT_NOT_REACHED');
    exactCart = await api(
      `/purchase-cart/items/${exactCart.data.items[0].id}`,
      {
        method: 'PATCH',
        body: { quantity: 6 },
      },
    );
    assert.equal(exactCart.data.summary.estimated_product_amount, '600.00');
    assert.equal(exactCart.data.first_order_check.passed, true);
    const exactOrder = await api('/purchase-cart/submit', {
      method: 'POST',
      body: { remark: '精确首单门槛回归测试' },
    });
    ids.exactOrder = exactOrder.data.id;
    assert.equal(exactOrder.data.estimated_product_amount, '600.00');
    assert.equal(exactOrder.data.shipping_fee, '120.00');
    assert.equal(exactOrder.data.estimated_amount, '720.00');
    await api(`/orders/${ids.exactOrder}/cancel`, {
      method: 'POST',
      body: { reason: '首单回归测试完成后取消' },
    });

    const hundredJinCart = await api('/purchase-cart/items', {
      method: 'POST',
      body: { sku_id: ids.weightSku, quantity: 1 },
    });
    assert.equal(
      hundredJinCart.data.summary.estimated_product_amount,
      '600.00',
    );
    assert.equal(hundredJinCart.data.summary.estimated_weight, '30.000');
    assert.equal(hundredJinCart.data.summary.estimated_shipping_fee, '30.00');
    const hundredJinOrder = await api('/purchase-cart/submit', {
      method: 'POST',
      body: { remark: '100斤预计运费回归测试' },
    });
    ids.hundredJinOrder = hundredJinOrder.data.id;
    assert.equal(hundredJinOrder.data.shipping_fee, '30.00');
    const [hundredJinShipping] = await database.query(
      'SELECT estimated_weight, actual_weight, weight_unit, shipping_fee, status FROM shipping_records WHERE order_id = ?',
      [ids.hundredJinOrder],
    );
    assert.equal(hundredJinShipping[0].estimated_weight, '30.000');
    assert.equal(hundredJinShipping[0].actual_weight, null);
    assert.equal(hundredJinShipping[0].weight_unit, '斤');
    assert.equal(hundredJinShipping[0].shipping_fee, '30.00');
    assert.equal(hundredJinShipping[0].status, 'PENDING_CALCULATION');
    await api(`/orders/${ids.hundredJinOrder}/cancel`, {
      method: 'POST',
      body: { reason: '100斤运费回归测试完成后取消' },
    });

    let cart = await api('/purchase-cart/items', {
      method: 'POST',
      body: { sku_id: ids.pieceSku, quantity: 6 },
    });
    let cartWithTemporaryItem = await api('/purchase-cart/items', {
      method: 'POST',
      body: { sku_id: ids.weightSku, quantity: 1 },
    });
    const temporaryWeightItem = cartWithTemporaryItem.data.items.find(
      (item) => item.sku_id === ids.weightSku,
    );
    assert.ok(temporaryWeightItem);
    cartWithTemporaryItem = await api(
      `/purchase-cart/items/${temporaryWeightItem.id}`,
      { method: 'DELETE' },
    );
    assert.equal(cartWithTemporaryItem.data.items.length, 1);
    await api('/purchase-cart/items', {
      method: 'POST',
      body: { sku_id: ids.weightSku, quantity: 1 },
    });
    const clearedCart = await api('/purchase-cart/items', {
      method: 'DELETE',
    });
    assert.equal(clearedCart.data.items.length, 0);
    cart = await api('/purchase-cart/items', {
      method: 'POST',
      body: { sku_id: ids.pieceSku, quantity: 1 },
    });
    assert.equal(cart.data.items[0].unit_price, '90.0000');
    assert.equal(cart.data.summary.estimated_product_amount, '90.00');
    assert.equal(cart.data.summary.estimated_shipping_fee, '20.00');
    assert.equal(cart.data.summary.estimated_amount, '110.00');
    assert.equal(cart.data.first_order_check.passed, false);
    await api('/purchase-cart/submit', {
      method: 'POST',
      body: {},
      expected: 400,
    });
    let [stock] = await database.query(
      'SELECT locked_quantity FROM inventory WHERE sku_id = ?',
      [ids.pieceSku],
    );
    assert.equal(Number(stock[0].locked_quantity), 0);

    cart = await api(`/purchase-cart/items/${cart.data.items[0].id}`, {
      method: 'PATCH',
      body: { quantity: 6 },
    });
    assert.equal(cart.data.summary.estimated_product_amount, '540.00');
    assert.equal(cart.data.summary.estimated_shipping_fee, '120.00');
    assert.equal(cart.data.summary.estimated_amount, '660.00');
    const pieceOrder = await api('/purchase-cart/submit', {
      method: 'POST',
      body: {
        remark: '按件首单测试',
        customer_coupon_id: ids.invalidCustomerCoupon,
      },
    });
    ids.pieceOrder = pieceOrder.data.id;
    assert.equal(pieceOrder.data.status, 'WAITING_REVIEW');
    assert.equal(pieceOrder.data.items[0].unit_price, '90.0000');
    assert.equal(pieceOrder.data.final_amount, null);
    assert.equal(pieceOrder.data.shipping_fee, '120.00');
    assert.equal(pieceOrder.data.shipping_status, 'PENDING_CALCULATION');
    assert.equal(pieceOrder.data.delivery_status, null);
    assert.deepEqual(pieceOrder.data.tracking_logs, []);
    assert.ok(Array.isArray(pieceOrder.data.delivery_progress));
    const [pieceShipping] = await database.query(
      'SELECT actual_weight, shipping_fee, status FROM shipping_records WHERE order_id = ?',
      [ids.pieceOrder],
    );
    assert.equal(pieceShipping[0].actual_weight, null);
    assert.equal(pieceShipping[0].shipping_fee, '120.00');
    assert.equal(pieceShipping[0].status, 'PENDING_CALCULATION');
    [stock] = await database.query(
      'SELECT locked_quantity, available_quantity FROM inventory WHERE sku_id = ?',
      [ids.pieceSku],
    );
    assert.equal(Number(stock[0].locked_quantity), 6);
    assert.equal(Number(stock[0].available_quantity), 94);

    await api(`/orders/${ids.pieceOrder}/cancel`, {
      method: 'POST',
      body: { reason: '客户取消测试' },
    });
    [stock] = await database.query(
      'SELECT locked_quantity FROM inventory WHERE sku_id = ?',
      [ids.pieceSku],
    );
    assert.equal(Number(stock[0].locked_quantity), 0);
    const [releasedCoupon] = await database.query(
      'SELECT status FROM customer_coupons WHERE id = ?',
      [ids.invalidCustomerCoupon],
    );
    assert.equal(releasedCoupon[0].status, 'AVAILABLE');

    await api('/purchase-cart/items', {
      method: 'POST',
      body: { sku_id: ids.weightSku, quantity: 1 },
    });
    const weightOrder = await api('/purchase-cart/submit', {
      method: 'POST',
      body: {
        remark: '称重订单测试',
        customer_coupon_id: ids.invalidCustomerCoupon,
      },
    });
    ids.weightOrder = weightOrder.data.id;
    assert.equal(weightOrder.data.items[0].planned_quantity, '1.000');
    assert.equal(weightOrder.data.items[0].planned_weight, '30.000');
    assert.equal(weightOrder.data.final_amount, null);
    assert.equal(weightOrder.data.estimated_discount_amount, '100.00');
    assert.equal(weightOrder.data.estimated_amount, '530.00');
    assert.equal(weightOrder.data.estimated_weight, '15.000');
    assert.equal(weightOrder.data.shipping_fee, '30.00');
    assert.equal(weightOrder.data.shipping_status, 'PENDING_CALCULATION');
    [stock] = await database.query(
      'SELECT locked_quantity FROM inventory WHERE sku_id = ?',
      [ids.weightSku],
    );
    assert.equal(Number(stock[0].locked_quantity), 30);

    await api(`/admin/orders/${ids.weightOrder}/review`, {
      method: 'POST',
      token: customerToken,
      body: { action: 'APPROVE' },
      expected: 403,
    });
    await api(`/admin/orders/${ids.weightOrder}/review`, {
      method: 'POST',
      token: deliveryToken,
      body: { action: 'APPROVE' },
      expected: 403,
    });
    const approved = await api(`/admin/orders/${ids.weightOrder}/review`, {
      method: 'POST',
      token: warehouseToken,
      body: { action: 'APPROVE' },
    });
    assert.equal(approved.data.status, 'APPROVED');
    [stock] = await database.query(
      'SELECT locked_quantity FROM inventory WHERE sku_id = ?',
      [ids.weightSku],
    );
    assert.equal(Number(stock[0].locked_quantity), 30);

    const waitingTask = await api(
      `/admin/warehouse/tasks/${ids.weightOrder}`,
      { token: warehouseToken },
    );
    assert.equal(waitingTask.data.picking_task.status, 'WAITING');
    await api(`/admin/warehouse/tasks/${ids.weightOrder}/picking/start`, {
      method: 'POST',
      token: customerToken,
      body: {},
      expected: 403,
    });
    await api(`/admin/warehouse/tasks/${ids.weightOrder}/picking/start`, {
      method: 'POST',
      token: deliveryToken,
      body: {},
      expected: 403,
    });
    const startedWeightTask = await api(
      `/admin/warehouse/tasks/${ids.weightOrder}/picking/start`,
      {
        method: 'POST',
        token: warehouseToken,
        body: {},
      },
    );
    assert.equal(startedWeightTask.data.picking_task.status, 'PICKING');
    await api(`/admin/warehouse/tasks/${ids.weightOrder}/picking/complete`, {
      method: 'POST',
      token: warehouseToken,
      body: {
        items: startedWeightTask.data.picking_task.items.map((item) => ({
          task_item_id: item.id,
          picked_quantity: Number(item.planned_quantity),
        })),
      },
    });
    const weightDetailBefore = await api(
      `/admin/orders/${ids.weightOrder}`,
      { token: warehouseToken },
    );
    await api(`/admin/orders/${ids.weightOrder}/weighing`, {
      method: 'POST',
      token: warehouseToken,
      body: {
        items: [
          {
            order_item_id: weightDetailBefore.data.items[0].id,
            actual_gross_weight: 20,
            actual_net_weight: 18,
          },
        ],
      },
    });
    const fulfilledWeight = await api(
      `/admin/orders/${ids.weightOrder}`,
      { token: warehouseToken },
    );
    assert.equal(fulfilledWeight.data.status, 'WAITING_DELIVERY');
    assert.equal(fulfilledWeight.data.final_product_amount, '400.00');
    assert.equal(fulfilledWeight.data.discount_amount, '0.00');
    assert.equal(fulfilledWeight.data.shipping_fee, '20.00');
    assert.equal(fulfilledWeight.data.final_amount, '420.00');
    assert.equal(fulfilledWeight.data.amount_adjustment_type, 'REFUND');
    assert.equal(fulfilledWeight.data.amount_adjustment, '200.00');
    assert.equal(fulfilledWeight.data.actual_weight, '10.000');
    assert.equal(fulfilledWeight.data.delivery.status, 'WAITING');
    assert.equal(fulfilledWeight.data.shipping_package.status, 'WAITING');
    ids.weightDelivery = fulfilledWeight.data.delivery.id;
    [stock] = await database.query(
      'SELECT stock_quantity, locked_quantity FROM inventory WHERE sku_id = ?',
      [ids.weightSku],
    );
    assert.equal(Number(stock[0].stock_quantity), 480);
    assert.equal(Number(stock[0].locked_quantity), 0);
    const [invalidatedCoupon] = await database.query(
      'SELECT status FROM customer_coupons WHERE id = ?',
      [ids.invalidCustomerCoupon],
    );
    assert.equal(invalidatedCoupon[0].status, 'AVAILABLE');

    await api(`/admin/deliveries/${ids.weightDelivery}/assignee`, {
      method: 'PUT',
      token: adminToken,
      body: { delivery_person_id: ids.deliveryUser },
    });
    await api(`/admin/warehouse/tasks/${ids.weightOrder}/package/start`, {
      method: 'POST',
      token: warehouseToken,
      body: {},
    });
    await api(`/admin/warehouse/tasks/${ids.weightOrder}/package/complete`, {
      method: 'POST',
      token: warehouseToken,
      body: {},
    });
    const outboundTask = await api(
      `/admin/warehouse/tasks/${ids.weightOrder}/outbound`,
      {
        method: 'POST',
        token: warehouseToken,
        body: {},
      },
    );
    assert.ok(outboundTask.data.package.outbound_at);
    const deliveryTasks = await api('/admin/deliveries', {
      token: deliveryToken,
    });
    assert.ok(
      deliveryTasks.data.items.some(
        (delivery) => delivery.id === ids.weightDelivery,
      ),
    );
    await api(`/admin/deliveries/${ids.weightDelivery}/status`, {
      method: 'POST',
      token: deliveryToken,
      body: { status: 'DELIVERING' },
    });
    await api(`/admin/deliveries/${ids.weightDelivery}/status`, {
      method: 'POST',
      token: deliveryToken,
      body: { status: 'DELIVERED', signed_by: '测试签收人' },
    });
    const completedWeight = await api(`/orders/${ids.weightOrder}`);
    assert.equal(completedWeight.data.status, 'COMPLETED');
    assert.equal(completedWeight.data.delivery.status, 'DELIVERED');
    assert.equal(completedWeight.data.delivery.logs.length, 3);
    assert.equal(completedWeight.data.delivery_status, 'DELIVERED');
    assert.ok(Array.isArray(completedWeight.data.delivery_progress));
    assert.ok(Array.isArray(completedWeight.data.tracking_logs));
    assert.equal(completedWeight.data.tracking_logs.length, 3);
    assert.ok(
      completedWeight.data.fulfillment_progress.every(
        (step) => step.completed,
      ),
    );
    const customerBills = await api('/finance/receivables');
    const weightBill = customerBills.data.items.find(
      (item) => item.order_id === ids.weightOrder,
    );
    assert.ok(weightBill);
    assert.equal(weightBill.final_amount, '420.00');
    assert.equal(weightBill.remaining_amount, '420.00');
    ids.weightReceivable = weightBill.id;
    const accountAfterBill = await api('/finance/summary');
    assert.equal(accountAfterBill.data.balance_due, '420.00');
    await api('/admin/finance/receivables', {
      token: customerToken,
      expected: 403,
    });

    await api('/purchase-cart/items', {
      method: 'POST',
      body: { sku_id: ids.pieceSku, quantity: 6 },
    });
    const laterPreview = await api('/purchase-cart/preview');
    assert.equal(laterPreview.data.first_order_check.is_first_order, false);
    const rejectedOrder = await api('/purchase-cart/submit', {
      method: 'POST',
      body: {},
    });
    ids.rejectedOrder = rejectedOrder.data.id;
    await api(`/admin/orders/${ids.rejectedOrder}/review`, {
      method: 'POST',
      token: warehouseToken,
      body: { action: 'REJECT', reason: '仓库拒绝测试' },
    });
    [stock] = await database.query(
      'SELECT locked_quantity FROM inventory WHERE sku_id = ?',
      [ids.pieceSku],
    );
    assert.equal(Number(stock[0].locked_quantity), 0);

    await api('/purchase-cart/items', {
      method: 'POST',
      body: { sku_id: ids.pieceSku, quantity: 6 },
    });
    const fulfilledPieceOrder = await api('/purchase-cart/submit', {
      method: 'POST',
      body: { customer_coupon_id: ids.validCustomerCoupon },
    });
    ids.fulfilledPieceOrder = fulfilledPieceOrder.data.id;
    assert.equal(fulfilledPieceOrder.data.estimated_discount_amount, '20.00');
    await api(`/admin/orders/${ids.fulfilledPieceOrder}/review`, {
      method: 'POST',
      token: warehouseToken,
      body: { action: 'APPROVE' },
    });
    const startedPieceTask = await api(
      `/admin/warehouse/tasks/${ids.fulfilledPieceOrder}/picking/start`,
      {
        method: 'POST',
        token: warehouseToken,
        body: {},
      },
    );
    await api(
      `/admin/warehouse/tasks/${ids.fulfilledPieceOrder}/picking/complete`,
      {
        method: 'POST',
        token: warehouseToken,
        body: {
          items: startedPieceTask.data.picking_task.items.map((item) => ({
            task_item_id: item.id,
            picked_quantity: Number(item.planned_quantity),
          })),
        },
      },
    );
    const pieceDetail = await api(
      `/admin/orders/${ids.fulfilledPieceOrder}`,
      { token: warehouseToken },
    );
    await api(`/admin/orders/${ids.fulfilledPieceOrder}/weighing`, {
      method: 'POST',
      token: warehouseToken,
      body: {
        items: [
          {
            order_item_id: pieceDetail.data.items[0].id,
            actual_weight: 1,
          },
        ],
      },
      expected: 400,
    });
    await api(`/admin/orders/${ids.fulfilledPieceOrder}/fulfillment/complete`, {
      method: 'POST',
      token: warehouseToken,
      body: {},
    });
    const fulfilledPiece = await api(
      `/admin/orders/${ids.fulfilledPieceOrder}`,
      { token: warehouseToken },
    );
    assert.equal(fulfilledPiece.data.final_product_amount, '540.00');
    assert.equal(fulfilledPiece.data.discount_amount, '20.00');
    assert.equal(fulfilledPiece.data.shipping_fee, '120.00');
    assert.equal(fulfilledPiece.data.final_amount, '640.00');
    ids.failedDelivery = fulfilledPiece.data.delivery.id;
    await api(
      `/admin/warehouse/tasks/${ids.fulfilledPieceOrder}/package/start`,
      { method: 'POST', token: warehouseToken, body: {} },
    );
    await api(
      `/admin/warehouse/tasks/${ids.fulfilledPieceOrder}/package/complete`,
      { method: 'POST', token: warehouseToken, body: {} },
    );
    await api(`/admin/warehouse/tasks/${ids.fulfilledPieceOrder}/outbound`, {
      method: 'POST',
      token: warehouseToken,
      body: {},
    });
    await api(`/admin/deliveries/${ids.failedDelivery}/assignee`, {
      method: 'PUT',
      token: adminToken,
      body: { delivery_person_id: ids.deliveryUser },
    });
    const failedDelivery = await api(
      `/admin/deliveries/${ids.failedDelivery}/status`,
      {
        method: 'POST',
        token: deliveryToken,
        body: {
          status: 'FAILED',
          reason_code: 'UNREACHABLE',
          reason: '集成测试：无法联系客户',
        },
      },
    );
    assert.equal(failedDelivery.data.status, 'FAILED');
    assert.equal(failedDelivery.data.logs.at(-1).reason_code, 'UNREACHABLE');
    const [failedReceivable] = await database.query(
      'SELECT id FROM receivables WHERE order_id = ?',
      [ids.fulfilledPieceOrder],
    );
    assert.equal(failedReceivable.length, 0);
    const [usedCoupon] = await database.query(
      'SELECT status FROM customer_coupons WHERE id = ?',
      [ids.validCustomerCoupon],
    );
    assert.equal(usedCoupon[0].status, 'USED');

    const completed = await api('/orders?group=COMPLETED');
    assert.ok(completed.data.items.some((order) => order.id === ids.weightOrder));
    const adminDetail = await api(`/admin/orders/${ids.weightOrder}`, {
      token: warehouseToken,
    });
    assert.equal(adminDetail.data.items[0].sale_type, 'WEIGHT');

    await api('/admin/finance/payments', {
      method: 'POST',
      token: adminToken,
      body: {
        customer_id: ids.customer,
        amount: 100,
        payment_method: 'BANK_TRANSFER',
        payment_time: new Date().toISOString(),
        remark: '阶段5-E集成测试',
      },
    });
    const accountAfterPayment = await api('/finance/summary');
    assert.equal(accountAfterPayment.data.balance_due, '320.00');
    const paymentRows = await api('/finance/payments');
    assert.ok(paymentRows.data.items.some((item) => item.amount === '100.00'));
    const billAfterPayment = await api('/finance/receivables');
    assert.equal(
      billAfterPayment.data.items.find((item) => item.id === ids.weightReceivable)
        .remaining_amount,
      '320.00',
    );

    await api(`/admin/finance/customers/${ids.customer}/credit`, {
      method: 'PUT',
      token: adminToken,
      body: { credit_limit: 320, credit_days: 30, credit_enabled: true },
    });
    await api('/purchase-cart/items', {
      method: 'POST',
      body: { sku_id: ids.pieceSku, quantity: 6 },
    });
    const creditRejected = await api('/purchase-cart/submit', {
      method: 'POST',
      body: {},
      expected: 400,
    });
    assert.equal(creditRejected.code, 'CUSTOMER_CREDIT_LIMIT_EXCEEDED');
    const auditLogs = await api('/admin/operation-logs?page_size=100', {
      token: adminToken,
    });
    const auditedModules = new Set(
      auditLogs.data.items.map((item) => item.module_code),
    );
    for (const moduleCode of ['COUPON', 'ORDER', 'FULFILLMENT', 'FINANCE']) {
      assert.ok(auditedModules.has(moduleCode), `missing audit module ${moduleCode}`);
    }
    assert.ok(
      auditLogs.data.items.some(
        (item) => item.before_data !== null && item.after_data !== null,
      ),
    );

    const purchasedProducts = await api('/customer/purchased-products');
    assert.ok(
      purchasedProducts.data.some((item) => item.sku_id === ids.weightSku),
    );
    assert.ok(
      purchasedProducts.data.some(
        (item) =>
          item.sku_id === ids.pieceSku &&
          item.purchase_count >= 1 &&
          item.last_unit_price === '90.0000',
      ),
    );
    const frequentProducts = await api('/customer/frequent-products');
    assert.ok(frequentProducts.data.length > 0);
    const purchaseSummary = await api('/customer/purchase-summary');
    assert.ok(purchaseSummary.data.month.purchase_count >= 1);

    await database.query(
      'UPDATE customer_prices SET price = 80 WHERE tenant_id = ? AND customer_id = ? AND sku_id = ?',
      [ids.tenant, ids.customer, ids.pieceSku],
    );
    await api('/purchase-cart/items', { method: 'DELETE' });
    const reordered = await api(
      `/purchase-cart/reorder/${ids.fulfilledPieceOrder}`,
      { method: 'POST' },
    );
    assert.equal(
      reordered.data.items.find((item) => item.sku_id === ids.pieceSku)
        .unit_price,
      '80.0000',
    );
    await api('/purchase-cart/items', { method: 'DELETE' });
    const batchAdded = await api('/cart/batch-add', {
      method: 'POST',
      body: {
        items: [
          { sku_id: ids.pieceSku, quantity: 1 },
          { sku_id: ids.weightSku, quantity: 1 },
        ],
      },
    });
    assert.equal(batchAdded.data.items.length, 2);
    const batchRejected = await api('/cart/batch-add', {
      method: 'POST',
      body: {
        items: [
          { sku_id: ids.pieceSku, quantity: 1 },
          { sku_id: ids.weightSku, quantity: 999999 },
        ],
      },
      expected: 400,
    });
    assert.equal(batchRejected.code, 'INSUFFICIENT_AVAILABLE_STOCK');
    const cartAfterRejectedBatch = await api('/purchase-cart');
    assert.equal(cartAfterRejectedBatch.data.items.length, 2);
    await api('/admin/customer-purchase-analysis', {
      token: customerToken,
      expected: 403,
    });
    const customerAnalysis = await api('/admin/customer-purchase-analysis', {
      token: adminToken,
    });
    assert.ok(
      customerAnalysis.data.some(
        (item) => item.customer_id === ids.customer,
      ),
    );

    console.log(
      JSON.stringify({
        cart_add_update_remove_clear: 'PASS',
        piece_order: 'PASS',
        weight_order: 'PASS',
        customer_price: 'PASS',
        first_order_minimum: 'PASS',
        exact_300_rejected_600_accepted: 'PASS',
        hundred_jin_estimated_shipping: 'PASS',
        inventory_lock: 'PASS',
        customer_cancel_release: 'PASS',
        warehouse_reject_release: 'PASS',
        warehouse_review_permission: 'PASS',
        picking_task_auto_create: 'PASS',
        piece_and_weight_picking: 'PASS',
        weighing_final_amount: 'PASS',
        coupon_revalidation: 'PASS',
        piece_delivery_weight: 'PASS',
        shipping_calculation: 'PASS',
        delivery_status: 'PASS',
        package_outbound: 'PASS',
        delivery_logs: 'PASS',
        failed_delivery_reason: 'PASS',
        customer_fulfillment_tracking: 'PASS',
        miniapp_tracking_compatibility_fields: 'PASS',
        fulfillment_permission: 'PASS',
        receivable_on_completion: 'PASS',
        payment_reduces_balance: 'PASS',
        credit_limit_check: 'PASS',
        customer_finance_scope: 'PASS',
        operation_audit_trail: 'PASS',
        purchased_products: 'PASS',
        frequent_products: 'PASS',
        reorder_current_price: 'PASS',
        batch_add_atomic_inventory_check: 'PASS',
        customer_purchase_analysis_permission: 'PASS',
        customer_profile_update: 'PASS',
        customer_admin_forbidden: 'PASS',
      }),
    );
  } finally {
    try {
      if (ids.tenant) {
        await database.query(
          "DELETE FROM operation_logs WHERE tenant_id = ? AND operator_name IN ('测试管理员','测试仓库员工','测试采购账号')",
          [ids.tenant],
        );
        const orderIds = [
          ids.pieceOrder,
          ids.exactOrder,
          ids.hundredJinOrder,
          ids.weightOrder,
          ids.rejectedOrder,
          ids.fulfilledPieceOrder,
        ].filter(Boolean);
        if (orderIds.length) {
          await database.query(
            `DELETE FROM payment_allocations WHERE receivable_id IN (
              SELECT id FROM receivables WHERE order_id IN (${orderIds.map(() => '?').join(',')})
            )`,
            orderIds,
          );
          await database.query(
            'DELETE FROM payments WHERE customer_id = ?',
            [ids.customer],
          );
          await database.query(
            `DELETE FROM receivables WHERE order_id IN (${orderIds.map(() => '?').join(',')})`,
            orderIds,
          );
          await database.query(
            `DELETE FROM inventory_logs WHERE reference_type = 'ORDER' AND reference_id IN (${orderIds.map(() => '?').join(',')})`,
            orderIds,
          );
          await database.query(
            `DELETE FROM delivery_logs WHERE order_id IN (${orderIds.map(() => '?').join(',')})`,
            orderIds,
          );
          await database.query(
            `DELETE FROM deliveries WHERE order_id IN (${orderIds.map(() => '?').join(',')})`,
            orderIds,
          );
          await database.query(
            `DELETE FROM shipping_packages WHERE order_id IN (${orderIds.map(() => '?').join(',')})`,
            orderIds,
          );
          await database.query(
            `DELETE FROM picking_task_items WHERE task_id IN (
              SELECT id FROM picking_tasks WHERE order_id IN (${orderIds.map(() => '?').join(',')})
            )`,
            orderIds,
          );
          await database.query(
            `DELETE FROM picking_tasks WHERE order_id IN (${orderIds.map(() => '?').join(',')})`,
            orderIds,
          );
          await database.query(
            `DELETE FROM shipping_records WHERE order_id IN (${orderIds.map(() => '?').join(',')})`,
            orderIds,
          );
          await database.query(
            `DELETE FROM coupon_records WHERE order_id IN (${orderIds.map(() => '?').join(',')})`,
            orderIds,
          );
          await database.query(
            `UPDATE orders SET coupon_id = NULL, customer_coupon_id = NULL WHERE id IN (${orderIds.map(() => '?').join(',')})`,
            orderIds,
          );
          await database.query(
            'DELETE FROM customer_coupons WHERE customer_id = ?',
            [ids.customer],
          );
          await database.query(
            `DELETE FROM order_status_logs WHERE order_id IN (${orderIds.map(() => '?').join(',')})`,
            orderIds,
          );
          await database.query(
            `DELETE FROM order_items WHERE order_id IN (${orderIds.map(() => '?').join(',')})`,
            orderIds,
          );
          await database.query(
            `DELETE FROM orders WHERE id IN (${orderIds.map(() => '?').join(',')})`,
            orderIds,
          );
        }
        if (ids.invalidCoupon || ids.validCoupon) {
          const couponIds = [ids.invalidCoupon, ids.validCoupon].filter(Boolean);
          await database.query(
            `DELETE FROM customer_coupons WHERE coupon_id IN (${couponIds.map(() => '?').join(',')})`,
            couponIds,
          );
          await database.query(
            `DELETE FROM coupons WHERE id IN (${couponIds.map(() => '?').join(',')})`,
            couponIds,
          );
        }
        if (ids.customer) {
          await database.query(
            'DELETE FROM purchase_cart_items WHERE tenant_id = ? AND cart_id IN (SELECT id FROM purchase_carts WHERE tenant_id = ? AND customer_id = ?)',
            [ids.tenant, ids.tenant, ids.customer],
          );
          await database.query(
            'DELETE FROM purchase_carts WHERE tenant_id = ? AND customer_id = ?',
            [ids.tenant, ids.customer],
          );
        }
        if (ids.product) {
          await database.query(
            'DELETE FROM customer_prices WHERE tenant_id = ? AND customer_id = ?',
            [ids.tenant, ids.customer],
          );
          await database.query(
            'DELETE FROM inventory WHERE tenant_id = ? AND sku_id IN (?, ?, ?)',
            [
              ids.tenant,
              ids.pieceSku,
              ids.exactPieceSku,
              ids.weightSku,
            ],
          );
          await database.query(
            'DELETE FROM skus WHERE tenant_id = ? AND product_id = ?',
            [ids.tenant, ids.product],
          );
          await database.query(
            'DELETE FROM products WHERE tenant_id = ? AND id = ?',
            [ids.tenant, ids.product],
          );
        }
        if (ids.customerAccount) {
          await database.query(
            'DELETE FROM customer_accounts WHERE id = ?',
            [ids.customerAccount],
          );
        }
        if (ids.customer) {
          await database.query('DELETE FROM customers WHERE id = ?', [
            ids.customer,
          ]);
        }
        if (ids.child) {
          await database.query('DELETE FROM categories WHERE id = ?', [
            ids.child,
          ]);
        }
        if (ids.root) {
          await database.query('DELETE FROM categories WHERE id = ?', [
            ids.root,
          ]);
        }
        if (ids.warehouseUser) {
          await database.query('DELETE FROM users WHERE id = ?', [
            ids.warehouseUser,
          ]);
        }
        if (ids.deliveryUser) {
          await database.query('DELETE FROM users WHERE id = ?', [
            ids.deliveryUser,
          ]);
        }
        if (ids.adminUser) {
          await database.query('DELETE FROM users WHERE id = ?', [
            ids.adminUser,
          ]);
        }
      }
    } finally {
      await database.end();
    }
  }
}

await main();
