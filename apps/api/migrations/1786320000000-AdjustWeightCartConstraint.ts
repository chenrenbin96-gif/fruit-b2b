import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AdjustWeightCartConstraint1786320000000
  implements MigrationInterface
{
  name = 'AdjustWeightCartConstraint1786320000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE purchase_cart_items DROP CHECK chk_purchase_cart_items_quantity',
    );
    await queryRunner.query(`
      UPDATE purchase_cart_items pci
      JOIN skus s ON s.id = pci.sku_id
      SET pci.quantity = GREATEST(
        1,
        CEIL(pci.estimated_weight / NULLIF(s.standard_weight, 0))
      ),
      pci.estimated_weight = s.standard_weight * GREATEST(
        1,
        CEIL(pci.estimated_weight / NULLIF(s.standard_weight, 0))
      )
      WHERE pci.sale_type = 'WEIGHT'
    `);
    await queryRunner.query(`
      ALTER TABLE purchase_cart_items
      ADD CONSTRAINT chk_purchase_cart_items_quantity CHECK (
        quantity IS NOT NULL
        AND quantity > 0
        AND quantity = FLOOR(quantity)
        AND (
          (sale_type = 'PIECE' AND estimated_weight IS NULL)
          OR
          (sale_type = 'WEIGHT' AND estimated_weight IS NOT NULL
            AND estimated_weight > 0)
        )
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE purchase_cart_items DROP CHECK chk_purchase_cart_items_quantity',
    );
    await queryRunner.query(`
      UPDATE purchase_cart_items
      SET quantity = NULL
      WHERE sale_type = 'WEIGHT'
    `);
    await queryRunner.query(`
      ALTER TABLE purchase_cart_items
      ADD CONSTRAINT chk_purchase_cart_items_quantity CHECK (
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
    `);
  }
}
