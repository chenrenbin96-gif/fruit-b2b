import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendTradingConfiguration1785888000000
  implements MigrationInterface
{
  name = 'ExtendTradingConfiguration1785888000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE delivery_regions
        ADD COLUMN address_keywords VARCHAR(500) NULL AFTER description,
        ADD COLUMN min_order_amount DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER address_keywords,
        ADD CONSTRAINT chk_delivery_regions_min_order CHECK (min_order_amount >= 0)
    `);
    await queryRunner.query(`
      ALTER TABLE shipping_rules
        DROP CHECK chk_shipping_rules_type,
        ADD COLUMN fixed_fee DECIMAL(14,2) NULL AFTER calculation_type,
        MODIFY price_per_weight DECIMAL(14,4) NULL,
        MODIFY weight_unit VARCHAR(20) NULL,
        ADD CONSTRAINT chk_shipping_rules_type CHECK (
          calculation_type IN ('WEIGHT', 'FIXED')
        ),
        ADD CONSTRAINT chk_shipping_rules_calculation CHECK (
          (calculation_type = 'WEIGHT' AND price_per_weight IS NOT NULL
            AND weight_unit IN ('斤', '公斤') AND price_per_weight >= 0)
          OR
          (calculation_type = 'FIXED' AND fixed_fee IS NOT NULL
            AND fixed_fee >= 0)
        )
    `);
    await queryRunner.query(`
      ALTER TABLE customers
        ADD COLUMN delivery_region_id BIGINT UNSIGNED NULL AFTER address,
        ADD KEY idx_customers_delivery_region (delivery_region_id),
        ADD CONSTRAINT fk_customers_delivery_region
          FOREIGN KEY (delivery_region_id) REFERENCES delivery_regions (id)
          ON DELETE RESTRICT
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE customers
        DROP FOREIGN KEY fk_customers_delivery_region,
        DROP KEY idx_customers_delivery_region,
        DROP COLUMN delivery_region_id
    `);
    await queryRunner.query(`
      ALTER TABLE shipping_rules
        DROP CHECK chk_shipping_rules_calculation,
        DROP CHECK chk_shipping_rules_type,
        DROP COLUMN fixed_fee,
        MODIFY price_per_weight DECIMAL(14,4) NOT NULL,
        MODIFY weight_unit VARCHAR(20) NOT NULL,
        ADD CONSTRAINT chk_shipping_rules_type CHECK (
          calculation_type = 'WEIGHT'
        )
    `);
    await queryRunner.query(`
      ALTER TABLE delivery_regions
        DROP CHECK chk_delivery_regions_min_order,
        DROP COLUMN min_order_amount,
        DROP COLUMN address_keywords
    `);
  }
}
