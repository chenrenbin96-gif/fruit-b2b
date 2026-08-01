import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { CustomerEntity } from '../../customers/entities/customer.entities';
import { DeliveryEntity } from '../../deliveries/entities/delivery.entity';
import { SkuEntity } from '../../products/entities/product.entities';
import { WarehouseEntity } from '../../system/entities/system.entities';
import {
  PickingTaskEntity,
  ShippingPackageEntity,
} from './warehouse-task.entities';

export type OrderStatus =
  | 'CREATED'
  | 'WAITING_REVIEW'
  | 'APPROVED'
  | 'PICKING'
  | 'WEIGHING'
  | 'WAITING_DELIVERY'
  | 'DELIVERING'
  | 'COMPLETED'
  | 'CANCELLED';

@Entity({ name: 'purchase_carts' })
@Index(['tenantId', 'customerId', 'status'])
export class PurchaseCartEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'customer_id', type: 'bigint', unsigned: true })
  customerId!: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'SUBMITTED';

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({
    name: 'submitted_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  submittedAt!: Date | null;

  @OneToMany(() => PurchaseCartItemEntity, (item) => item.cart)
  items!: PurchaseCartItemEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'purchase_cart_items' })
@Index(['cartId', 'skuId'], { unique: true })
export class PurchaseCartItemEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'cart_id', type: 'bigint', unsigned: true })
  cartId!: string;

  @Column({ name: 'sku_id', type: 'bigint', unsigned: true })
  skuId!: string;

  @Column({ name: 'sale_type', type: 'varchar', length: 20 })
  saleType!: 'PIECE' | 'WEIGHT';

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  quantity!: string | null;

  @Column({
    name: 'estimated_weight',
    type: 'decimal',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  estimatedWeight!: string | null;

  @ManyToOne(() => PurchaseCartEntity, (cart) => cart.items)
  @JoinColumn({ name: 'cart_id' })
  cart!: PurchaseCartEntity;

  @ManyToOne(() => SkuEntity)
  @JoinColumn({ name: 'sku_id' })
  sku!: SkuEntity;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'orders' })
