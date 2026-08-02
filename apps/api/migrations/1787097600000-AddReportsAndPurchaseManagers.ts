import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReportsAndPurchaseManagers1787097600000 implements MigrationInterface {
  name = 'AddReportsAndPurchaseManagers1787097600000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE products
      ADD COLUMN purchase_manager_id BIGINT UNSIGNED NULL AFTER description,
      ADD COLUMN purchase_manager_name VARCHAR(50) NULL AFTER purchase_manager_id,
      ADD KEY idx_products_tenant_purchase_manager (tenant_id,purchase_manager_id),
      ADD CONSTRAINT fk_products_purchase_manager FOREIGN KEY (purchase_manager_id) REFERENCES users(id) ON DELETE SET NULL`);
    await q.query(`ALTER TABLE skus
      ADD COLUMN purchase_manager_id BIGINT UNSIGNED NULL AFTER product_id,
      ADD COLUMN purchase_manager_name VARCHAR(50) NULL AFTER purchase_manager_id,
      ADD KEY idx_skus_tenant_purchase_manager (tenant_id,purchase_manager_id),
      ADD CONSTRAINT fk_skus_purchase_manager FOREIGN KEY (purchase_manager_id) REFERENCES users(id) ON DELETE SET NULL`);
    await q.query(`UPDATE skus s JOIN products p ON p.id=s.product_id
      SET s.purchase_manager_id=p.purchase_manager_id,s.purchase_manager_name=p.purchase_manager_name
      WHERE s.purchase_manager_id IS NULL`);
    await q.query(`INSERT INTO permissions(permission_name,permission_code,module_code,description,status) VALUES
      ('查看报表中心','report.read','report','查看营业、商品、订单、客户、采购和毛利报表','ACTIVE'),
      ('导出报表','report.export','report','导出报表Excel','ACTIVE')
      ON DUPLICATE KEY UPDATE permission_name=VALUES(permission_name),description=VALUES(description),status='ACTIVE'`);
    await q.query(`INSERT IGNORE INTO role_permissions(tenant_id,role_id,permission_id)
      SELECT r.tenant_id,r.id,p.id FROM roles r JOIN permissions p
      WHERE (r.role_code IN ('ADMIN','FINANCE','OPERATIONS') AND p.permission_code='report.read')
         OR (r.role_code IN ('ADMIN','FINANCE') AND p.permission_code='report.export')`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE rp FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE p.permission_code IN ('report.read','report.export')`);
    await q.query(`DELETE FROM permissions WHERE permission_code IN ('report.read','report.export')`);
    await q.query(`ALTER TABLE skus DROP FOREIGN KEY fk_skus_purchase_manager, DROP INDEX idx_skus_tenant_purchase_manager, DROP COLUMN purchase_manager_name, DROP COLUMN purchase_manager_id`);
    await q.query(`ALTER TABLE products DROP FOREIGN KEY fk_products_purchase_manager, DROP INDEX idx_products_tenant_purchase_manager, DROP COLUMN purchase_manager_name, DROP COLUMN purchase_manager_id`);
  }
}
