import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateImmersiveHomeOperations1785801600000
  implements MigrationInterface
{
  name = 'CreateImmersiveHomeOperations1785801600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE home_banners
        ADD COLUMN link_id BIGINT UNSIGNED NULL AFTER link_type,
        ADD COLUMN start_time DATETIME(3) NULL AFTER status,
        ADD COLUMN end_time DATETIME(3) NULL AFTER start_time,
        ADD KEY idx_home_banners_schedule (tenant_id, status, start_time, end_time)
    `);
    await queryRunner.query(`
      CREATE TABLE home_categories (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        category_id BIGINT UNSIGNED NOT NULL,
        image_url VARCHAR(500) NULL,
        title VARCHAR(100) NOT NULL,
        sort INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_home_categories_tenant_category (tenant_id, category_id),
        KEY idx_home_categories_tenant_status_sort (tenant_id, status, sort),
        CONSTRAINT fk_home_categories_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_home_categories_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
        CONSTRAINT chk_home_categories_status CHECK (status IN ('ACTIVE','DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE home_products (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        product_id BIGINT UNSIGNED NOT NULL,
        position VARCHAR(20) NOT NULL,
        sort INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_home_products_product_position (tenant_id, product_id, position),
        KEY idx_home_products_tenant_position_sort (tenant_id, position, status, sort),
        CONSTRAINT fk_home_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_home_products_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
        CONSTRAINT chk_home_products_position CHECK (position IN ('HOT','NEW','RECOMMEND')),
        CONSTRAINT chk_home_products_status CHECK (status IN ('ACTIVE','DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE home_products');
    await queryRunner.query('DROP TABLE home_categories');
    await queryRunner.query(`
      ALTER TABLE home_banners
        DROP INDEX idx_home_banners_schedule,
        DROP COLUMN end_time,
        DROP COLUMN start_time,
        DROP COLUMN link_id
    `);
  }
}
