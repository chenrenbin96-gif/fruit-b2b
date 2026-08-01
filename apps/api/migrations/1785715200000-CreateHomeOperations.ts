import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHomeOperations1785715200000
  implements MigrationInterface
{
  name = 'CreateHomeOperations1785715200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE home_banners (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        title VARCHAR(120) NOT NULL,
        subtitle VARCHAR(240) NULL,
        image_url VARCHAR(500) NULL,
        banner_type VARCHAR(20) NOT NULL,
        link_type VARCHAR(20) NOT NULL DEFAULT 'NONE',
        link_value VARCHAR(500) NULL,
        sort INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY idx_home_banners_tenant_status_sort (tenant_id, status, sort),
        CONSTRAINT fk_home_banners_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT chk_home_banners_type CHECK (banner_type IN ('ACTIVITY','MARKET','NEW_ARRIVAL')),
        CONSTRAINT chk_home_banners_link CHECK (link_type IN ('NONE','PRODUCT','CATEGORY','URL')),
        CONSTRAINT chk_home_banners_status CHECK (status IN ('ACTIVE','DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE home_product_recommendations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        product_id BIGINT UNSIGNED NOT NULL,
        recommendation_type VARCHAR(20) NOT NULL,
        sort INT NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uk_home_recommendation_product_type (tenant_id, product_id, recommendation_type),
        KEY idx_home_recommendations_tenant_type_sort (tenant_id, recommendation_type, sort),
        CONSTRAINT fk_home_recommendations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_home_recommendations_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
        CONSTRAINT chk_home_recommendations_type CHECK (recommendation_type IN ('RECOMMENDED','HOT','NEW_ARRIVAL','SPECIAL')),
        CONSTRAINT chk_home_recommendations_status CHECK (status IN ('ACTIVE','DISABLED'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      INSERT INTO home_banners
        (tenant_id, title, subtitle, banner_type, link_type, sort, status)
      SELECT id, '今日鲜果批发行情', '产地直采 · 客户专属价 · 库存实时可见',
             'MARKET', 'NONE', 10, 'ACTIVE'
      FROM tenants
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE home_product_recommendations');
    await queryRunner.query('DROP TABLE home_banners');
  }
}
