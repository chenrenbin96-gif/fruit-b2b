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

import { OrderEntity } from '../../orders/entities/order.entities';
import { DeliveryRegionEntity } from '../../system/entities/system.entities';

@Entity({ name: 'shipping_rules' })
@Index(['tenantId', 'deliveryRegionId'], { unique: true })
export class ShippingRuleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'delivery_region_id', type: 'bigint', unsigned: true })
  deliveryRegionId!: string;
  @Column({ type: 'varchar', length: 100 })
  name!: string;
  @Column({ name: 'calculation_type', type: 'varchar', length: 20 })
  calculationType!: 'WEIGHT' | 'FIXED';
  @Column({ name: 'fixed_fee', type: 'decimal', precision: 14, scale: 2, nullable: true })
  fixedFee!: string | null;
  @Column({ name: 'price_per_weight', type: 'decimal', precision: 14, scale: 4, nullable: true })
  pricePerWeight!: string | null;
  @Column({ name: 'weight_unit', type: 'varchar', length: 20, nullable: true })
  weightUnit!: '斤' | '公斤' | null;
  @Column({ type: 'varchar', length: 20 })
  status!: 'ACTIVE' | 'DISABLED';
  @ManyToOne(() => DeliveryRegionEntity)
  @JoinColumn({ name: 'delivery_region_id' })
  region!: DeliveryRegionEntity;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'shipping_records' })
@Index(['orderId'], { unique: true })
export class ShippingRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'order_id', type: 'bigint', unsigned: true })
  orderId!: string;
  @Column({ name: 'shipping_rule_id', type: 'bigint', unsigned: true })
  shippingRuleId!: string;
  @Column({ name: 'delivery_region_id', type: 'bigint', unsigned: true })
  deliveryRegionId!: string;
  @Column({ name: 'estimated_weight', type: 'decimal', precision: 18, scale: 3, nullable: true })
  estimatedWeight!: string | null;
  @Column({
    name: 'actual_weight',
    type: 'decimal',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  actualWeight!: string | null;
  @Column({ name: 'weight_unit', type: 'varchar', length: 20 })
  weightUnit!: string;
  @Column({ name: 'shipping_price', type: 'decimal', precision: 14, scale: 4 })
  shippingPrice!: string;
  @Column({ name: 'shipping_fee', type: 'decimal', precision: 14, scale: 2 })
  shippingFee!: string;
  @Column({ type: 'varchar', length: 20 })
  status!: 'PENDING_CALCULATION' | 'COMPLETED';
  @ManyToOne(() => OrderEntity)
  @JoinColumn({ name: 'order_id' })
  order!: OrderEntity;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
