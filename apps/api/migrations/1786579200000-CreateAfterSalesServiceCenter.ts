import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAfterSalesServiceCenter1786579200000 implements MigrationInterface {
  name = 'CreateAfterSalesServiceCenter1786579200000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE after_sale_reasons (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, tenant_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(80) NOT NULL, sort INT UNSIGNED NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id), UNIQUE KEY uk_after_sale_reason_name (tenant_id,name),
      KEY idx_after_sale_reason_status (tenant_id,status,sort),
      CONSTRAINT fk_after_sale_reason_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
      CONSTRAINT chk_after_sale_reason_status CHECK (status IN ('ACTIVE','INACTIVE'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await q.query(`CREATE TABLE after_sales_orders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, tenant_id BIGINT UNSIGNED NOT NULL,
      order_id BIGINT UNSIGNED NOT NULL, customer_id BIGINT UNSIGNED NOT NULL,
      after_sale_no VARCHAR(40) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      reason_id BIGINT UNSIGNED NOT NULL, description TEXT NULL,
      refund_amount DECIMAL(14,2) NOT NULL DEFAULT 0, refund_type VARCHAR(20) NOT NULL DEFAULT 'REFUND',
      review_remark VARCHAR(500) NULL, reviewed_by BIGINT UNSIGNED NULL,
      reviewed_at DATETIME(3) NULL, completed_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY(id), UNIQUE KEY uk_after_sales_no (tenant_id,after_sale_no),
      KEY idx_after_sales_customer_status (tenant_id,customer_id,status), KEY idx_after_sales_order (order_id),
      CONSTRAINT fk_after_sales_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
      CONSTRAINT fk_after_sales_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
      CONSTRAINT fk_after_sales_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
      CONSTRAINT fk_after_sales_reason FOREIGN KEY (reason_id) REFERENCES after_sale_reasons(id) ON DELETE RESTRICT,
      CONSTRAINT fk_after_sales_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT chk_after_sales_status CHECK (status IN ('PENDING','APPROVED','REJECTED','PROCESSING','COMPLETED','CANCELLED')),
      CONSTRAINT chk_after_sales_refund_type CHECK (refund_type IN ('REFUND','COMPENSATION'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await q.query(`CREATE TABLE after_sale_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, tenant_id BIGINT UNSIGNED NOT NULL,
      after_sale_id BIGINT UNSIGNED NOT NULL, order_item_id BIGINT UNSIGNED NOT NULL, sku_id BIGINT UNSIGNED NOT NULL,
      quantity DECIMAL(18,3) NULL, approved_quantity DECIMAL(18,3) NULL,
      sale_type VARCHAR(20) NOT NULL, requested_weight DECIMAL(18,3) NULL, approved_weight DECIMAL(18,3) NULL,
      refund_price DECIMAL(14,4) NOT NULL, refund_amount DECIMAL(14,2) NOT NULL,
      PRIMARY KEY(id), UNIQUE KEY uk_after_sale_item (after_sale_id,order_item_id), KEY idx_after_sale_item_order_item(order_item_id),
      CONSTRAINT fk_after_sale_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
      CONSTRAINT fk_after_sale_items_sale FOREIGN KEY (after_sale_id) REFERENCES after_sales_orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_after_sale_items_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE RESTRICT,
      CONSTRAINT fk_after_sale_items_sku FOREIGN KEY (sku_id) REFERENCES skus(id) ON DELETE RESTRICT,
      CONSTRAINT chk_after_sale_items_type CHECK (sale_type IN ('PIECE','WEIGHT'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await q.query(`CREATE TABLE after_sale_media (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, tenant_id BIGINT UNSIGNED NOT NULL,
      after_sale_id BIGINT UNSIGNED NOT NULL, media_type VARCHAR(20) NOT NULL,
      url VARCHAR(1000) NOT NULL, thumbnail_url VARCHAR(1000) NULL, sort INT UNSIGNED NOT NULL DEFAULT 0,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id),
      KEY idx_after_sale_media (after_sale_id,media_type,sort),
      CONSTRAINT fk_after_sale_media_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
      CONSTRAINT fk_after_sale_media_sale FOREIGN KEY (after_sale_id) REFERENCES after_sales_orders(id) ON DELETE CASCADE,
      CONSTRAINT chk_after_sale_media_type CHECK (media_type IN ('VIDEO','IMAGE'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await q.query(`CREATE TABLE after_sale_refunds (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, tenant_id BIGINT UNSIGNED NOT NULL,
      after_sale_id BIGINT UNSIGNED NOT NULL, amount DECIMAL(14,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING', completed_by BIGINT UNSIGNED NULL, completed_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY(id), UNIQUE KEY uk_after_sale_refund(after_sale_id),
      KEY idx_after_sale_refund_status(tenant_id,status),
      CONSTRAINT fk_after_sale_refund_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
      CONSTRAINT fk_after_sale_refund_sale FOREIGN KEY (after_sale_id) REFERENCES after_sales_orders(id) ON DELETE RESTRICT,
      CONSTRAINT fk_after_sale_refund_user FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT chk_after_sale_refund_status CHECK (status IN ('PENDING','COMPLETED'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    await q.query(`INSERT INTO permissions(permission_name,permission_code,module_code,description,status) VALUES
      ('查看售后申请','after.sale.read','after_sale','查看售后申请与凭证','ACTIVE'),
      ('审核售后申请','after.sale.manage','after_sale','审核、驳回并核准售后金额','ACTIVE'),
      ('管理售后原因','after.sale.reason.manage','after_sale','维护售后原因配置','ACTIVE'),
      ('完成售后退款','after.sale.refund.manage','after_sale','确认售后退款完成','ACTIVE')
      ON DUPLICATE KEY UPDATE permission_name=VALUES(permission_name),description=VALUES(description),status='ACTIVE'`);
    await q.query(`INSERT IGNORE INTO role_permissions(tenant_id,role_id,permission_id)
      SELECT r.tenant_id,r.id,p.id FROM roles r JOIN permissions p
      WHERE r.role_code='ADMIN'
        OR (r.role_code='WAREHOUSE' AND p.permission_code='after.sale.read')
        OR (r.role_code='OPERATIONS' AND p.permission_code='after.sale.read')
        OR (r.role_code='FINANCE' AND p.permission_code IN ('after.sale.read','after.sale.refund.manage'))`);
    await q.query(`INSERT INTO after_sale_reasons(tenant_id,name,sort,status)
      SELECT t.id,defaults.name,defaults.sort,'ACTIVE' FROM tenants t JOIN (
        SELECT '缺重量' name,10 sort UNION ALL SELECT '质量问题',20 UNION ALL SELECT '腐烂变质',30
        UNION ALL SELECT '破损',40 UNION ALL SELECT '商品与描述不符',50 UNION ALL SELECT '规格错误',60
        UNION ALL SELECT '少发漏发',70 UNION ALL SELECT '其他',80
      ) defaults ON 1=1 ON DUPLICATE KEY UPDATE sort=VALUES(sort),status='ACTIVE'`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE after_sale_refunds'); await q.query('DROP TABLE after_sale_media'); await q.query('DROP TABLE after_sale_items'); await q.query('DROP TABLE after_sales_orders'); await q.query('DROP TABLE after_sale_reasons');
    await q.query(`DELETE rp FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE p.permission_code IN ('after.sale.read','after.sale.manage','after.sale.reason.manage','after.sale.refund.manage')`);
    await q.query(`DELETE FROM permissions WHERE permission_code IN ('after.sale.read','after.sale.manage','after.sale.reason.manage','after.sale.refund.manage')`);
  }
}
