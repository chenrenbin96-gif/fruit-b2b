import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { hash } from 'bcryptjs';
import { config } from 'dotenv';
import mysql from 'mysql2/promise';
import sharp from 'sharp';

config({ path: '../../.env', quiet: true });
const base = process.env.TEST_API_BASE_URL ?? 'http://127.0.0.1:8080/api/v1';
const suffix = Date.now().toString().slice(-8);
const password = `Media_${suffix}!`;

async function api(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : options.form,
  });
  const body = response.headers.get('content-type')?.includes('json')
    ? await response.json()
    : await response.arrayBuffer();
  assert.equal(response.status, options.expected ?? 200, JSON.stringify(body));
  return body.data ?? body;
}

async function login(username) {
  return (await api('/auth/employee/login', {
    method: 'POST',
    body: { tenant_code: 'DEFAULT', username, password },
    expected: 201,
  })).access_token;
}

const db = await mysql.createConnection(process.env.DATABASE_URL);
const ids = { users: [], media: [], descriptions: [] };
try {
  const [[tenant]] = await db.query(
    "SELECT id FROM tenants WHERE tenant_code = 'DEFAULT'",
  );
  ids.tenant = String(tenant.id);
  const [[category]] = await db.query(
    'SELECT id FROM categories WHERE tenant_id = ? AND parent_id IS NOT NULL LIMIT 1',
    [ids.tenant],
  );
  const [product] = await db.execute(
    "INSERT INTO products (tenant_id, category_id, product_code, name, status) VALUES (?, ?, ?, ?, 'DRAFT')",
    [ids.tenant, String(category.id), `MEDIA${suffix}`, `媒体测试商品${suffix}`],
  );
  ids.product = String(product.insertId);
  const passwordHash = await hash(password, 4);
  const [roles] = await db.query(
    "SELECT id, role_code FROM roles WHERE tenant_id = ? AND role_code IN ('ADMIN','PURCHASER','OPERATIONS','FINANCE','WAREHOUSE')",
    [ids.tenant],
  );
  const [[warehouse]] = await db.query(
    'SELECT id, store_id FROM warehouses WHERE tenant_id = ? LIMIT 1',
    [ids.tenant],
  );
  const tokens = {};
  for (const role of roles) {
    const username = `${role.role_code.toLowerCase()}_media_${suffix}`;
    const [user] = await db.execute(
      "INSERT INTO users (tenant_id, username, password_hash, name, role_id, store_id, warehouse_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')",
      [
        ids.tenant, username, passwordHash, `${role.role_code}媒体测试`,
        String(role.id), String(warehouse.store_id), String(warehouse.id),
      ],
    );
    ids.users.push(String(user.insertId));
    tokens[role.role_code] = await login(username);
  }

  const imageBuffer = await sharp({
    create: { width: 160, height: 160, channels: 3, background: '#f9c800' },
  }).png().toBuffer();
  const invalidImageForm = new FormData();
  invalidImageForm.append(
    'file',
    new Blob(['not-an-image'], { type: 'text/plain' }),
    'invalid.txt',
  );
  await api('/admin/upload/image', {
    method: 'POST', token: tokens.ADMIN, form: invalidImageForm, expected: 400,
  });
  const invalidVideoForm = new FormData();
  invalidVideoForm.append(
    'file',
    new Blob(['not-a-video'], { type: 'video/avi' }),
    'invalid.avi',
  );
  await api('/admin/upload/video', {
    method: 'POST', token: tokens.ADMIN, form: invalidVideoForm, expected: 400,
  });

  const imageForm = new FormData();
  imageForm.append('file', new Blob([imageBuffer], { type: 'image/png' }), 'fruit.png');
  const uploadedImage = await api('/admin/upload/image', {
    method: 'POST', token: tokens.ADMIN, form: imageForm, expected: 201,
  });
  assert.match(uploadedImage.url, /^\/uploads\/products\//);
  assert.match(uploadedImage.thumbnail_url, /^\/uploads\/products\//);

  const batchForm = new FormData();
  for (let index = 0; index < 6; index += 1) {
    batchForm.append(
      'files[]',
      new Blob([imageBuffer], { type: 'image/png' }),
      `fruit-${index}.png`,
    );
  }
  const uploadedImages = await api('/admin/upload/images', {
    method: 'POST', token: tokens.ADMIN, form: batchForm, expected: 201,
  });
  assert.equal(uploadedImages.length, 6);
  const oversizedBatchForm = new FormData();
  for (let index = 0; index < 7; index += 1) {
    oversizedBatchForm.append(
      'files[]',
      new Blob([imageBuffer], { type: 'image/png' }),
      `too-many-${index}.png`,
    );
  }
  await api('/admin/upload/images', {
    method: 'POST', token: tokens.ADMIN, form: oversizedBatchForm, expected: 400,
  });

  for (let sort = 0; sort < 6; sort += 1) {
    const row = await api(`/admin/products/${ids.product}/media`, {
      method: 'POST', token: tokens.ADMIN, expected: 201,
      body: {
        media_type: 'IMAGE',
        url: uploadedImages[sort].url,
        thumbnail_url: uploadedImages[sort].thumbnail_url,
        sort,
      },
    });
    ids.media.push(row.id);
  }
  await api(`/admin/products/${ids.product}/media`, {
    method: 'POST', token: tokens.ADMIN, expected: 400,
    body: { media_type: 'IMAGE', url: uploadedImage.url, sort: 7 },
  });

  const videoPath = process.env.TEST_VIDEO_PATH;
  let uploadedVideo = {
    url: '/uploads/products/test.mp4',
    thumbnail_url: uploadedImage.thumbnail_url,
  };
  if (videoPath) {
    const videoForm = new FormData();
    videoForm.append(
      'file',
      new Blob([await readFile(videoPath)], { type: 'video/mp4' }),
      'origin.mp4',
    );
    uploadedVideo = await api('/admin/upload/video', {
      method: 'POST', token: tokens.ADMIN, form: videoForm, expected: 201,
    });
    assert.ok(Number(uploadedVideo.duration) > 0);
  }
  const video = await api(`/admin/products/${ids.product}/media`, {
    method: 'POST', token: tokens.ADMIN, expected: 201,
    body: {
      media_type: 'VIDEO',
      url: uploadedVideo.url,
      thumbnail_url: uploadedVideo.thumbnail_url,
      sort: 0,
    },
  });
  ids.media.push(video.id);
  await api(`/admin/products/${ids.product}/media`, {
    method: 'POST', token: tokens.ADMIN, expected: 400,
    body: { media_type: 'VIDEO', url: uploadedVideo.url, sort: 1 },
  });

  for (const role of ['PURCHASER', 'OPERATIONS']) {
    const roleForm = new FormData();
    roleForm.append(
      'file',
      new Blob([imageBuffer], { type: 'image/png' }),
      `${role.toLowerCase()}.png`,
    );
    const roleUpload = await api('/admin/upload/image', {
      method: 'POST', token: tokens[role], form: roleForm, expected: 201,
    });
    assert.match(roleUpload.url, /^\/uploads\/products\//);
    if (role === 'OPERATIONS') uploadedImage.operations_url = roleUpload.url;
  }

  await api(`/admin/products/${ids.product}/media/${ids.media.shift()}`, {
    method: 'DELETE', token: tokens.ADMIN,
  });
  const operationsMedia = await api(`/admin/products/${ids.product}/media`, {
    method: 'POST', token: tokens.OPERATIONS, expected: 201,
    body: {
      media_type: 'IMAGE',
      url: uploadedImage.operations_url,
      sort: 5,
    },
  });
  ids.media.push(operationsMedia.id);

  for (const role of ['FINANCE', 'WAREHOUSE']) {
    await api(`/admin/products/${ids.product}/media`, {
      token: tokens[role], expected: 403,
    });
    const forbiddenForm = new FormData();
    forbiddenForm.append(
      'file',
      new Blob([imageBuffer], { type: 'image/png' }),
      'forbidden.png',
    );
    await api('/admin/upload/image', {
      method: 'POST', token: tokens[role], form: forbiddenForm, expected: 403,
    });
  }
  const textDescription = await api(
    `/admin/products/${ids.product}/descriptions`,
    {
      method: 'POST',
      token: tokens.ADMIN,
      expected: 201,
      body: {
        content_json: { type: 'TEXT', text: '产地直采，冷链储存。' },
        sort: 0,
      },
    },
  );
  ids.descriptions.push(textDescription.id);
  const updatedDescription = await api(
    `/admin/products/${ids.product}/descriptions/${textDescription.id}`,
    {
      method: 'PUT',
      token: tokens.PURCHASER,
      body: {
        content_json: { type: 'TEXT', text: '产地直采，建议冷链储存。' },
        sort: 0,
      },
    },
  );
  assert.equal(updatedDescription.content_json.type, 'TEXT');
  const imageDescription = await api(
    `/admin/products/${ids.product}/descriptions`,
    {
      method: 'POST',
      token: tokens.OPERATIONS,
      expected: 201,
      body: {
        content_json: { type: 'IMAGE', url: uploadedImage.url },
        sort: 1,
      },
    },
  );
  ids.descriptions.push(imageDescription.id);
  const descriptions = await api(
    `/admin/products/${ids.product}/descriptions`,
    { token: tokens.OPERATIONS },
  );
  assert.deepEqual(
    descriptions.map((item) => item.content_json.type),
    ['TEXT', 'IMAGE'],
  );
  for (const role of ['FINANCE', 'WAREHOUSE']) {
    await api(`/admin/products/${ids.product}/descriptions`, {
      token: tokens[role],
      expected: 403,
    });
  }
  await api('/admin/products', { token: tokens.FINANCE, expected: 403 });
  await api('/admin/finance/receivables?page_size=10', {
    token: tokens.FINANCE,
  });
  const report = await api('/admin/finance/reports?period=MONTH', {
    token: tokens.FINANCE,
  });
  assert.equal(report.period, 'MONTH');

  await api(`/admin/products/${ids.product}/media/${ids.media[0]}`, {
    method: 'DELETE', token: tokens.OPERATIONS,
  });
  const afterDelete = await api(`/admin/products/${ids.product}/media`, {
    token: tokens.PURCHASER,
  });
  assert.equal(afterDelete.length, 6);
  console.log(JSON.stringify({
    image_upload_and_thumbnail: 'PASS',
    media_type_validation: 'PASS',
    six_image_batch_upload: 'PASS',
    batch_request_limit: 'PASS',
    video_upload_and_cover: videoPath ? 'PASS' : 'SKIPPED',
    six_image_limit: 'PASS',
    one_video_limit: 'PASS',
    delete_immediate_sync: 'PASS',
    purchaser_manage: 'PASS',
    operations_manage: 'PASS',
    product_description_nodes: 'PASS',
    product_description_permissions: 'PASS',
    finance_warehouse_forbidden: 'PASS',
    finance_report: 'PASS',
  }));
} finally {
  if (ids.product) {
    await db.query('DELETE FROM product_descriptions WHERE product_id = ?', [ids.product]);
    await db.query('DELETE FROM product_media WHERE product_id = ?', [ids.product]);
    await db.query('DELETE FROM products WHERE id = ?', [ids.product]);
  }
  if (ids.users.length) {
    await db.query(`DELETE FROM users WHERE id IN (${ids.users.map(() => '?').join(',')})`, ids.users);
  }
  await db.end();
}
