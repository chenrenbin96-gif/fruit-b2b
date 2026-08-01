import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOperationsFoundation1785369600000
  implements MigrationInterface
{
  name = 'CreateOperationsFoundation1785369600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE operation_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        operator_type VARCHAR(30) NOT NULL,
        operator_id BIGINT UNSIGNED NULL,
        operator_name VARCHAR(100) NOT NULL,
        module_code VARCHAR(50) NOT NULL,
        action_code VARCHAR(80) NOT NULL,
        target_type VARCHAR(80) NOT NULL,
        target_id VARCHAR(64) NULL,
        before_data JSON NULL,
        after_data JSON NULL,
        request_id VARCHAR(64) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY idx_operation_logs_tenant_module_time (tenant_id, module_code, created_at),
        KEY idx_operation_logs_target (tenant_id, target_type, target_id),
        KEY idx_operation_logs_operator (tenant_id, operator_type, operator_id, created_at),
        CONSTRAINT fk_operation_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT chk_operation_logs_operator_type CHECK (
          operator_type IN ('EMPLOYEE', 'CUSTOMER_ACCOUNT', 'SYSTEM')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      INSERT INTO permissions
        (permission_name, permission_code, module_code, description, status)
      VALUES
        ('操作日志查看', 'operation_log.read', 'system', '查看关键业务操作审计日志', 'ACTIVE')
      ON DUPLICATE KEY UPDATE permission_name = VALUES(permission_name),
        description = VALUES(description), status = 'ACTIVE'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.permission_code = 'operation_log.read'
    `);
    await queryRunner.query(`
      DELETE FROM permissions WHERE permission_code = 'operation_log.read'
    `);
    await queryRunner.query('DROP TABLE operation_logs');
  }
}
