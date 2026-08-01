import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CustomerEntity } from '../../customers/entities/customer.entities';
import { OrderEntity } from '../../orders/entities/order.entities';

export type CouponType =
  | 'ORDER_REDUCTION'
  | 'PRODUCT'
  | 'CATEGORY'
  | 'NEW_CUSTOMER'
  | 'CUSTOMER_EXCLUSIVE';

@Entity({ name: 'coupons' })
export class CouponEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'coupon_type', type: 'varchar', length: 30 })
  couponType!: CouponType;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 14, scale: 2 })
  discountAmount!: string;

  @Column({ name: 'min_amount', type: 'decimal', precision: 14, scale: 2 })
  minAmount!: string;

  @Column({ name: 'total_limit', type: 'int', unsigned: true, nullable: true })
  totalLimit!: number | null;

  @Column({ name: 'issued_count', type: 'int', unsigned: true })
  issuedCount!: number;

  @Column({ name: 'used_count', type: 'int', unsigned: true })
  usedCount!: number;

  @Column({ name: 'per_customer_limit', type: 'int', unsigned: true })
  perCustomerLimit!: number;

  @Column({ name: 'start_time', type: 'datetime', precision: 3 })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'datetime', precision: 3 })
  endTime!: Date;

  @Column({ type: 'varchar', length: 20 })
  status!: 'DRAFT' | 'ACTIVE' | 'DISABLED';

  @Column({ name: 'created_by', type: 'bigint', unsigned: true })
  createdBy!: string;

  @OneToMany(() => CouponProductEntity, (item) => item.coupon)
  products!: CouponProductEntity[];

  @OneToMany(() => CouponCategoryEntity, (item) => item.coupon)
  categories!: CouponCategoryEntity[];

  @OneToMany(() => CouponCustomerLevelEntity, (item) => item.coupon)
  levels!: CouponCustomerLevelEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  deletedAt!: Date | null;
}

@Entity({ name: 'coupon_products' })
export class CouponProductEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'coupon_id', type: 'bigint', unsigned: true })
  couponId!: string;
  @Column({ name: 'product_id', type: 'bigint', unsigned: true })
  productId!: string;
  @ManyToOne(() => CouponEntity, (coupon) => coupon.products)
  @JoinColumn({ name: 'coupon_id' })
  coupon!: CouponEntity;
}

@Entity({ name: 'coupon_categories' })
export class CouponCategoryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'coupon_id', type: 'bigint', unsigned: true })
  couponId!: string;
  @Column({ name: 'category_id', type: 'bigint', unsigned: true })
  categoryId!: string;
  @ManyToOne(() => CouponEntity, (coupon) => coupon.categories)
  @JoinColumn({ name: 'coupon_id' })
  coupon!: CouponEntity;
}

@Entity({ name: 'coupon_customer_levels' })
export class CouponCustomerLevelEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'coupon_id', type: 'bigint', unsigned: true })
  couponId!: string;
  @Column({ name: 'level_id', type: 'bigint', unsigned: true })
  levelId!: string;
  @ManyToOne(() => CouponEntity, (coupon) => coupon.levels)
  @JoinColumn({ name: 'coupon_id' })
  coupon!: CouponEntity;
}

@Entity({ name: 'customer_coupons' })
@Index(['tenantId', 'customerId', 'status'])
export class CustomerCouponEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'customer_id', type: 'bigint', unsigned: true })
  customerId!: string;
  @Column({ name: 'coupon_id', type: 'bigint', unsigned: true })
  couponId!: string;
  @Column({ type: 'varchar', length: 20 })
  status!: 'AVAILABLE' | 'LOCKED' | 'USED' | 'EXPIRED' | 'INVALID';
  @Column({ name: 'locked_order_id', type: 'bigint', unsigned: true, nullable: true })
  lockedOrderId!: string | null;
  @Column({ name: 'receive_time', type: 'datetime', precision: 3 })
  receiveTime!: Date;
  @Column({ name: 'locked_at', type: 'datetime', precision: 3, nullable: true })
  lockedAt!: Date | null;
  @Column({ name: 'use_time', type: 'datetime', precision: 3, nullable: true })
  useTime!: Date | null;
  @ManyToOne(() => CouponEntity)
  @JoinColumn({ name: 'coupon_id' })
  coupon!: CouponEntity;
  @ManyToOne(() => CustomerEntity)
  @JoinColumn({ name: 'customer_id' })
  customer!: CustomerEntity;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'coupon_records' })
@Index(['orderId'], { unique: true })
export class CouponRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'coupon_id', type: 'bigint', unsigned: true })
  couponId!: string;
  @Column({ name: 'customer_coupon_id', type: 'bigint', unsigned: true })
  customerCouponId!: string;
  @Column({ name: 'customer_id', type: 'bigint', unsigned: true })
  customerId!: string;
  @Column({ name: 'order_id', type: 'bigint', unsigned: true })
  orderId!: string;
  @Column({ type: 'varchar', length: 20 })
  status!: 'LOCKED' | 'USED' | 'RELEASED' | 'INVALIDATED';
  @Column({ name: 'eligible_amount', type: 'decimal', precision: 14, scale: 2 })
  eligibleAmount!: string;
  @Column({ name: 'discount_amount', type: 'decimal', precision: 14, scale: 2 })
  discountAmount!: string;
  @Column({ type: 'varchar', length: 500, nullable: true })
  reason!: string | null;
  @ManyToOne(() => OrderEntity)
  @JoinColumn({ name: 'order_id' })
  order!: OrderEntity;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
