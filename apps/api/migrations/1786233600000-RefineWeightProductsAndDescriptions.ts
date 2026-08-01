import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RefineWeightProductsAndDescriptions1786233600000
  implements MigrationInterface
{
  name = 'RefineWeightProductsAndDescriptions1786233600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE skus DROP CHECK chk_skus_units');
    await queryRunner.query(`
      ALTER TABLE skus
        ADD standard_weight DECIMAL(18,3) NULL AFTER price_unit,
        ADD weight_price_type VARCHAR(30) NULL AFTER standard_weight,
        ADD gross_weight_unit_price DECIMAL(14,4) NULL AFTER weight_price_type,
        ADD net_weight_unit_price DECIMAL(14,4) NULL AFTER gross_weight_unit_price
    `);
    await queryRunner.query(`
      UPDATE skus
      SET piece_unit = COALESCE(piece_unit, '件'),
          price_unit = COALESCE(piece_unit, '件'),
          standard_weight = 1.000,
          weight_price_type = 'ACTUAL_WEIGHT',
          gross_weight_unit_price = base_price,
          net_weight_unit_price = base_price
      WHERE sale_type = 'WEIGHT'
    `);
    await queryRunner.query(`
      ALTER TABLE skus ADD CONSTRAINT chk_skus_units CHECK (
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
          AND piece_unit IS NOT NULL
          AND weight_unit IS NOT NULL
          AND stock_unit = weight_unit
          AND price_unit = piece_unit
          AND standard_weight > 0
          AND weight_price_type = 'ACTUAL_WEIGHT'
          AND gross_weight_unit_price >= 0
          AND net_weight_unit_price >= 0
        )
      )
    `);
    await queryRunner.query(`
      ALTER TABLE order_items
        ADD actual_gross_weight DECIMAL(18,3) NULL AFTER actual_weight,
        ADD actual_net_weight DECIMAL(18,3) NULL AFTER actual_gross_weight,
        ADD gross_weight_unit_price DECIMAL(14,4) NULL AFTER final_unit_price,
        ADD net_weight_unit_price DECIMAL(14,4) NULL AFTER gross_weight_unit_price
    `);
    await queryRunner.query(`
      ALTER TABLE orders
        ADD amount_adjustment_type VARCHAR(20) NOT NULL DEFAULT 'NONE'
          AFTER final_amount,
        ADD amount_adjustment DECIMAL(14,2) NOT NULL DEFAULT 0
          AFTER amount_adjustment_type
    `);
    await queryRunner.query(`
      CREATE TABLE product_descriptions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id BIGINT UNSIGNED NOT NULL,
        product_id BIGINT UNSIGNED NOT NULL,
        content_json JSON NOT NULL,
        sort INT NOT NULL DEFAULT 0,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
          ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        KEY idx_product_descriptions_product_sort
          (tenant_id, product_id, sort),
        CONSTRAINT fk_product_descriptions_tenant
          FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE RESTRICT,
        CONSTRAINT fk_product_descriptions_product
          FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE product_descriptions');
    await queryRunner.query('ALTER TABLE orders DROP amount_adjustment, DROP amount_adjustment_type');
    await queryRunner.query(`
      ALTER TABLE order_items
        DROP net_weight_unit_price,
        DROP gross_weight_unit_price,
        DROP actual_net_weight,
        DROP actual_gross_weight
    `);
    await queryRunner.query('ALTER TABLE skus DROP CHECK chk_skus_units');
    await queryRunner.query(`
      UPDATE skus
      SET piece_unit = NULL,
          price_unit = weight_unit
      WHERE sale_type = 'WEIGHT'
    `);
    await queryRunner.query(`
      ALTER TABLE skus
        DROP net_weight_unit_price,
        DROP gross_weight_unit_price,
        DROP weight_price_type,
        DROP standard_weight
    `);
    await queryRunner.query(`
      ALTER TABLE skus ADD CONSTRAINT chk_skus_units CHECK (
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
      )
    `);
  }
}
