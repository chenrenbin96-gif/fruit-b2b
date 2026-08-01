import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendSupplyChainOperations1785974400000
  implements MigrationInterface
{
  name = 'ExtendSupplyChainOperations1785974400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE purchase_orders
        DROP CHECK chk_purchase_orders_status,
        ADD COLUMN purchase_date DATE NULL AFTER warehouse_id,
        ADD COLUMN arrived_at DATETIME(3) NULL AFTER submitted_at,
        ADD KEY idx_purchase_orders_tenant_purchase_date
          (tenant_id, purchase_date)
    `);
    await queryRunner.query(`
      UPDATE purchase_orders
      SET status = CASE status
        WHEN 'DRAFT' THEN 'PENDING_PURCHASE'
        WHEN 'SUBMITTED' THEN 'PURCHASING'
        WHEN 'RECEIVED' THEN 'STOCKED'
        ELSE status
      END
    `);
    await queryRunner.query(`
      ALTER TABLE purchase_orders
        MODIFY status VARCHAR(24) NOT NULL DEFAULT 'PENDING_PURCHASE',
        ADD CONSTRAINT chk_purchase_orders_status CHECK (
          status IN (
            'PENDING_PURCHASE', 'PURCHASING', 'ARRIVED',
            'STOCKED', 'CANCELLED'
          )
        )
    `);

    await queryRunner.query(`
      INSERT INTO permissions
        (permission_name, permission_code, module_code, description, status)
      VALUES
        ('成本查看', 'cost.read', 'operations', '查看SKU成本及毛利测算', 'ACTIVE'),
        ('毛利分析', 'profit.read', 'operations', '查看经营毛利分析', 'ACTIVE'),
        ('库存预警', 'inventory.alert.read', 'operations', '查看低库存、缺货和滞销预警', 'ACTIVE'),
        ('采购建议', 'purchase.suggestion.read', 'operations', '查看采购补货建议', 'ACTIVE')
      ON DUPLICATE KEY UPDATE
        permission_name = VALUES(permission_name),
        description = VALUES(description),
        status = 'ACTIVE'
    `);
    await queryRunner.query(`
      INSERT INTO roles
        (tenant_id, role_name, role_code, description, is_system, status)
      SELECT id, '财务', 'FINANCE', '成本、毛利与客户账务管理', 1, 'ACTIVE'
      FROM tenants
      ON DUPLICATE KEY UPDATE role_name = VALUES(role_name),
        description = VALUES(description), status = 'ACTIVE'
    `);
    await queryRunner.query(`
      INSERT INTO roles
        (tenant_id, role_name, role_code, description, is_system, status)
      SELECT id, '运营', 'OPERATIONS', '商品与首页运营管理', 1, 'ACTIVE'
      FROM tenants
      ON DUPLICATE KEY UPDATE role_name = VALUES(role_name),
        description = VALUES(description), status = 'ACTIVE'
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (tenant_id, role_id, permission_id)
      SELECT r.tenant_id, r.id, p.id
      FROM roles r
      JOIN permissions p
      WHERE
        (r.role_code = 'ADMIN')
        OR
        (r.role_code = 'PURCHASER' AND p.permission_code IN (
          'supplier.manage', 'purchase.read', 'purchase.write',
          'inventory.read', 'inventory.receive',
          'inventory.alert.read', 'purchase.suggestion.read'
        ))
        OR
        (r.role_code = 'FINANCE' AND p.permission_code IN (
          'dashboard.read', 'dashboard.business.read', 'finance.read',
          'finance.credit.manage', 'finance.payment.create',
          'cost.read', 'profit.read'
        ))
        OR
        (r.role_code = 'OPERATIONS' AND p.permission_code IN (
          'dashboard.read', 'dashboard.business.read',
          'product.read', 'product.write', 'price.read',
          'coupon.manage', 'inventory.alert.read'
        ))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.permission_code IN (
        'cost.read', 'profit.read',
        'inventory.alert.read', 'purchase.suggestion.read'
      )
    `);
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      WHERE r.role_code IN ('FINANCE', 'OPERATIONS')
    `);
    await queryRunner.query(`
      DELETE FROM roles WHERE role_code IN ('FINANCE', 'OPERATIONS')
    `);
    await queryRunner.query(`
      DELETE FROM permissions WHERE permission_code IN (
        'cost.read', 'profit.read',
        'inventory.alert.read', 'purchase.suggestion.read'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE purchase_orders
        DROP CHECK chk_purchase_orders_status
    `);
    await queryRunner.query(`
      UPDATE purchase_orders
      SET status = CASE status
        WHEN 'PENDING_PURCHASE' THEN 'DRAFT'
        WHEN 'PURCHASING' THEN 'SUBMITTED'
        WHEN 'ARRIVED' THEN 'SUBMITTED'
        WHEN 'STOCKED' THEN 'RECEIVED'
        ELSE status
      END
    `);
    await queryRunner.query(`
      ALTER TABLE purchase_orders
        MODIFY status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
        ADD CONSTRAINT chk_purchase_orders_status CHECK (
          status IN ('DRAFT', 'SUBMITTED', 'RECEIVED', 'CANCELLED')
        ),
        DROP KEY idx_purchase_orders_tenant_purchase_date,
        DROP COLUMN arrived_at,
        DROP COLUMN purchase_date
    `);
  }
}
