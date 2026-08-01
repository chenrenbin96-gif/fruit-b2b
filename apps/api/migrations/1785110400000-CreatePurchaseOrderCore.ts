import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePurchaseOrderCore1785110400000
  implements MigrationInterface
{
  name = 'CreatePurchaseOrderCore1785110400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE purchase_carts (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        customer_id BIGINT UNSIGNED NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        remark VARCHAR(500) NULL,
        submitted_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        active_customer_guard BIGINT UNSIGNED
          GENERATED ALWAYS AS (
            IF(status = 'ACTIVE', customer_id, NULL)
          ) STORED,
        PRIMARY KEY (id),
        UNIQUE KEY uk_purchase_carts_active_customer (tenant_id, active_customer_guard),
        KEY idx_purchase_carts_customer_status (tenant_id, customer_id, status),
        CONSTRAINT fk_purchase_carts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_purchase_carts_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
        CONSTRAINT chk_purchase_carts_status CHECK (status IN ('ACTIVE', 'SUBMITTED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE purchase_cart_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        cart_id BIGINT UNSIGNED NOT NULL,
        sku_id BIGINT UNSIGNED NOT NULL,
        sale_type VARCHAR(20) NOT NULL,
        quantity DECIMAL(18,3) NULL,
        estimated_weight DECIMAL(18,3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_purchase_cart_items_cart_sku (cart_id, sku_id),
        KEY idx_purchase_cart_items_tenant_sku (tenant_id, sku_id),
        CONSTRAINT fk_purchase_cart_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_purchase_cart_items_cart FOREIGN KEY (cart_id) REFERENCES purchase_carts (id) ON DELETE CASCADE,
        CONSTRAINT fk_purchase_cart_items_sku FOREIGN KEY (sku_id) REFERENCES skus (id) ON DELETE RESTRICT,
        CONSTRAINT chk_purchase_cart_items_sale_type CHECK (sale_type IN ('PIECE', 'WEIGHT')),
        CONSTRAINT chk_purchase_cart_items_quantity CHECK (
          (
            sale_type = 'PIECE'
            AND quantity IS NOT NULL
            AND quantity > 0
            AND quantity = FLOOR(quantity)
            AND estimated_weight IS NULL
          )
          OR
          (
            sale_type = 'WEIGHT'
            AND estimated_weight IS NOT NULL
            AND estimated_weight > 0
            AND quantity IS NULL
          )
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE orders (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        order_no VARCHAR(40) NOT NULL,
        source_cart_id BIGINT UNSIGNED NOT NULL,
        customer_id BIGINT UNSIGNED NOT NULL,
        warehouse_id BIGINT UNSIGNED NOT NULL,
        estimated_product_amount DECIMAL(14,2) NOT NULL,
        estimated_amount DECIMAL(14,2) NOT NULL,
        final_product_amount DECIMAL(14,2) NULL,
        final_amount DECIMAL(14,2) NULL,
        discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
        shipping_fee DECIMAL(14,2) NOT NULL DEFAULT 0,
        estimated_weight DECIMAL(18,3) NULL,
        actual_weight DECIMAL(18,3) NULL,
        weight_unit VARCHAR(20) NOT NULL DEFAULT '公斤',
        shipping_status VARCHAR(30) NOT NULL DEFAULT 'WAITING',
        status VARCHAR(30) NOT NULL DEFAULT 'WAITING_REVIEW',
        remark VARCHAR(500) NULL,
        reviewed_by BIGINT UNSIGNED NULL,
        reviewed_at DATETIME(3) NULL,
        rejection_reason VARCHAR(500) NULL,
        cancelled_by_type VARCHAR(20) NULL,
        cancelled_by_id BIGINT UNSIGNED NULL,
        cancellation_reason VARCHAR(500) NULL,
        cancelled_at DATETIME(3) NULL,
        expires_at DATETIME(3) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_orders_tenant_order_no (tenant_id, order_no),
        UNIQUE KEY uk_orders_source_cart (source_cart_id),
        KEY idx_orders_tenant_customer_status_created (tenant_id, customer_id, status, created_at),
        KEY idx_orders_tenant_warehouse_status_created (tenant_id, warehouse_id, status, created_at),
        KEY idx_orders_expires_status (expires_at, status),
        CONSTRAINT fk_orders_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_orders_source_cart FOREIGN KEY (source_cart_id) REFERENCES purchase_carts (id) ON DELETE RESTRICT,
        CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
        CONSTRAINT fk_orders_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE RESTRICT,
        CONSTRAINT fk_orders_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT chk_orders_amount CHECK (
          estimated_product_amount >= 0
          AND estimated_amount >= 0
          AND (final_product_amount IS NULL OR final_product_amount >= 0)
          AND (final_amount IS NULL OR final_amount >= 0)
          AND discount_amount >= 0
          AND shipping_fee >= 0
        ),
        CONSTRAINT chk_orders_shipping_status CHECK (
          shipping_status IN ('WAITING', 'PENDING_CALCULATION', 'COMPLETED')
        ),
        CONSTRAINT chk_orders_status CHECK (
          status IN (
            'CREATED', 'WAITING_REVIEW', 'APPROVED', 'PICKING',
            'WEIGHING', 'COMPLETED', 'CANCELLED'
          )
        ),
        CONSTRAINT chk_orders_cancelled_by_type CHECK (
          cancelled_by_type IS NULL
          OR cancelled_by_type IN ('CUSTOMER_ACCOUNT', 'EMPLOYEE', 'SYSTEM')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE order_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        order_id BIGINT UNSIGNED NOT NULL,
        sku_id BIGINT UNSIGNED NOT NULL,
        product_name VARCHAR(150) NOT NULL,
        sku_name VARCHAR(150) NOT NULL,
        specification VARCHAR(150) NULL,
        sale_type VARCHAR(20) NOT NULL,
        planned_quantity DECIMAL(18,3) NULL,
        planned_weight DECIMAL(18,3) NULL,
        actual_quantity DECIMAL(18,3) NULL,
        actual_weight DECIMAL(18,3) NULL,
        piece_unit VARCHAR(20) NULL,
        weight_unit VARCHAR(20) NULL,
        stock_unit VARCHAR(20) NOT NULL,
        price_unit VARCHAR(20) NOT NULL,
        unit_price DECIMAL(14,4) NOT NULL,
        estimated_amount DECIMAL(14,2) NOT NULL,
        final_amount DECIMAL(14,2) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_order_items_order_sku (order_id, sku_id),
        KEY idx_order_items_tenant_sku (tenant_id, sku_id),
        CONSTRAINT fk_order_items_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        CONSTRAINT fk_order_items_sku FOREIGN KEY (sku_id) REFERENCES skus (id) ON DELETE RESTRICT,
        CONSTRAINT chk_order_items_sale_type CHECK (sale_type IN ('PIECE', 'WEIGHT')),
        CONSTRAINT chk_order_items_planned CHECK (
          (
            sale_type = 'PIECE'
            AND planned_quantity IS NOT NULL
            AND planned_quantity > 0
            AND planned_quantity = FLOOR(planned_quantity)
            AND planned_weight IS NULL
          )
          OR
          (
            sale_type = 'WEIGHT'
            AND planned_weight IS NOT NULL
            AND planned_weight > 0
            AND planned_quantity IS NULL
          )
        ),
        CONSTRAINT chk_order_items_amount CHECK (
          unit_price >= 0
          AND estimated_amount >= 0
          AND (final_amount IS NULL OR final_amount >= 0)
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE order_status_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        order_id BIGINT UNSIGNED NOT NULL,
        from_status VARCHAR(30) NULL,
        to_status VARCHAR(30) NOT NULL,
        action VARCHAR(40) NOT NULL,
        operator_type VARCHAR(20) NOT NULL,
        operator_id BIGINT UNSIGNED NULL,
        remark VARCHAR(500) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY idx_order_status_logs_order_created (order_id, created_at),
        KEY idx_order_status_logs_tenant_action (tenant_id, action),
        CONSTRAINT fk_order_status_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_order_status_logs_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        CONSTRAINT chk_order_status_logs_operator CHECK (
          operator_type IN ('CUSTOMER_ACCOUNT', 'EMPLOYEE', 'SYSTEM')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      ALTER TABLE inventory_logs
        DROP FOREIGN KEY fk_inventory_logs_operator,
        DROP CHECK chk_inventory_logs_type,
        ADD COLUMN locked_change_quantity DECIMAL(18,3) NOT NULL DEFAULT 0 AFTER change_quantity,
        ADD COLUMN before_locked_quantity DECIMAL(18,3) NULL AFTER after_quantity,
        ADD COLUMN after_locked_quantity DECIMAL(18,3) NULL AFTER before_locked_quantity,
        ADD COLUMN reference_type VARCHAR(30) NULL AFTER reason,
        ADD COLUMN reference_id BIGINT UNSIGNED NULL AFTER reference_type,
        ADD COLUMN operator_type VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE' AFTER reference_id,
        MODIFY COLUMN operator_id BIGINT UNSIGNED NULL,
        ADD KEY idx_inventory_logs_reference (reference_type, reference_id),
        ADD CONSTRAINT chk_inventory_logs_type CHECK (
          operation_type IN (
            'ADJUST_IN', 'ADJUST_OUT', 'SET', 'ORDER_LOCK', 'ORDER_RELEASE'
          )
        ),
        ADD CONSTRAINT chk_inventory_logs_operator_type CHECK (
          operator_type IN ('CUSTOMER_ACCOUNT', 'EMPLOYEE', 'SYSTEM')
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM inventory_logs
      WHERE operation_type IN ('ORDER_LOCK', 'ORDER_RELEASE')
    `);
    await queryRunner.query(`
      ALTER TABLE inventory_logs
        DROP CHECK chk_inventory_logs_type,
        DROP CHECK chk_inventory_logs_operator_type,
        DROP INDEX idx_inventory_logs_reference,
        DROP COLUMN operator_type,
        DROP COLUMN reference_id,
        DROP COLUMN reference_type,
        DROP COLUMN after_locked_quantity,
        DROP COLUMN before_locked_quantity,
        DROP COLUMN locked_change_quantity,
        MODIFY COLUMN operator_id BIGINT UNSIGNED NOT NULL,
        ADD CONSTRAINT fk_inventory_logs_operator
          FOREIGN KEY (operator_id) REFERENCES users (id) ON DELETE RESTRICT,
        ADD CONSTRAINT chk_inventory_logs_type CHECK (
          operation_type IN ('ADJUST_IN', 'ADJUST_OUT', 'SET')
        )
    `);
    await queryRunner.query('DROP TABLE order_status_logs');
    await queryRunner.query('DROP TABLE order_items');
    await queryRunner.query('DROP TABLE orders');
    await queryRunner.query('DROP TABLE purchase_cart_items');
    await queryRunner.query('DROP TABLE purchase_carts');
  }
}
