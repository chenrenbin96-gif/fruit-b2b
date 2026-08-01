import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { RecordStatus } from './product.entities';

@Entity({ name: 'price_levels' })
@Index(['tenantId', 'levelId', 'skuId'], { unique: true })
export class PriceLevelEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'level_id', type: 'bigint', unsigned: true })
  levelId!: string;

  @Column({ name: 'sku_id', type: 'bigint', unsigned: true })
  skuId!: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  price!: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: RecordStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'customer_prices' })
@Index(['tenantId', 'customerId', 'skuId'], { unique: true })
export class CustomerPriceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'customer_id', type: 'bigint', unsigned: true })
  customerId!: string;

  @Column({ name: 'sku_id', type: 'bigint', unsigned: true })
  skuId!: string;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  price!: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: RecordStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'quantity_prices' })
@Index(['tenantId', 'skuId', 'minQuantity'], { unique: true })
export class QuantityPriceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'sku_id', type: 'bigint', unsigned: true })
  skuId!: string;

  @Column({
    name: 'min_quantity',
    type: 'decimal',
    precision: 18,
    scale: 3,
  })
  minQuantity!: string;

  @Column({
    name: 'max_quantity',
    type: 'decimal',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  maxQuantity!: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 4 })
  price!: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: RecordStatus;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
