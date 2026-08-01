import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerArchiveExport1787011200000 implements MigrationInterface {
  name = 'AddCustomerArchiveExport1787011200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE customer_operation_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        admin_id BIGINT UNSIGNED NOT NULL,
        operation_type VARCHAR(50) NOT NULL,
        export_count INT UNSIGNED NOT NULL DEFAULT 0,
        filter_json JSON NULL,
        ip VARCHAR(64) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY idx_customer_operation_logs_tenant_date (tenant_id, created_at),
        KEY idx_customer_operation_logs_admin_date (admin_id, created_at),
        KEY idx_customer_operation_logs_type_date (tenant_id, operation_type, created_at),
        CONSTRAINT fk_customer_operation_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
        CONSTRAINT fk_customer_operation_logs_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      INSERT INTO permissions(permission_name,permission_code,module_code,description,status) VALUES
        ('客户批量导入','customer.import','customer','导入标准客户档案Excel','ACTIVE'),
        ('客户档案导出','customer.export','customer','导出客户档案Excel并记录审计日志','ACTIVE')
      ON DUPLICATE KEY UPDATE permission_name=VALUES(permission_name),description=VALUES(description),status='ACTIVE'
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions(tenant_id,role_id,permission_id)
      SELECT r.tenant_id,r.id,p.id FROM roles r JOIN permissions p
      WHERE r.role_code='ADMIN' AND p.permission_code IN ('customer.import','customer.export')
    `);
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN roles r ON r.id=rp.role_id AND r.tenant_id=rp.tenant_id
      JOIN permissions p ON p.id=rp.permission_id
      WHERE r.role_code='OPERATIONS' AND p.permission_code='customer.config.manage'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions(tenant_id,role_id,permission_id)
      SELECT r.tenant_id,r.id,p.id FROM roles r JOIN permissions p
      WHERE r.role_code='OPERATIONS' AND p.permission_code='customer.config.manage'
    `);
    await queryRunner.query(`DELETE rp FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE p.permission_code IN ('customer.import','customer.export')`);
    await queryRunner.query(`DELETE FROM permissions WHERE permission_code IN ('customer.import','customer.export')`);
    await queryRunner.query('DROP TABLE customer_operation_logs');
  }
}
