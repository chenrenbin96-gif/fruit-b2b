import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UpgradeProcurementCenter1786838400000
  implements MigrationInterface
{
  name = 'UpgradeProcurementCenter1786838400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventory_logs
        DROP CHECK chk_inventory_logs_type,
        ADD CONSTRAINT chk_inventory_logs_type CHECK (
          operation_type IN (
            'ADJUST_IN', 'ADJUST_OUT', 'SET',
            'ORDER_LOCK', 'ORDER_RELEASE', 'ORDER_FULFILL',
            'PURCHASE_IN', 'PURCHASE_RETURN'
          )
        )
    `);
    await queryRunner.query(`
      ALTER TABLE suppliers
        ADD COLUMN settlement_method VARCHAR(30) NULL AFTER supply_categories,
        ADD COLUMN credit_days INT UNSIGNED NOT NULL DEFAULT 0 AFTER settlement_method
    `);
    await queryRunner.query(`
      ALTER TABLE purchase_orders
        DROP CHECK chk_purchase_orders_status,
        ADD COLUMN purchase_type VARCHAR(20) NOT NULL DEFAULT 'SUPPLIER' AFTER purchase_no,
        ADD COLUMN source_type VARCHAR(20) NOT NULL DEFAULT 'MANUAL' AFTER purchase_type,
        ADD COLUMN responsible_person_id BIGINT UNSIGNED NULL AFTER warehouse_id,
        ADD COLUMN purchaser_id BIGINT UNSIGNED NULL AFTER responsible_person_id,
        ADD COLUMN planned_delivery_date DATE NULL AFTER purchase_date,
        ADD COLUMN sort_mode VARCHAR(20) NOT NULL DEFAULT 'ADDED' AFTER planned_delivery_date,
        ADD COLUMN update_last_purchase_price TINYINT(1) NOT NULL DEFAULT 1 AFTER sort_mode,
        ADD COLUMN received_amount DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER total_amount,
        ADD COLUMN completed_at DATETIME(3) NULL AFTER received_at,
        ADD KEY idx_purchase_orders_tenant_purchaser_date (tenant_id, purchaser_id, purchase_date),
        ADD KEY idx_purchase_orders_tenant_delivery (tenant_id, planned_delivery_date),
        ADD CONSTRAINT fk_purchase_orders_responsible FOREIGN KEY (responsible_person_id)
          REFERENCES users (id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_purchase_orders_purchaser FOREIGN KEY (purchaser_id)
          REFERENCES users (id) ON DELETE SET NULL,
        ADD CONSTRAINT chk_purchase_orders_status CHECK (
          status IN (
            'PENDING_PURCHASE', 'PURCHASING', 'ARRIVED',
            'PARTIALLY_RECEIVED', 'RECEIVED', 'COMPLETED',
            'STOCKED', 'CANCELLED'
          )
        ),
        ADD CONSTRAINT chk_purchase_orders_type CHECK (purchase_type IN ('MARKET', 'SUPPLIER')),
        ADD CONSTRAINT chk_purchase_orders_sort CHECK (sort_mode IN ('ADDED', 'CATEGORY'))
    `);
    await queryRunner.query(`
      ALTER TABLE purchase_order_items
        ADD COLUMN remark VARCHAR(500) NULL AFTER amount
    `);
    await queryRunner.query(`
      ALTER TABLE purchase_receipts
        DROP INDEX uk_purchase_receipts_order,
        ADD KEY idx_purchase_receipts_order (purchase_order_id)
    `);
    await queryRunner.query(`
      ALTER TABLE purchase_receipt_items
        DROP INDEX uk_purchase_receipt_items_receipt_item,
        ADD COLUMN gross_weight DECIMAL(18,3) NULL AFTER received_quantity,
        ADD COLUMN net_weight DECIMAL(18,3) NULL AFTER gross_weight,
        ADD UNIQUE KEY uk_purchase_receipt_items_receipt_order_item
          (receipt_id, purchase_order_item_id)
    `);

    await queryRunner.query(`
      CREATE TABLE supplier_products (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        supplier_id BIGINT UNSIGNED NOT NULL,
        product_id BIGINT UNSIGNED NOT NULL,
        sku_id BIGINT UNSIGNED NOT NULL,
        purchase_price DECIMAL(14,4) NOT NULL,
        last_purchase_time DATETIME(3) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
          ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_supplier_products_supplier_sku (tenant_id, supplier_id, sku_id),
        KEY idx_supplier_products_tenant_product (tenant_id, product_id),
        CONSTRAINT fk_supplier_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id),
        CONSTRAINT fk_supplier_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
        CONSTRAINT fk_supplier_products_product FOREIGN KEY (product_id) REFERENCES products (id),
        CONSTRAINT fk_supplier_products_sku FOREIGN KEY (sku_id) REFERENCES skus (id),
        CONSTRAINT chk_supplier_products_price CHECK (purchase_price >= 0),
        CONSTRAINT chk_supplier_products_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE purchase_price_history (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        supplier_id BIGINT UNSIGNED NOT NULL,
        purchase_order_id BIGINT UNSIGNED NOT NULL,
        sku_id BIGINT UNSIGNED NOT NULL,
        price DECIMAL(14,4) NOT NULL,
        quantity DECIMAL(18,3) NOT NULL,
        purchase_date DATETIME(3) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY idx_purchase_price_history_tenant_sku_date (tenant_id, sku_id, purchase_date),
        KEY idx_purchase_price_history_supplier_date (supplier_id, purchase_date),
        CONSTRAINT fk_purchase_price_history_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id),
        CONSTRAINT fk_purchase_price_history_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
        CONSTRAINT fk_purchase_price_history_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id),
        CONSTRAINT fk_purchase_price_history_sku FOREIGN KEY (sku_id) REFERENCES skus (id),
        CONSTRAINT chk_purchase_price_history_price CHECK (price >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE purchase_plans (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        sku_id BIGINT UNSIGNED NOT NULL,
        supplier_id BIGINT UNSIGNED NULL,
        current_stock DECIMAL(18,3) NOT NULL,
        safe_stock DECIMAL(18,3) NOT NULL,
        thirty_day_sales DECIMAL(18,3) NOT NULL DEFAULT 0,
        supply_cycle_days INT UNSIGNED NOT NULL DEFAULT 7,
        suggest_quantity DECIMAL(18,3) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        generated_order_id BIGINT UNSIGNED NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
          ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY idx_purchase_plans_tenant_status (tenant_id, status, created_at),
        KEY idx_purchase_plans_sku (sku_id),
        CONSTRAINT fk_purchase_plans_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id),
        CONSTRAINT fk_purchase_plans_sku FOREIGN KEY (sku_id) REFERENCES skus (id),
        CONSTRAINT fk_purchase_plans_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL,
        CONSTRAINT fk_purchase_plans_order FOREIGN KEY (generated_order_id) REFERENCES purchase_orders (id) ON DELETE SET NULL,
        CONSTRAINT chk_purchase_plans_status CHECK (status IN ('PENDING', 'ORDERED', 'IGNORED'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE purchase_returns (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        return_no VARCHAR(32) NOT NULL,
        purchase_order_id BIGINT UNSIGNED NOT NULL,
        supplier_id BIGINT UNSIGNED NOT NULL,
        warehouse_id BIGINT UNSIGNED NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING_REVIEW',
        reason VARCHAR(255) NOT NULL,
        amount DECIMAL(14,2) NOT NULL DEFAULT 0,
        remark VARCHAR(500) NULL,
        created_by BIGINT UNSIGNED NOT NULL,
        reviewed_by BIGINT UNSIGNED NULL,
        reviewed_at DATETIME(3) NULL,
        completed_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
          ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_purchase_returns_tenant_no (tenant_id, return_no),
        KEY idx_purchase_returns_tenant_status (tenant_id, status, created_at),
        CONSTRAINT fk_purchase_returns_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id),
        CONSTRAINT fk_purchase_returns_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id),
        CONSTRAINT fk_purchase_returns_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
        CONSTRAINT fk_purchase_returns_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id),
        CONSTRAINT fk_purchase_returns_creator FOREIGN KEY (created_by) REFERENCES users (id),
        CONSTRAINT fk_purchase_returns_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL,
        CONSTRAINT chk_purchase_returns_status CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'COMPLETED', 'CANCELLED'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE purchase_return_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        purchase_return_id BIGINT UNSIGNED NOT NULL,
        purchase_order_item_id BIGINT UNSIGNED NOT NULL,
        sku_id BIGINT UNSIGNED NOT NULL,
        return_quantity DECIMAL(18,3) NOT NULL,
        purchase_price DECIMAL(14,4) NOT NULL,
        amount DECIMAL(14,2) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_purchase_return_items_return_item (purchase_return_id, purchase_order_item_id),
        CONSTRAINT fk_purchase_return_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id),
        CONSTRAINT fk_purchase_return_items_return FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns (id) ON DELETE CASCADE,
        CONSTRAINT fk_purchase_return_items_order_item FOREIGN KEY (purchase_order_item_id) REFERENCES purchase_order_items (id),
        CONSTRAINT fk_purchase_return_items_sku FOREIGN KEY (sku_id) REFERENCES skus (id)
      )
    `);

    await queryRunner.query(`
      INSERT INTO permissions
        (permission_name, permission_code, module_code, description, status)
      VALUES
        ('采购收货', 'purchase.receive', 'purchase', '确认采购部分或全部收货', 'ACTIVE'),
        ('采购退货管理', 'purchase.return.manage', 'purchase', '创建审核并完成采购退货', 'ACTIVE'),
        ('供应商商品维护', 'supplier.product.manage', 'purchase', '维护供应商商品和报价', 'ACTIVE'),
        ('采购价格查看', 'purchase.price.read', 'purchase', '查看采购价格与历史趋势', 'ACTIVE'),
        ('采购计划管理', 'purchase.plan.manage', 'purchase', '生成采购计划和采购单', 'ACTIVE'),
        ('采购分析查看', 'purchase.analysis.read', 'purchase', '查看采购分析看板', 'ACTIVE')
      ON DUPLICATE KEY UPDATE permission_name = VALUES(permission_name),
        description = VALUES(description), status = 'ACTIVE'
    `);
    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (tenant_id, role_id, permission_id)
      SELECT r.tenant_id, r.id, p.id FROM roles r JOIN permissions p
      WHERE r.role_code = 'ADMIN'
        OR (r.role_code = 'PURCHASER' AND p.permission_code IN (
          'purchase.receive', 'purchase.return.manage', 'supplier.product.manage',
          'purchase.price.read', 'purchase.plan.manage', 'purchase.analysis.read'
        ))
        OR (r.role_code = 'WAREHOUSE' AND p.permission_code = 'purchase.receive')
        OR (r.role_code = 'FINANCE' AND p.permission_code IN (
          'purchase.read', 'purchase.price.read', 'purchase.analysis.read'
        ))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
      WHERE p.permission_code IN (
        'purchase.receive', 'purchase.return.manage', 'supplier.product.manage',
        'purchase.price.read', 'purchase.plan.manage', 'purchase.analysis.read'
      )
    `);
    await queryRunner.query(`
      DELETE FROM permissions WHERE permission_code IN (
        'purchase.receive', 'purchase.return.manage', 'supplier.product.manage',
        'purchase.price.read', 'purchase.plan.manage', 'purchase.analysis.read'
      )
    `);
    await queryRunner.query('DROP TABLE purchase_return_items');
    await queryRunner.query('DROP TABLE purchase_returns');
    await queryRunner.query('DROP TABLE purchase_plans');
    await queryRunner.query('DROP TABLE purchase_price_history');
    await queryRunner.query('DROP TABLE supplier_products');
    await queryRunner.query(`
      ALTER TABLE purchase_receipt_items
        DROP INDEX uk_purchase_receipt_items_receipt_order_item,
        DROP COLUMN net_weight,
        DROP COLUMN gross_weight,
        ADD UNIQUE KEY uk_purchase_receipt_items_receipt_item
          (receipt_id, purchase_order_item_id)
    `);
    await queryRunner.query(`
      ALTER TABLE purchase_receipts
        DROP INDEX idx_purchase_receipts_order,
        ADD UNIQUE KEY uk_purchase_receipts_order (purchase_order_id)
    `);
    await queryRunner.query('ALTER TABLE purchase_order_items DROP COLUMN remark');
    await queryRunner.query(`
      UPDATE purchase_orders SET status = 'STOCKED'
      WHERE status IN ('PARTIALLY_RECEIVED', 'RECEIVED', 'COMPLETED')
    `);
    await queryRunner.query(`
      ALTER TABLE purchase_orders
        DROP CHECK chk_purchase_orders_status,
        DROP CHECK chk_purchase_orders_type,
        DROP CHECK chk_purchase_orders_sort,
        DROP FOREIGN KEY fk_purchase_orders_purchaser,
        DROP FOREIGN KEY fk_purchase_orders_responsible,
        DROP INDEX idx_purchase_orders_tenant_delivery,
        DROP INDEX idx_purchase_orders_tenant_purchaser_date,
        DROP COLUMN completed_at,
        DROP COLUMN received_amount,
        DROP COLUMN update_last_purchase_price,
        DROP COLUMN sort_mode,
        DROP COLUMN planned_delivery_date,
        DROP COLUMN purchaser_id,
        DROP COLUMN responsible_person_id,
        DROP COLUMN source_type,
        DROP COLUMN purchase_type,
        ADD CONSTRAINT chk_purchase_orders_status CHECK (
          status IN ('PENDING_PURCHASE', 'PURCHASING', 'ARRIVED', 'STOCKED', 'CANCELLED')
        )
    `);
    await queryRunner.query(`
      ALTER TABLE suppliers DROP COLUMN credit_days, DROP COLUMN settlement_method
    `);
    await queryRunner.query(`
      ALTER TABLE inventory_logs
        DROP CHECK chk_inventory_logs_type,
        ADD CONSTRAINT chk_inventory_logs_type CHECK (
          operation_type IN (
            'ADJUST_IN', 'ADJUST_OUT', 'SET',
            'ORDER_LOCK', 'ORDER_RELEASE', 'ORDER_FULFILL', 'PURCHASE_IN'
          )
        )
    `);
  }
}