@Index(['tenantId', 'orderNo'], { unique: true })
export class OrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'order_no', type: 'varchar', length: 40 })
  orderNo!: string;

  @Column({ name: 'source_cart_id', type: 'bigint', unsigned: true })
  sourceCartId!: string;

  @Column({ name: 'customer_id', type: 'bigint', unsigned: true })
  customerId!: string;

  @Column({ name: 'warehouse_id', type: 'bigint', unsigned: true })
  warehouseId!: string;

  @Column({
    name: 'estimated_product_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  estimatedProductAmount!: string;

  @Column({
    name: 'estimated_discount_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  estimatedDiscountAmount!: string;

  @Column({ name: 'estimated_amount', type: 'decimal', precision: 14, scale: 2 })
  estimatedAmount!: string;

  @Column({
    name: 'final_product_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  finalProductAmount!: string | null;

  @Column({
    name: 'final_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  finalAmount!: string | null;

  @Column({ name: 'amount_adjustment_type', type: 'varchar', length: 20, default: 'NONE' })
  amountAdjustmentType!: 'NONE' | 'SUPPLEMENT' | 'REFUND';

  @Column({ name: 'amount_adjustment', type: 'decimal', precision: 14, scale: 2, default: 0 })
  amountAdjustment!: string;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 14, scale: 2 })
  discountAmount!: string;

  @Column({ name: 'shipping_fee', type: 'decimal', precision: 14, scale: 2 })
  shippingFee!: string;

  @Column({
    name: 'estimated_weight',
    type: 'decimal',
    precision: 18,
    scale: 3,
    nullable: true,
  })
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

  @Column({ name: 'shipping_status', type: 'varchar', length: 30 })
  shippingStatus!: string;

  @Column({ name: 'coupon_id', type: 'bigint', unsigned: true, nullable: true })
  couponId!: string | null;

  @Column({
    name: 'customer_coupon_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  customerCouponId!: string | null;

  @Column({
    name: 'delivery_region_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  deliveryRegionId!: string | null;

  @Column({ type: 'varchar', length: 30 })
  status!: OrderStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'reviewed_by', type: 'bigint', unsigned: true, nullable: true })
  reviewedBy!: string | null;

  @Column({ name: 'reviewed_at', type: 'datetime', precision: 3, nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 500, nullable: true })
  rejectionReason!: string | null;

  @Column({ name: 'cancelled_by_type', type: 'varchar', length: 20, nullable: true })
  cancelledByType!: string | null;

  @Column({ name: 'cancelled_by_id', type: 'bigint', unsigned: true, nullable: true })
  cancelledById!: string | null;

  @Column({ name: 'cancellation_reason', type: 'varchar', length: 500, nullable: true })
  cancellationReason!: string | null;

  @Column({ name: 'cancelled_at', type: 'datetime', precision: 3, nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'expires_at', type: 'datetime', precision: 3 })
  expiresAt!: Date;

  @OneToMany(() => OrderItemEntity, (item) => item.order)
  items!: OrderItemEntity[];

  @ManyToOne(() => CustomerEntity)
  @JoinColumn({ name: 'customer_id' })
  customer!: CustomerEntity;

  @ManyToOne(() => WarehouseEntity)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: WarehouseEntity;

  @OneToMany(() => OrderStatusLogEntity, (log) => log.order)
  statusLogs!: OrderStatusLogEntity[];

  @OneToOne(() => DeliveryEntity, (delivery) => delivery.order)
  delivery!: DeliveryEntity | null;

  @OneToOne(() => PickingTaskEntity, (task) => task.order)
  pickingTask!: PickingTaskEntity | null;

  @OneToOne(() => ShippingPackageEntity, (shipment) => shipment.order)
  shippingPackage!: ShippingPackageEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'order_items' })
@Index(['orderId', 'skuId'], { unique: true })
export class OrderItemEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'order_id', type: 'bigint', unsigned: true })
  orderId!: string;

  @Column({ name: 'sku_id', type: 'bigint', unsigned: true })
  skuId!: string;

  @Column({ name: 'product_name', type: 'varchar', length: 150 })
  productName!: string;

  @Column({ name: 'sku_name', type: 'varchar', length: 150 })
  skuName!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  specification!: string | null;

  @Column({ name: 'sale_type', type: 'varchar', length: 20 })
  saleType!: 'PIECE' | 'WEIGHT';

  @Column({ name: 'planned_quantity', type: 'decimal', precision: 18, scale: 3, nullable: true })
  plannedQuantity!: string | null;

  @Column({ name: 'planned_weight', type: 'decimal', precision: 18, scale: 3, nullable: true })
  plannedWeight!: string | null;

  @Column({ name: 'actual_quantity', type: 'decimal', precision: 18, scale: 3, nullable: true })
  actualQuantity!: string | null;

  @Column({ name: 'actual_weight', type: 'decimal', precision: 18, scale: 3, nullable: true })
  actualWeight!: string | null;

  @Column({ name: 'actual_gross_weight', type: 'decimal', precision: 18, scale: 3, nullable: true })
  actualGrossWeight!: string | null;

  @Column({ name: 'actual_net_weight', type: 'decimal', precision: 18, scale: 3, nullable: true })
  actualNetWeight!: string | null;

  @Column({ name: 'piece_unit', type: 'varchar', length: 20, nullable: true })
  pieceUnit!: string | null;

  @Column({ name: 'weight_unit', type: 'varchar', length: 20, nullable: true })
  weightUnit!: string | null;

  @Column({ name: 'stock_unit', type: 'varchar', length: 20 })
  stockUnit!: string;

  @Column({ name: 'price_unit', type: 'varchar', length: 20 })
  priceUnit!: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 14, scale: 4 })
  unitPrice!: string;

  @Column({
    name: 'final_unit_price',
    type: 'decimal',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  finalUnitPrice!: string | null;

  @Column({ name: 'gross_weight_unit_price', type: 'decimal', precision: 14, scale: 4, nullable: true })
  grossWeightUnitPrice!: string | null;

  @Column({ name: 'net_weight_unit_price', type: 'decimal', precision: 14, scale: 4, nullable: true })
  netWeightUnitPrice!: string | null;

  @Column({ name: 'estimated_amount', type: 'decimal', precision: 14, scale: 2 })
  estimatedAmount!: string;

  @Column({ name: 'final_amount', type: 'decimal', precision: 14, scale: 2, nullable: true })
  finalAmount!: string | null;

  @ManyToOne(() => OrderEntity, (order) => order.items)
  @JoinColumn({ name: 'order_id' })
  order!: OrderEntity;

  @ManyToOne(() => SkuEntity)
  @JoinColumn({ name: 'sku_id' })
  sku!: SkuEntity;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'order_status_logs' })
export class OrderStatusLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'order_id', type: 'bigint', unsigned: true })
  orderId!: string;

  @Column({ name: 'from_status', type: 'varchar', length: 30, nullable: true })
  fromStatus!: OrderStatus | null;

  @Column({ name: 'to_status', type: 'varchar', length: 30 })
  toStatus!: OrderStatus;

  @Column({ type: 'varchar', length: 40 })
  action!: string;

  @Column({ name: 'operator_type', type: 'varchar', length: 20 })
  operatorType!: 'CUSTOMER_ACCOUNT' | 'EMPLOYEE' | 'SYSTEM';

  @Column({ name: 'operator_id', type: 'bigint', unsigned: true, nullable: true })
  operatorId!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @ManyToOne(() => OrderEntity, (order) => order.statusLogs)
  @JoinColumn({ name: 'order_id' })
  order!: OrderEntity;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
