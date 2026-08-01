import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowOperationsManageProductMedia1786147200000
  implements MigrationInterface
{
  name = 'AllowOperationsManageProductMedia1786147200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (tenant_id, role_id, permission_id)
      SELECT r.tenant_id, r.id, p.id
      FROM roles r
      JOIN permissions p
        ON p.permission_code = 'product.media.manage'
      WHERE r.role_code = 'OPERATIONS'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rp
      FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE r.role_code = 'OPERATIONS'
        AND p.permission_code = 'product.media.manage'
    `);
  }
}
