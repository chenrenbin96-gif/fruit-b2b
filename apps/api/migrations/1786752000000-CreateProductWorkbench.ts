import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductWorkbench1786752000000
  implements MigrationInterface
{
  name = 'CreateProductWorkbench1786752000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE products
        ADD barcode VARCHAR(64) NULL AFTER product_code,
        ADD grade VARCHAR(20) NULL AFTER brand,
        ADD UNIQUE KEY uk_products_tenant_barcode (tenant_id, barcode)
    `);
    await queryRunner.query(`
      ALTER TABLE skus
        ADD market_price DECIMAL(14,4) NOT NULL DEFAULT 0 AFTER base_price
    `);
    await queryRunner.query(`UPDATE skus SET market_price = base_price`);
    await queryRunner.query(`
      INSERT IGNORE INTO permissions
        (permission_name, permission_code, module_code, status)
      VALUES
        ('管理商品展示信息', 'product.display.write', 'product', 'ACTIVE'),
        ('管理商品SKU', 'product.sku.write', 'product', 'ACTIVE'),
        ('维护商品采购信息', 'product.procurement.write', 'product', 'ACTIVE'),
        ('商品批量与删除管理', 'product.manage', 'product', 'ACTIVE')
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (tenant_id, role_id, permission_id)
      SELECT r.tenant_id, r.id, p.id
      FROM roles r
      JOIN permissions p ON (
        (r.role_code = 'ADMIN' AND p.permission_code IN (
          'product.display.write', 'product.sku.write',
          'product.procurement.write', 'product.manage'
        ))
        OR (r.role_code = 'PURCHASER' AND p.permission_code IN (
          'product.display.write', 'product.sku.write',
          'product.procurement.write'
        ))
        OR (r.role_code = 'OPERATIONS'
          AND p.permission_code = 'product.display.write')
        OR (r.role_code = 'FINANCE'
          AND p.permission_code IN ('product.read', 'price.read'))
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE r.role_code = 'FINANCE'
        AND p.permission_code IN ('product.read', 'price.read')
    `);
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.permission_code IN (
        'product.display.write', 'product.sku.write',
        'product.procurement.write', 'product.manage'
      )
    `);
    await queryRunner.query(`
      DELETE FROM permissions WHERE permission_code IN (
        'product.display.write', 'product.sku.write',
        'product.procurement.write', 'product.manage'
      )
    `);
    await queryRunner.query(`ALTER TABLE skus DROP market_price`);
    await queryRunner.query(`
      ALTER TABLE products
        DROP INDEX uk_products_tenant_barcode,
        DROP grade,
        DROP barcode
    `);
  }
}
