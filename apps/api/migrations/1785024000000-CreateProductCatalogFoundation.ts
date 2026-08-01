import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductCatalogFoundation1785024000000
  implements MigrationInterface
{
  name = 'CreateProductCatalogFoundation1785024000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE categories (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        parent_id BIGINT UNSIGNED NULL,
        name VARCHAR(100) NOT NULL,
        image VARCHAR(500) NULL,
        sort INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        parent_scope BIGINT UNSIGNED
          GENERATED ALWAYS AS (IFNULL(parent_id, 0)) STORED,
        PRIMARY KEY (id),
        UNIQUE KEY uk_categories_tenant_parent_name (tenant_id, parent_scope, name),
        KEY idx_categories_tenant_parent_sort (tenant_id, parent_id, sort),
        KEY idx_categories_tenant_status (tenant_id, status),
        CONSTRAINT fk_categories_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE RESTRICT,
        CONSTRAINT chk_categories_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE products (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        category_id BIGINT UNSIGNED NOT NULL,
        product_code VARCHAR(32) NOT NULL,
        name VARCHAR(150) NOT NULL,
        main_image VARCHAR(500) NULL,
        origin VARCHAR(100) NULL,
        brand VARCHAR(100) NULL,
        description TEXT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_products_tenant_code (tenant_id, product_code),
        KEY idx_products_tenant_category_status (tenant_id, category_id, status),
        KEY idx_products_tenant_name (tenant_id, name),
        CONSTRAINT fk_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
        CONSTRAINT chk_products_status CHECK (status IN ('DRAFT', 'ON_SALE', 'OFF_SALE'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE skus (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        product_id BIGINT UNSIGNED NOT NULL,
        sku_code VARCHAR(50) NOT NULL,
        sku_name VARCHAR(150) NOT NULL,
        specification VARCHAR(150) NULL,
        sale_type VARCHAR(20) NOT NULL,
        piece_unit VARCHAR(20) NULL,
        weight_unit VARCHAR(20) NULL,
        stock_unit VARCHAR(20) NOT NULL,
        price_unit VARCHAR(20) NOT NULL,
        cost_price DECIMAL(14,4) NOT NULL DEFAULT 0,
        base_price DECIMAL(14,4) NOT NULL,
        stock_warning DECIMAL(18,3) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_skus_tenant_code (tenant_id, sku_code),
        KEY idx_skus_tenant_product_status (tenant_id, product_id, status),
        CONSTRAINT fk_skus_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_skus_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT,
        CONSTRAINT chk_skus_sale_type CHECK (sale_type IN ('PIECE', 'WEIGHT')),
        CONSTRAINT chk_skus_units CHECK (
          (
            sale_type = 'PIECE'
            AND piece_unit IS NOT NULL
            AND weight_unit IS NULL
            AND stock_unit = piece_unit
            AND price_unit = piece_unit
          )
          OR
          (
            sale_type = 'WEIGHT'
            AND weight_unit IS NOT NULL
            AND piece_unit IS NULL
            AND stock_unit = weight_unit
            AND price_unit = weight_unit
          )
        ),
        CONSTRAINT chk_skus_prices CHECK (cost_price >= 0 AND base_price >= 0),
        CONSTRAINT chk_skus_stock_warning CHECK (stock_warning >= 0),
        CONSTRAINT chk_skus_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE inventory (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        warehouse_id BIGINT UNSIGNED NOT NULL,
        sku_id BIGINT UNSIGNED NOT NULL,
        stock_unit VARCHAR(20) NOT NULL,
        stock_quantity DECIMAL(18,3) NOT NULL DEFAULT 0,
        locked_quantity DECIMAL(18,3) NOT NULL DEFAULT 0,
        available_quantity DECIMAL(18,3)
          GENERATED ALWAYS AS (stock_quantity - locked_quantity) STORED,
        cost_price DECIMAL(14,4) NOT NULL DEFAULT 0,
        version INT UNSIGNED NOT NULL DEFAULT 0,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_inventory_tenant_warehouse_sku (tenant_id, warehouse_id, sku_id),
        KEY idx_inventory_tenant_available (tenant_id, available_quantity),
        KEY idx_inventory_sku (sku_id),
        CONSTRAINT fk_inventory_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_inventory_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE RESTRICT,
        CONSTRAINT fk_inventory_sku FOREIGN KEY (sku_id) REFERENCES skus (id) ON DELETE RESTRICT,
        CONSTRAINT chk_inventory_quantity CHECK (
          stock_quantity >= 0
          AND locked_quantity >= 0
          AND locked_quantity <= stock_quantity
        ),
        CONSTRAINT chk_inventory_cost CHECK (cost_price >= 0)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE inventory_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        inventory_id BIGINT UNSIGNED NOT NULL,
        warehouse_id BIGINT UNSIGNED NOT NULL,
        sku_id BIGINT UNSIGNED NOT NULL,
        operation_type VARCHAR(30) NOT NULL,
        change_quantity DECIMAL(18,3) NOT NULL,
        before_quantity DECIMAL(18,3) NOT NULL,
        after_quantity DECIMAL(18,3) NOT NULL,
        stock_unit VARCHAR(20) NOT NULL,
        reason VARCHAR(500) NOT NULL,
        operator_id BIGINT UNSIGNED NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY idx_inventory_logs_tenant_sku_created (tenant_id, sku_id, created_at),
        KEY idx_inventory_logs_inventory_created (inventory_id, created_at),
        KEY idx_inventory_logs_operator (operator_id),
        CONSTRAINT fk_inventory_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_inventory_logs_inventory FOREIGN KEY (inventory_id) REFERENCES inventory (id) ON DELETE RESTRICT,
        CONSTRAINT fk_inventory_logs_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE RESTRICT,
        CONSTRAINT fk_inventory_logs_sku FOREIGN KEY (sku_id) REFERENCES skus (id) ON DELETE RESTRICT,
        CONSTRAINT fk_inventory_logs_operator FOREIGN KEY (operator_id) REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT chk_inventory_logs_type CHECK (operation_type IN ('ADJUST_IN', 'ADJUST_OUT', 'SET'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE price_levels (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        level_id BIGINT UNSIGNED NOT NULL,
        sku_id BIGINT UNSIGNED NOT NULL,
        price DECIMAL(14,4) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_price_levels_tenant_level_sku (tenant_id, level_id, sku_id),
        KEY idx_price_levels_sku_status (sku_id, status),
        CONSTRAINT fk_price_levels_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_price_levels_level FOREIGN KEY (level_id) REFERENCES customer_levels (id) ON DELETE RESTRICT,
        CONSTRAINT fk_price_levels_sku FOREIGN KEY (sku_id) REFERENCES skus (id) ON DELETE RESTRICT,
        CONSTRAINT chk_price_levels_price CHECK (price >= 0),
        CONSTRAINT chk_price_levels_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE customer_prices (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        customer_id BIGINT UNSIGNED NOT NULL,
        sku_id BIGINT UNSIGNED NOT NULL,
        price DECIMAL(14,4) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_customer_prices_tenant_customer_sku (tenant_id, customer_id, sku_id),
        KEY idx_customer_prices_sku_status (sku_id, status),
        CONSTRAINT fk_customer_prices_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_customer_prices_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
        CONSTRAINT fk_customer_prices_sku FOREIGN KEY (sku_id) REFERENCES skus (id) ON DELETE RESTRICT,
        CONSTRAINT chk_customer_prices_price CHECK (price >= 0),
        CONSTRAINT chk_customer_prices_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE quantity_prices (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        sku_id BIGINT UNSIGNED NOT NULL,
        min_quantity DECIMAL(18,3) NOT NULL,
        max_quantity DECIMAL(18,3) NULL,
        price DECIMAL(14,4) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_quantity_prices_tenant_sku_min (tenant_id, sku_id, min_quantity),
        KEY idx_quantity_prices_sku_range_status (sku_id, min_quantity, max_quantity, status),
        CONSTRAINT fk_quantity_prices_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_quantity_prices_sku FOREIGN KEY (sku_id) REFERENCES skus (id) ON DELETE RESTRICT,
        CONSTRAINT chk_quantity_prices_range CHECK (
          min_quantity > 0 AND (max_quantity IS NULL OR max_quantity >= min_quantity)
        ),
        CONSTRAINT chk_quantity_prices_price CHECK (price >= 0),
        CONSTRAINT chk_quantity_prices_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE quantity_prices');
    await queryRunner.query('DROP TABLE customer_prices');
    await queryRunner.query('DROP TABLE price_levels');
    await queryRunner.query('DROP TABLE inventory_logs');
    await queryRunner.query('DROP TABLE inventory');
    await queryRunner.query('DROP TABLE skus');
    await queryRunner.query('DROP TABLE products');
    await queryRunner.query('DROP TABLE categories');
  }
}
