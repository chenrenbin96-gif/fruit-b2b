import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SkuEntity } from '../../products/entities/product.entities';

export type InventoryOperationType =
  | 'ADJUST_IN'
  | 'ADJUST_OUT'
  | 'SET'
  | 'ORDER_LOCK'
  | 'ORDER_RELEASE'
  | 'ORDER_FULFILL'
  | 'PURCHASE_IN'
  | 'PURCHASE_RETURN';

@Entity({ name: 'inventory' })
@Index(['tenantId', 'warehouseId', 'skuId'], { unique: true })
export class InventoryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'warehouse_id', type: 'bigint', unsigned: true })
  warehouseId!: string;

  @Column({ name: 'sku_id', type: 'bigint', unsigned: true })
  skuId!: string;

  @Column({ name: 'stock_unit', type: 'varchar', length: 20 })
  stockUnit!: string;

  @Column({
    name: 'stock_quantity',
    type: 'decimal',
    precision: 18,
    scale: 3,
    default: 0,
  })
  stockQuantity!: string;

  @Column({
    name: 'locked_quantity',
    type: 'decimal',
    precision: 18,
    scale: 3,
    default: 0,
  })
  lockedQuantity!: string;

  @Column({
    name: 'available_quantity',
    type: 'decimal',
    precision: 18,
    scale: 3,
    insert: false,
    update: false,
  })
  availableQuantity!: string;

  @Column({
    name: 'cost_price',
    type: 'decimal',
    precision: 14,
    scale: 4,
    default: 0,
  })
  costPrice!: string;

  @Column({ type: 'int', unsigned: true, default: 0 })
  version!: number;

  @ManyToOne(() => SkuEntity)
  @JoinColumn({ name: 'sku_id' })
  sku!: SkuEntity;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'inventory_logs' })
@Index(['tenantId', 'skuId', 'createdAt'])
export class InventoryLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'inventory_id', type: 'bigint', unsigned: true })
  inventoryId!: string;

  @Column({ name: 'warehouse_id', type: 'bigint', unsigned: true })
  warehouseId!: string;

  @Column({ name: 'sku_id', type: 'bigint', unsigned: true })
  skuId!: string;

  @Column({ name: 'operation_type', type: 'varchar', length: 30 })
  operationType!: InventoryOperationType;

  @Column({
    name: 'change_quantity',
    type: 'decimal',
    precision: 18,
    scale: 3,
  })
  changeQuantity!: string;

  @Column({
    name: 'locked_change_quantity',
    type: 'decimal',
    precision: 18,
    scale: 3,
    default: 0,
  })
  lockedChangeQuantity!: string;

  @Column({
    name: 'before_quantity',
    type: 'decimal',
    precision: 18,
    scale: 3,
  })
  beforeQuantity!: string;

  @Column({
    name: 'after_quantity',
    type: 'decimal',
    precision: 18,
    scale: 3,
  })
  afterQuantity!: string;

  @Column({
    name: 'before_locked_quantity',
    type: 'decimal',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  beforeLockedQuantity!: string | null;

  @Column({
    name: 'after_locked_quantity',
    type: 'decimal',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  afterLockedQuantity!: string | null;

  @Column({ name: 'stock_unit', type: 'varchar', length: 20 })
  stockUnit!: string;

  @Column({ type: 'varchar', length: 500 })
  reason!: string;

  @Column({ name: 'reference_type', type: 'varchar', length: 30, nullable: true })
  referenceType!: string | null;

  @Column({
    name: 'reference_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  referenceId!: string | null;

  @Column({ name: 'operator_type', type: 'varchar', length: 20 })
  operatorType!: 'CUSTOMER_ACCOUNT' | 'EMPLOYEE' | 'SYSTEM';

  @Column({
    name: 'operator_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  operatorId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
