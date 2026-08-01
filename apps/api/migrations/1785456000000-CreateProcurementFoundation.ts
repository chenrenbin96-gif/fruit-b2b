import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProcurementFoundation1785456000000
  implements MigrationInterface
{
  name = 'CreateProcurementFoundation1785456000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE suppliers (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        supplier_no VARCHAR(32) NOT NULL,
        supplier_name VARCHAR(150) NOT NULL,
        contact_name VARCHAR(50) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        address VARCHAR(255) NOT NULL,
        supply_categories JSON NULL,
        remark VARCHAR(500) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_suppliers_tenant_no (tenant_id, supplier_no),
        KEY idx_suppliers_tenant_name_status (tenant_id, supplier_name, status),
        CONSTRAINT fk_suppliers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT chk_suppliers_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE purchase_orders (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        purchase_no VARCHAR(32) NOT NULL,
        supplier_id BIGINT UNSIGNED NOT NULL,
        warehouse_id BIGINT UNSIGNED NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
        total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
        remark VARCHAR(500) NULL,
        created_by BIGINT UNSIGNED NOT NULL,
        submitted_at DATETIME(3) NULL,
        received_by BIGINT UNSIGNED NULL,
        received_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_purchase_orders_tenant_no (tenant_id, purchase_no),
        KEY idx_purchase_orders_tenant_status_created (tenant_id, status, created_at),
        KEY idx_purchase_orders_supplier (supplier_id),
        KEY idx_purchase_orders_warehouse (warehouse_id),
        CONSTRAINT fk_purchase_orders_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
        CONSTRAINT fk_purchase_orders_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE RESTRICT,
        CONSTRAINT fk_purchase_orders_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT fk_purchase_orders_received_by FOREIGN KEY (received_by) REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT chk_purchase_orders_status CHECK (status IN ('DRAFT', 'SUBMITTED', 'RECEIVED', 'CANCELLED')),
        CONSTRAINT chk_purchase_orders_amount CHECK (total_amount >= 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE purchase_order_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        purchase_order_id BIGINT UNSIGNED NOT NULL,
        sku_id BIGINT UNSIGNED NOT NULL,
        product_name VARCHAR(150) NOT NULL,
        sku_name VARCHAR(150) NOT NULL,
        sale_type VARCHAR(20) NOT NULL,
        ordered_quantity DECIMAL(18,3) NOT NULL,
        received_quantity DECIMAL(18,3) NOT NULL DEFAULT 0,
        purchase_unit VARCHAR(20) NOT NULL,
        purchase_price DECIMAL(14,4) NOT NULL,
        amount DECIMAL(14,2) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_purchase_order_items_order_sku (purchase_order_id, sku_id),
        KEY idx_purchase_order_items_tenant_sku (tenant_id, sku_id),
        CONSTRAINT fk_purchase_order_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_purchase_order_items_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE CASCADE,
        CONSTRAINT fk_purchase_order_items_sku FOREIGN KEY (sku_id) REFERENCES skus (id) ON DELETE RESTRICT,
        CONSTRAINT chk_purchase_order_items_sale_type CHECK (sale_type IN ('PIECE', 'WEIGHT')),
        CONSTRAINT chk_purchase_order_items_values CHECK (
          ordered_quantity > 0 AND received_quantity >= 0
          AND purchase_price >= 0 AND amount >= 0
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE purchase_receipts (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        receipt_no VARCHAR(32) NOT NULL,
        purchase_order_id BIGINT UNSIGNED NOT NULL,
        supplier_id BIGINT UNSIGNED NOT NULL,
        warehouse_id BIGINT UNSIGNED NOT NULL,
        total_amount DECIMAL(14,2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
        received_by BIGINT UNSIGNED NOT NULL,
        received_at DATETIME(3) NOT NULL,
        remark VARCHAR(500) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_purchase_receipts_tenant_no (tenant_id, receipt_no),
        UNIQUE KEY uk_purchase_receipts_order (purchase_order_id),
        KEY idx_purchase_receipts_tenant_received (tenant_id, received_at),
        CONSTRAINT fk_purchase_receipts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_purchase_receipts_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id) ON DELETE RESTRICT,
        CONSTRAINT fk_purchase_receipts_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
        CONSTRAINT fk_purchase_receipts_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE RESTRICT,
        CONSTRAINT fk_purchase_receipts_received_by FOREIGN KEY (received_by) REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT chk_purchase_receipts_status CHECK (status = 'CONFIRMED'),
        CONSTRAINT chk_purchase_receipts_amount CHECK (total_amount >= 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE purchase_receipt_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        receipt_id BIGINT UNSIGNED NOT NULL,
        purchase_order_item_id BIGINT UNSIGNED NOT NULL,
        sku_id BIGINT UNSIGNED NOT NULL,
        received_quantity DECIMAL(18,3) NOT NULL,
        purchase_unit VARCHAR(20) NOT NULL,
        purchase_price DECIMAL(14,4) NOT NULL,
        amount DECIMAL(14,2) NOT NULL,
        inventory_cost_before DECIMAL(14,4) NOT NULL,
        inventory_cost_after DECIMAL(14,4) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_purchase_receipt_items_receipt_item (receipt_id, purchase_order_item_id),
        KEY idx_purchase_receipt_items_tenant_sku (tenant_id, sku_id),
        CONSTRAINT fk_purchase_receipt_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_purchase_receipt_items_receipt FOREIGN KEY (receipt_id) REFERENCES purchase_receipts (id) ON DELETE CASCADE,
        CONSTRAINT fk_purchase_receipt_items_order_item FOREIGN KEY (purchase_order_item_id) REFERENCES purchase_order_items (id) ON DELETE RESTRICT,
        CONSTRAINT fk_purchase_receipt_items_sku FOREIGN KEY (sku_id) REFERENCES skus (id) ON DELETE RESTRICT,
        CONSTRAINT chk_purchase_receipt_items_values CHECK (
          received_quantity > 0 AND purchase_price >= 0 AND amount >= 0
          AND inventory_cost_before >= 0 AND inventory_cost_after >= 0
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      ALTER TABLE inventory_logs
        DROP CHECK chk_inventory_logs_type,
        ADD CONSTRAINT chk_inventory_logs_type CHECK (
          operation_type IN (
            'ADJUST_IN', 'ADJUST_OUT', 'SET',
            'ORDER_LOCK', 'ORDER_RELEASE', 'ORDER_FULFILL',
            'PURCHASE_IN'
          )
        )
    `);

    await queryRunner.query(`
      INSERT INTO permissions
        (permission_name, permission_code, module_code, description, status)
      VALUES
        ('供应商管理', 'supplier.manage', 'supplier', '创建、编辑和查询供应商', 'ACTIVE'),
        ('采购单查看', 'purchase.read', 'purchase', '查看采购订单与入库结果', 'ACTIVE'),
        ('采购单管理', 'purchase.write', 'purchase', '创建、编辑和提交采购订单', 'ACTIVE'),
        ('采购入库', 'inventory.receive', 'inventory', '确认采购到货并增加库存', 'ACTIVE')
      ON DUPLICATE KEY UPDATE permission_name = VALUES(permission_name),
        description = VALUES(description), status = 'ACTIVE'
    `);

    await queryRunner.query(`
      INSERT INTO roles
        (tenant_id, role_name, role_code, description, is_system, status)
      SELECT id, '采购人员', 'PURCHASER', '供应商选用、采购单创建与提交', 1, 'ACTIVE'
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
        (r.role_code = 'PURCHASER' AND p.permission_code IN (
          'dashboard.read', 'purchase.read', 'purchase.write',
          'product.read', 'inventory.read'
        ))
        OR
        (r.role_code = 'WAREHOUSE' AND p.permission_code IN (
          'purchase.read', 'inventory.receive'
        ))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.permission_code IN (
        'supplier.manage', 'purchase.read', 'purchase.write', 'inventory.receive'
      )
    `);
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      WHERE r.role_code = 'PURCHASER'
    `);
    await queryRunner.query(`
      DELETE FROM roles WHERE role_code = 'PURCHASER'
    `);
    await queryRunner.query(`
      DELETE FROM permissions WHERE permission_code IN (
        'supplier.manage', 'purchase.read', 'purchase.write', 'inventory.receive'
      )
    `);
    await queryRunner.query(`
      DELETE FROM inventory_logs WHERE operation_type = 'PURCHASE_IN'
    `);
    await queryRunner.query(`
      ALTER TABLE inventory_logs
        DROP CHECK chk_inventory_logs_type,
        ADD CONSTRAINT chk_inventory_logs_type CHECK (
          operation_type IN (
            'ADJUST_IN', 'ADJUST_OUT', 'SET',
            'ORDER_LOCK', 'ORDER_RELEASE', 'ORDER_FULFILL'
          )
        )
    `);
    await queryRunner.query('DROP TABLE purchase_receipt_items');
    await queryRunner.query('DROP TABLE purchase_receipts');
    await queryRunner.query('DROP TABLE purchase_order_items');
    await queryRunner.query('DROP TABLE purchase_orders');
    await queryRunner.query('DROP TABLE suppliers');
  }
}
