import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFulfillmentCore1785196800000
  implements MigrationInterface
{
  name = 'CreateFulfillmentCore1785196800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE skus
        ADD COLUMN delivery_weight_per_piece DECIMAL(18,3) NULL AFTER price_unit,
        ADD COLUMN delivery_weight_unit VARCHAR(20) NULL AFTER delivery_weight_per_piece,
        ADD CONSTRAINT chk_skus_delivery_weight CHECK (
          (delivery_weight_per_piece IS NULL AND delivery_weight_unit IS NULL)
          OR (delivery_weight_per_piece > 0 AND delivery_weight_unit IS NOT NULL)
        )
    `);

    await queryRunner.query(`
      CREATE TABLE coupons (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(150) NOT NULL,
        coupon_type VARCHAR(30) NOT NULL,
        discount_amount DECIMAL(14,2) NOT NULL,
        min_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
        total_limit INT UNSIGNED NULL,
        issued_count INT UNSIGNED NOT NULL DEFAULT 0,
        used_count INT UNSIGNED NOT NULL DEFAULT 0,
        per_customer_limit INT UNSIGNED NOT NULL DEFAULT 1,
        start_time DATETIME(3) NOT NULL,
        end_time DATETIME(3) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_by BIGINT UNSIGNED NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        KEY idx_coupons_tenant_status_time (tenant_id, status, start_time, end_time),
        CONSTRAINT fk_coupons_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_coupons_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT chk_coupons_type CHECK (
          coupon_type IN (
            'ORDER_REDUCTION', 'PRODUCT', 'CATEGORY',
            'NEW_CUSTOMER', 'CUSTOMER_EXCLUSIVE'
          )
        ),
        CONSTRAINT chk_coupons_amount CHECK (
          discount_amount > 0 AND min_amount >= 0
        ),
        CONSTRAINT chk_coupons_limit CHECK (
          per_customer_limit > 0
          AND (total_limit IS NULL OR total_limit > 0)
          AND issued_count <= IFNULL(total_limit, issued_count)
          AND used_count <= issued_count
        ),
        CONSTRAINT chk_coupons_time CHECK (end_time > start_time),
        CONSTRAINT chk_coupons_status CHECK (status IN ('DRAFT', 'ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE coupon_products (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        coupon_id BIGINT UNSIGNED NOT NULL,
        product_id BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_coupon_products_relation (coupon_id, product_id),
        CONSTRAINT fk_coupon_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_coupon_products_coupon FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE CASCADE,
        CONSTRAINT fk_coupon_products_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE coupon_categories (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        coupon_id BIGINT UNSIGNED NOT NULL,
        category_id BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_coupon_categories_relation (coupon_id, category_id),
        CONSTRAINT fk_coupon_categories_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_coupon_categories_coupon FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE CASCADE,
        CONSTRAINT fk_coupon_categories_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE coupon_customer_levels (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        coupon_id BIGINT UNSIGNED NOT NULL,
        level_id BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_coupon_levels_relation (coupon_id, level_id),
        CONSTRAINT fk_coupon_levels_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_coupon_levels_coupon FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE CASCADE,
        CONSTRAINT fk_coupon_levels_level FOREIGN KEY (level_id) REFERENCES customer_levels (id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE customer_coupons (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        customer_id BIGINT UNSIGNED NOT NULL,
        coupon_id BIGINT UNSIGNED NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
        locked_order_id BIGINT UNSIGNED NULL,
        receive_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        locked_at DATETIME(3) NULL,
        use_time DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY idx_customer_coupons_customer_status (tenant_id, customer_id, status),
        KEY idx_customer_coupons_coupon_customer (coupon_id, customer_id),
        KEY idx_customer_coupons_locked_order (locked_order_id),
        CONSTRAINT fk_customer_coupons_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_customer_coupons_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
        CONSTRAINT fk_customer_coupons_coupon FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE RESTRICT,
        CONSTRAINT chk_customer_coupons_status CHECK (
          status IN ('AVAILABLE', 'LOCKED', 'USED', 'EXPIRED', 'INVALID')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE shipping_rules (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        delivery_region_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(100) NOT NULL,
        calculation_type VARCHAR(20) NOT NULL DEFAULT 'WEIGHT',
        price_per_weight DECIMAL(14,4) NOT NULL,
        weight_unit VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_shipping_rules_region (tenant_id, delivery_region_id),
        KEY idx_shipping_rules_tenant_status (tenant_id, status),
        CONSTRAINT fk_shipping_rules_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_shipping_rules_region FOREIGN KEY (delivery_region_id) REFERENCES delivery_regions (id) ON DELETE RESTRICT,
        CONSTRAINT chk_shipping_rules_type CHECK (calculation_type = 'WEIGHT'),
        CONSTRAINT chk_shipping_rules_price CHECK (price_per_weight >= 0),
        CONSTRAINT chk_shipping_rules_unit CHECK (weight_unit IN ('斤', '公斤')),
        CONSTRAINT chk_shipping_rules_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      ALTER TABLE orders
        DROP CHECK chk_orders_status,
        ADD COLUMN estimated_discount_amount DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER estimated_product_amount,
        ADD COLUMN coupon_id BIGINT UNSIGNED NULL AFTER shipping_status,
        ADD COLUMN customer_coupon_id BIGINT UNSIGNED NULL AFTER coupon_id,
        ADD COLUMN delivery_region_id BIGINT UNSIGNED NULL AFTER customer_coupon_id,
        ADD KEY idx_orders_customer_coupon (customer_coupon_id),
        ADD KEY idx_orders_delivery_region (delivery_region_id),
        ADD CONSTRAINT fk_orders_coupon FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE RESTRICT,
        ADD CONSTRAINT fk_orders_customer_coupon FOREIGN KEY (customer_coupon_id) REFERENCES customer_coupons (id) ON DELETE RESTRICT,
        ADD CONSTRAINT fk_orders_delivery_region FOREIGN KEY (delivery_region_id) REFERENCES delivery_regions (id) ON DELETE RESTRICT,
        ADD CONSTRAINT chk_orders_status CHECK (
          status IN (
            'CREATED', 'WAITING_REVIEW', 'APPROVED', 'PICKING',
            'WEIGHING', 'WAITING_DELIVERY', 'DELIVERING',
            'COMPLETED', 'CANCELLED'
          )
        )
    `);

    await queryRunner.query(`
      ALTER TABLE customer_coupons
        ADD CONSTRAINT fk_customer_coupons_locked_order
          FOREIGN KEY (locked_order_id) REFERENCES orders (id) ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE order_items
        ADD COLUMN final_unit_price DECIMAL(14,4) NULL AFTER unit_price
    `);

    await queryRunner.query(`
      CREATE TABLE coupon_records (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        coupon_id BIGINT UNSIGNED NOT NULL,
        customer_coupon_id BIGINT UNSIGNED NOT NULL,
        customer_id BIGINT UNSIGNED NOT NULL,
        order_id BIGINT UNSIGNED NOT NULL,
        status VARCHAR(20) NOT NULL,
        eligible_amount DECIMAL(14,2) NOT NULL,
        discount_amount DECIMAL(14,2) NOT NULL,
        reason VARCHAR(500) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_coupon_records_order (order_id),
        KEY idx_coupon_records_coupon_status (tenant_id, coupon_id, status),
        KEY idx_coupon_records_customer (customer_id, created_at),
        CONSTRAINT fk_coupon_records_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_coupon_records_coupon FOREIGN KEY (coupon_id) REFERENCES coupons (id) ON DELETE RESTRICT,
        CONSTRAINT fk_coupon_records_customer_coupon FOREIGN KEY (customer_coupon_id) REFERENCES customer_coupons (id) ON DELETE RESTRICT,
        CONSTRAINT fk_coupon_records_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
        CONSTRAINT fk_coupon_records_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT,
        CONSTRAINT chk_coupon_records_status CHECK (
          status IN ('LOCKED', 'USED', 'RELEASED', 'INVALIDATED')
        ),
        CONSTRAINT chk_coupon_records_amount CHECK (
          eligible_amount >= 0 AND discount_amount >= 0
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE shipping_records (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        order_id BIGINT UNSIGNED NOT NULL,
        shipping_rule_id BIGINT UNSIGNED NOT NULL,
        delivery_region_id BIGINT UNSIGNED NOT NULL,
        estimated_weight DECIMAL(18,3) NULL,
        actual_weight DECIMAL(18,3) NOT NULL,
        weight_unit VARCHAR(20) NOT NULL,
        shipping_price DECIMAL(14,4) NOT NULL,
        shipping_fee DECIMAL(14,2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_shipping_records_order (order_id),
        KEY idx_shipping_records_rule (shipping_rule_id),
        CONSTRAINT fk_shipping_records_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_shipping_records_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT,
        CONSTRAINT fk_shipping_records_rule FOREIGN KEY (shipping_rule_id) REFERENCES shipping_rules (id) ON DELETE RESTRICT,
        CONSTRAINT fk_shipping_records_region FOREIGN KEY (delivery_region_id) REFERENCES delivery_regions (id) ON DELETE RESTRICT,
        CONSTRAINT chk_shipping_records_amount CHECK (
          actual_weight >= 0 AND shipping_price >= 0 AND shipping_fee >= 0
        ),
        CONSTRAINT chk_shipping_records_status CHECK (
          status IN ('PENDING_CALCULATION', 'COMPLETED')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE deliveries (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        order_id BIGINT UNSIGNED NOT NULL,
        delivery_no VARCHAR(40) NOT NULL,
        delivery_person_id BIGINT UNSIGNED NULL,
        customer_name VARCHAR(150) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        address VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        assigned_at DATETIME(3) NULL,
        started_at DATETIME(3) NULL,
        delivered_at DATETIME(3) NULL,
        signed_by VARCHAR(50) NULL,
        remark VARCHAR(500) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_deliveries_order (order_id),
        UNIQUE KEY uk_deliveries_tenant_no (tenant_id, delivery_no),
        KEY idx_deliveries_person_status (tenant_id, delivery_person_id, status),
        CONSTRAINT fk_deliveries_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_deliveries_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT,
        CONSTRAINT fk_deliveries_person FOREIGN KEY (delivery_person_id) REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT chk_deliveries_status CHECK (
          status IN ('PENDING', 'IN_TRANSIT', 'DELIVERED')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
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

    await queryRunner.query(`
      INSERT INTO permissions
        (permission_name, permission_code, module_code, description, status)
      VALUES
        ('订单履约', 'order.fulfill', 'order', '拣货、称重并完成仓库履约', 'ACTIVE'),
        ('优惠券管理', 'coupon.manage', 'coupon', '创建、修改及发放优惠券', 'ACTIVE'),
        ('配送任务查看', 'delivery.read', 'delivery', '查看配送任务', 'ACTIVE'),
        ('配送状态更新', 'delivery.update', 'delivery', '分配配送员及更新配送状态', 'ACTIVE'),
        ('运费规则管理', 'shipping.manage', 'shipping', '维护区域运费规则', 'ACTIVE')
      ON DUPLICATE KEY UPDATE permission_name = VALUES(permission_name),
        description = VALUES(description), status = 'ACTIVE'
    `);

    await queryRunner.query(`
      INSERT IGNORE INTO role_permissions (tenant_id, role_id, permission_id)
      SELECT r.tenant_id, r.id, p.id
      FROM roles r
      JOIN permissions p
      WHERE
        (r.role_code = 'WAREHOUSE' AND p.permission_code = 'order.fulfill')
        OR
        (r.role_code = 'DELIVERY' AND p.permission_code IN ('delivery.read', 'delivery.update'))
    `);

    await queryRunner.query(`
      INSERT INTO shipping_rules
        (tenant_id, delivery_region_id, name, calculation_type, price_per_weight, weight_unit, status)
      SELECT tenant_id, id, CONCAT(region_name, '默认重量运费'), 'WEIGHT', 1.0000, '公斤', 'ACTIVE'
      FROM delivery_regions
      WHERE is_default = 1 AND status = 'ACTIVE' AND deleted_at IS NULL
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE rp FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.permission_code IN (
        'order.fulfill', 'coupon.manage', 'delivery.read',
        'delivery.update', 'shipping.manage'
      )
    `);
    await queryRunner.query(`
      DELETE FROM permissions WHERE permission_code IN (
        'order.fulfill', 'coupon.manage', 'delivery.read',
        'delivery.update', 'shipping.manage'
      )
    `);
    await queryRunner.query(`
      DELETE FROM inventory_logs WHERE operation_type = 'ORDER_FULFILL'
    `);
    await queryRunner.query(`
      ALTER TABLE inventory_logs
        DROP CHECK chk_inventory_logs_type,
        ADD CONSTRAINT chk_inventory_logs_type CHECK (
          operation_type IN (
            'ADJUST_IN', 'ADJUST_OUT', 'SET', 'ORDER_LOCK', 'ORDER_RELEASE'
          )
        )
    `);
    await queryRunner.query('DROP TABLE deliveries');
    await queryRunner.query('DROP TABLE shipping_records');
    await queryRunner.query('DROP TABLE coupon_records');
    await queryRunner.query(`
      ALTER TABLE customer_coupons
        DROP FOREIGN KEY fk_customer_coupons_locked_order
    `);
    await queryRunner.query(`
      ALTER TABLE orders
        DROP FOREIGN KEY fk_orders_delivery_region,
        DROP FOREIGN KEY fk_orders_customer_coupon,
        DROP FOREIGN KEY fk_orders_coupon,
        DROP CHECK chk_orders_status,
        DROP INDEX idx_orders_delivery_region,
        DROP INDEX idx_orders_customer_coupon,
        DROP COLUMN delivery_region_id,
        DROP COLUMN customer_coupon_id,
        DROP COLUMN coupon_id,
        DROP COLUMN estimated_discount_amount,
        ADD CONSTRAINT chk_orders_status CHECK (
          status IN (
            'CREATED', 'WAITING_REVIEW', 'APPROVED', 'PICKING',
            'WEIGHING', 'COMPLETED', 'CANCELLED'
          )
        )
    `);
    await queryRunner.query(`
      ALTER TABLE order_items DROP COLUMN final_unit_price
    `);
    await queryRunner.query('DROP TABLE shipping_rules');
    await queryRunner.query('DROP TABLE customer_coupons');
    await queryRunner.query('DROP TABLE coupon_customer_levels');
    await queryRunner.query('DROP TABLE coupon_categories');
    await queryRunner.query('DROP TABLE coupon_products');
    await queryRunner.query('DROP TABLE coupons');
    await queryRunner.query(`
      ALTER TABLE skus
        DROP CHECK chk_skus_delivery_weight,
        DROP COLUMN delivery_weight_unit,
        DROP COLUMN delivery_weight_per_piece
    `);
  }
}
