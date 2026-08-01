import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIdentityFoundation1784937600000
  implements MigrationInterface
{
  name = 'CreateIdentityFoundation1784937600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE tenants (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_code VARCHAR(32) NOT NULL,
        tenant_name VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        contact_name VARCHAR(50) NULL,
        contact_phone VARCHAR(30) NULL,
        expire_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_tenants_tenant_code (tenant_code),
        KEY idx_tenants_status (status),
        CONSTRAINT chk_tenants_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE stores (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        store_code VARCHAR(32) NOT NULL,
        store_name VARCHAR(100) NOT NULL,
        city_code VARCHAR(20) NULL,
        address VARCHAR(255) NULL,
        contact_name VARCHAR(50) NULL,
        contact_phone VARCHAR(30) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_stores_tenant_code (tenant_id, store_code),
        KEY idx_stores_tenant_status (tenant_id, status),
        CONSTRAINT fk_stores_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT chk_stores_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE warehouses (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        store_id BIGINT UNSIGNED NULL,
        warehouse_code VARCHAR(32) NOT NULL,
        warehouse_name VARCHAR(100) NOT NULL,
        address VARCHAR(255) NULL,
        contact_name VARCHAR(50) NULL,
        contact_phone VARCHAR(30) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_warehouses_tenant_code (tenant_id, warehouse_code),
        KEY idx_warehouses_tenant_status (tenant_id, status),
        KEY idx_warehouses_store (store_id),
        CONSTRAINT fk_warehouses_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_warehouses_store FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE RESTRICT,
        CONSTRAINT chk_warehouses_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE delivery_regions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        region_code VARCHAR(32) NOT NULL,
        region_name VARCHAR(100) NOT NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        description VARCHAR(500) NULL,
        sort INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        default_tenant_guard BIGINT UNSIGNED
          GENERATED ALWAYS AS (
            IF(is_default = 1 AND deleted_at IS NULL, tenant_id, NULL)
          ) STORED,
        PRIMARY KEY (id),
        UNIQUE KEY uk_delivery_regions_tenant_code (tenant_id, region_code),
        UNIQUE KEY uk_delivery_regions_default_tenant (default_tenant_guard),
        KEY idx_delivery_regions_tenant_status (tenant_id, status),
        CONSTRAINT fk_delivery_regions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT chk_delivery_regions_default CHECK (is_default IN (0, 1)),
        CONSTRAINT chk_delivery_regions_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE roles (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        role_name VARCHAR(50) NOT NULL,
        role_code VARCHAR(50) NOT NULL,
        description VARCHAR(255) NULL,
        is_system TINYINT(1) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_roles_tenant_code (tenant_id, role_code),
        KEY idx_roles_tenant_status (tenant_id, status),
        CONSTRAINT fk_roles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT chk_roles_system CHECK (is_system IN (0, 1)),
        CONSTRAINT chk_roles_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE permissions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        permission_name VARCHAR(100) NOT NULL,
        permission_code VARCHAR(100) NOT NULL,
        module_code VARCHAR(50) NOT NULL,
        description VARCHAR(255) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_permissions_code (permission_code),
        KEY idx_permissions_module_status (module_code, status),
        CONSTRAINT chk_permissions_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE role_permissions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        role_id BIGINT UNSIGNED NOT NULL,
        permission_id BIGINT UNSIGNED NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_role_permissions_relation (tenant_id, role_id, permission_id),
        KEY idx_role_permissions_role (role_id),
        KEY idx_role_permissions_permission (permission_id),
        CONSTRAINT fk_role_permissions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
        CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE users (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        username VARCHAR(64) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(50) NOT NULL,
        phone VARCHAR(30) NULL,
        avatar VARCHAR(500) NULL,
        role_id BIGINT UNSIGNED NOT NULL,
        store_id BIGINT UNSIGNED NULL,
        warehouse_id BIGINT UNSIGNED NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        last_login_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_users_tenant_username (tenant_id, username),
        KEY idx_users_tenant_phone (tenant_id, phone),
        KEY idx_users_role (role_id),
        KEY idx_users_store (store_id),
        KEY idx_users_warehouse (warehouse_id),
        CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE RESTRICT,
        CONSTRAINT fk_users_store FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE RESTRICT,
        CONSTRAINT fk_users_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id) ON DELETE RESTRICT,
        CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE', 'DISABLED', 'LOCKED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE customer_levels (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(50) NOT NULL,
        level_code VARCHAR(32) NOT NULL,
        description VARCHAR(255) NULL,
        sort INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_customer_levels_tenant_code (tenant_id, level_code),
        KEY idx_customer_levels_tenant_status (tenant_id, status),
        CONSTRAINT fk_customer_levels_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT chk_customer_levels_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE customers (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        customer_no VARCHAR(32) NOT NULL,
        customer_name VARCHAR(150) NOT NULL,
        contact_name VARCHAR(50) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        address VARCHAR(255) NOT NULL,
        business_type VARCHAR(32) NOT NULL,
        level_id BIGINT UNSIGNED NOT NULL,
        settlement_type VARCHAR(20) NOT NULL DEFAULT 'CASH',
        payment_term_days INT UNSIGNED NOT NULL DEFAULT 0,
        credit_limit DECIMAL(14,2) NOT NULL DEFAULT 0,
        balance_due DECIMAL(14,2) NOT NULL DEFAULT 0,
        sales_owner_id BIGINT UNSIGNED NULL,
        sales_remark VARCHAR(1000) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_customers_tenant_no (tenant_id, customer_no),
        KEY idx_customers_tenant_phone (tenant_id, phone),
        KEY idx_customers_tenant_level_status (tenant_id, level_id, status),
        KEY idx_customers_sales_owner (sales_owner_id),
        CONSTRAINT fk_customers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_customers_level FOREIGN KEY (level_id) REFERENCES customer_levels (id) ON DELETE RESTRICT,
        CONSTRAINT fk_customers_sales_owner FOREIGN KEY (sales_owner_id) REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT chk_customers_business_type CHECK (
          business_type IN ('FRUIT_RETAIL', 'CATERING', 'SUPERMARKET', 'COMMUNITY_GROUP', 'SMALL_WHOLESALER')
        ),
        CONSTRAINT chk_customers_settlement_type CHECK (settlement_type IN ('CASH', 'MONTHLY')),
        CONSTRAINT chk_customers_credit_limit CHECK (credit_limit >= 0),
        CONSTRAINT chk_customers_balance_due CHECK (balance_due >= 0),
        CONSTRAINT chk_customers_status CHECK (status IN ('ACTIVE', 'DISABLED', 'FROZEN'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE customer_accounts (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        customer_id BIGINT UNSIGNED NOT NULL,
        account_name VARCHAR(50) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        wx_openid VARCHAR(128) NULL,
        wx_unionid VARCHAR(128) NULL,
        is_primary TINYINT(1) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        last_login_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        deleted_at DATETIME(3) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_customer_accounts_tenant_phone (tenant_id, phone),
        UNIQUE KEY uk_customer_accounts_tenant_openid (tenant_id, wx_openid),
        KEY idx_customer_accounts_customer (customer_id),
        CONSTRAINT fk_customer_accounts_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_customer_accounts_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
        CONSTRAINT chk_customer_accounts_primary CHECK (is_primary IN (0, 1)),
        CONSTRAINT chk_customer_accounts_status CHECK (status IN ('ACTIVE', 'DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE customer_settings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        customer_id BIGINT UNSIGNED NOT NULL,
        first_order_min_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_customer_settings_tenant_customer (tenant_id, customer_id),
        CONSTRAINT fk_customer_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_customer_settings_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
        CONSTRAINT chk_customer_settings_amount CHECK (first_order_min_amount >= 0),
        CONSTRAINT chk_customer_settings_enabled CHECK (enabled IN (0, 1))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE system_settings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        setting_key VARCHAR(100) NOT NULL,
        value_type VARCHAR(20) NOT NULL,
        setting_value VARCHAR(1000) NOT NULL,
        description VARCHAR(255) NULL,
        updated_by BIGINT UNSIGNED NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_system_settings_tenant_key (tenant_id, setting_key),
        KEY idx_system_settings_updated_by (updated_by),
        CONSTRAINT fk_system_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_system_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT,
        CONSTRAINT chk_system_settings_value_type CHECK (
          value_type IN ('INTEGER', 'DECIMAL', 'BOOLEAN', 'STRING')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'system_settings',
      'customer_settings',
      'customer_accounts',
      'customers',
      'customer_levels',
      'users',
      'role_permissions',
      'permissions',
      'roles',
      'delivery_regions',
      'warehouses',
      'stores',
      'tenants',
    ];

    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS \`${table}\``);
    }
  }
}
