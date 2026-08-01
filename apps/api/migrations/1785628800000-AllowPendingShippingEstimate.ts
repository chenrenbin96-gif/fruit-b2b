import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowPendingShippingEstimate1785628800000
  implements MigrationInterface
{
  name = 'AllowPendingShippingEstimate1785628800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE shipping_records
        DROP CHECK chk_shipping_records_amount,
        MODIFY COLUMN actual_weight DECIMAL(18,3) NULL,
        ADD CONSTRAINT chk_shipping_records_amount CHECK (
          estimated_weight >= 0
          AND (actual_weight IS NULL OR actual_weight >= 0)
          AND shipping_price >= 0
          AND shipping_fee >= 0
        )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE shipping_records
      SET actual_weight = COALESCE(actual_weight, estimated_weight, 0)
      WHERE actual_weight IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE shipping_records
        DROP CHECK chk_shipping_records_amount,
        MODIFY COLUMN actual_weight DECIMAL(18,3) NOT NULL,
        ADD CONSTRAINT chk_shipping_records_amount CHECK (
          actual_weight >= 0 AND shipping_price >= 0 AND shipping_fee >= 0
        )
    `);
  }
}
