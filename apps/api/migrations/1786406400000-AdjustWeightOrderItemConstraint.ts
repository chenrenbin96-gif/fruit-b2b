import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AdjustWeightOrderItemConstraint1786406400000
  implements MigrationInterface
{
  name = 'AdjustWeightOrderItemConstraint1786406400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE order_items DROP CHECK chk_order_items_planned',
    );
    await queryRunner.query(`
      UPDATE order_items oi
      JOIN skus s ON s.id = oi.sku_id
      SET oi.planned_quantity = GREATEST(
        1,
        CEIL(oi.planned_weight / NULLIF(s.standard_weight, 0))
      )
      WHERE oi.sale_type = 'WEIGHT' AND oi.planned_quantity IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE order_items
      ADD CONSTRAINT chk_order_items_planned CHECK (
        planned_quantity IS NOT NULL
        AND planned_quantity > 0
        AND planned_quantity = FLOOR(planned_quantity)
        AND (
          (sale_type = 'PIECE' AND planned_weight IS NULL)
          OR
          (sale_type = 'WEIGHT' AND planned_weight IS NOT NULL
            AND planned_weight > 0)
        )
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE order_items DROP CHECK chk_order_items_planned',
    );
    await queryRunner.query(`
      UPDATE order_items
      SET planned_quantity = NULL, actual_quantity = NULL
      WHERE sale_type = 'WEIGHT'
    `);
    await queryRunner.query(`
      ALTER TABLE order_items
      ADD CONSTRAINT chk_order_items_planned CHECK (
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
      )
    `);
  }
}
