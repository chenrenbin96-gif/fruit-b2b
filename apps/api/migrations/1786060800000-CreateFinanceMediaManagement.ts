import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFinanceMediaManagement1786060800000
  implements MigrationInterface
{
  name = 'CreateFinanceMediaManagement1786060800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE product_media (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        product_id BIGINT UNSIGNED NOT NULL,
        media_type VARCHAR(20) NOT NULL,
        url VARCHAR(500) NOT NULL,
        thumbnail_url VARCHAR(500) NULL,
        sort INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ENABLE',
        video_product_id BIGINT UNSIGNED
          GENERATED ALWAYS AS (
            CASE WHEN media_type = 'VIDEO' THEN product_id ELSE NULL END
          ) STORED,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
          ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_product_media_video (video_product_id),
        KEY idx_product_media_product_type_sort
          (tenant_id, product_id, media_type, sort),
        CONSTRAINT fk_product_media_tenant
          FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_product_media_product
          FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
        CONSTRAINT chk_product_media_type
          CHECK (media_type IN ('VIDEO', 'IMAGE')),
        CONSTRAINT chk_product_media_status
          CHECK (status IN ('ENABLE', 'DISABLE'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      INSERT INTO permissions
        (permission_name, permission_code, module_code, description, status)
      VALUES
        ('商品媒体查看', 'product.media.read', 'product',
          '查看商品图片和视频素材', 'ACTIVE'),
        ('商品媒体管理', 'product.media.manage', 'product',
          '上传、删除和排序商品媒体', 'ACTIVE'),
        ('客户对账单导出', 'finance.statement.export', 'finance',
          '查看并导出客户月度对账单', 'ACTIVE'),
        ('经营财务报表', 'finance.report.read', 'finance',
          '查看日周月经营财务报表', 'ACTIVE'),
        ('首页运营管理', 'home.operation.manage', 'operations',
          '管理首页Banner、分类入口和推荐商品', 'ACTIVE')
      ON DUPLICATE KEY UPDATE
        permission_name = VALUES(permission_name),
        description = VALUES(description), status = 'ACTIVE'
    `);
    await queryRunner.query(`
      INSERT INTO product_media
        (tenant_id, product_id, media_type, url, sort, status)
      SELECT tenant_id, id, 'IMAGE', main_image, 0, 'ENABLE'
      FROM products
      WHERE main_image IS NOT NULL AND main_image <> ''
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (tenant_id, role_id, permission_id)
      SELECT r.tenant_id, r.id, p.id
      FROM roles r
      JOIN permissions p
      WHERE
        r.role_code = 'ADMIN'
        OR (r.role_code = 'PURCHASER' AND p.permission_code IN (
          'product.read', 'product.write',
          'product.media.read', 'product.media.manage'
        ))
        OR (r.role_code = 'OPERATIONS' AND p.permission_code IN (
          'product.media.read', 'home.operation.manage'
        ))
        OR (r.role_code = 'FINANCE' AND p.permission_code IN (
          'finance.read', 'finance.credit.manage', 'finance.payment.create',
          'finance.statement.export', 'finance.report.read',
          'cost.read', 'profit.read'
        ))
    `);
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE r.role_code = 'OPERATIONS' AND p.permission_code = 'product.write'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.permission_code IN (
        'product.media.read', 'product.media.manage',
        'finance.statement.export', 'finance.report.read',
        'home.operation.manage'
      )
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (tenant_id, role_id, permission_id)
      SELECT r.tenant_id, r.id, p.id
      FROM roles r JOIN permissions p
      WHERE r.role_code = 'OPERATIONS' AND p.permission_code = 'product.write'
    `);
    await queryRunner.query(`
      DELETE FROM permissions WHERE permission_code IN (
        'product.media.read', 'product.media.manage',
        'finance.statement.export', 'finance.report.read',
        'home.operation.manage'
      )
    `);
    await queryRunner.query('DROP TABLE product_media');
  }
}
