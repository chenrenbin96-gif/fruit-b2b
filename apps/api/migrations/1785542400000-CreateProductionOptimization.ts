import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductionOptimization1785542400000
  implements MigrationInterface
{
  name = 'CreateProductionOptimization1785542400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE orders
        ADD KEY idx_orders_tenant_status_created (tenant_id, status, created_at)
    `);
    await queryRunner.query(`
      ALTER TABLE order_items
        ADD KEY idx_order_items_tenant_sku_order (tenant_id, sku_id, order_id)
    `);
    await queryRunner.query(`
      ALTER TABLE products
        ADD KEY idx_products_tenant_status_created (tenant_id, status, created_at)
    `);
    await queryRunner.query(`
      ALTER TABLE inventory
        ADD KEY idx_inventory_tenant_warehouse_available (
          tenant_id, warehouse_id, available_quantity
        )
    `);
    await queryRunner.query(`
      ALTER TABLE customers
        ADD KEY idx_customers_tenant_status_debt (
          tenant_id, status, balance_due
        )
    `);

    await queryRunner.query(`
      INSERT INTO permissions
        (permission_name, permission_code, module_code, description, status)
      VALUES
        (
          '经营看板',
          'dashboard.business.read',
          'dashboard',
          '查看销售、库存预警和客户欠款经营数据',
          'ACTIVE'
        )
      ON DUPLICATE KEY UPDATE
        permission_name = VALUES(permission_name),
        description = VALUES(description),
        status = 'ACTIVE'
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (tenant_id, role_id, permission_id)
      SELECT r.tenant_id, r.id, p.id
      FROM roles r
      JOIN permissions p ON p.permission_code = 'dashboard.business.read'
      WHERE r.role_code = 'ADMIN'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.permission_code = 'dashboard.business.read'
    `);
    await queryRunner.query(`
      DELETE FROM permissions
      WHERE permission_code = 'dashboard.business.read'
    `);
    await queryRunner.query(`
      ALTER TABLE customers DROP INDEX idx_customers_tenant_status_debt
    `);
    await queryRunner.query(`
      ALTER TABLE inventory
        DROP INDEX idx_inventory_tenant_warehouse_available
    `);
    await queryRunner.query(`
      ALTER TABLE products DROP INDEX idx_products_tenant_status_created
    `);
    await queryRunner.query(`
      ALTER TABLE order_items DROP INDEX idx_order_items_tenant_sku_order
    `);
    await queryRunner.query(`
      ALTER TABLE orders DROP INDEX idx_orders_tenant_status_created
    `);
  }
}
