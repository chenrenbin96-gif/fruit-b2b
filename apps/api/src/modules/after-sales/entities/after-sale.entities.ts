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
import { OrderEntity, OrderItemEntity } from '../../orders/entities/order.entities';
import { SkuEntity } from '../../products/entities/product.entities';

export type AfterSaleStatus =
  | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSING'
  | 'COMPLETED' | 'CANCELLED';

@Entity({ name: 'after_sale_reasons' })
@Index(['tenantId', 'name'], { unique: true })
export class AfterSaleReasonEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true }) tenantId!: string;
  @Column({ type: 'varchar', length: 80 }) name!: string;
  @Column({ type: 'int', unsigned: true, default: 0 }) sort!: number;
  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' }) status!: 'ACTIVE' | 'INACTIVE';
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt!: Date;
}

@Entity({ name: 'after_sales_orders' })
@Index(['tenantId', 'afterSaleNo'], { unique: true })
@Index(['tenantId', 'customerId', 'status'])
export class AfterSaleOrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true }) tenantId!: string;
  @Column({ name: 'order_id', type: 'bigint', unsigned: true }) orderId!: string;
  @Column({ name: 'customer_id', type: 'bigint', unsigned: true }) customerId!: string;
  @Column({ name: 'after_sale_no', type: 'varchar', length: 40 }) afterSaleNo!: string;
  @Column({ type: 'varchar', length: 20, default: 'PENDING' }) status!: AfterSaleStatus;
  @Column({ name: 'reason_id', type: 'bigint', unsigned: true }) reasonId!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ name: 'refund_amount', type: 'decimal', precision: 14, scale: 2, default: 0 }) refundAmount!: string;
  @Column({ name: 'refund_type', type: 'varchar', length: 20, default: 'REFUND' }) refundType!: 'REFUND' | 'COMPENSATION';
  @Column({ name: 'review_remark', type: 'varchar', length: 500, nullable: true }) reviewRemark!: string | null;
  @Column({ name: 'reviewed_by', type: 'bigint', unsigned: true, nullable: true }) reviewedBy!: string | null;
  @Column({ name: 'reviewed_at', type: 'datetime', precision: 3, nullable: true }) reviewedAt!: Date | null;
  @Column({ name: 'completed_at', type: 'datetime', precision: 3, nullable: true }) completedAt!: Date | null;
  @ManyToOne(() => OrderEntity) @JoinColumn({ name: 'order_id' }) order!: OrderEntity;
  @ManyToOne(() => CustomerEntity) @JoinColumn({ name: 'customer_id' }) customer!: CustomerEntity;
  @ManyToOne(() => AfterSaleReasonEntity) @JoinColumn({ name: 'reason_id' }) reason!: AfterSaleReasonEntity;
  @OneToMany(() => AfterSaleItemEntity, (item) => item.afterSale) items!: AfterSaleItemEntity[];
  @OneToMany(() => AfterSaleMediaEntity, (media) => media.afterSale) media!: AfterSaleMediaEntity[];
  @OneToOne(() => AfterSaleRefundEntity, (refund) => refund.afterSale) refund!: AfterSaleRefundEntity | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 }) updatedAt!: Date;
}

@Entity({ name: 'after_sale_items' })
@Index(['afterSaleId', 'orderItemId'], { unique: true })
export class AfterSaleItemEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true }) tenantId!: string;
  @Column({ name: 'after_sale_id', type: 'bigint', unsigned: true }) afterSaleId!: string;
  @Column({ name: 'order_item_id', type: 'bigint', unsigned: true }) orderItemId!: string;
  @Column({ name: 'sku_id', type: 'bigint', unsigned: true }) skuId!: string;
  @Column({ type: 'decimal', precision: 18, scale: 3, nullable: true }) quantity!: string | null;
  @Column({ name: 'approved_quantity', type: 'decimal', precision: 18, scale: 3, nullable: true }) approvedQuantity!: string | null;
  @Column({ name: 'sale_type', type: 'varchar', length: 20 }) saleType!: 'PIECE' | 'WEIGHT';
  @Column({ name: 'requested_weight', type: 'decimal', precision: 18, scale: 3, nullable: true }) requestedWeight!: string | null;
  @Column({ name: 'approved_weight', type: 'decimal', precision: 18, scale: 3, nullable: true }) approvedWeight!: string | null;
  @Column({ name: 'refund_price', type: 'decimal', precision: 14, scale: 4 }) refundPrice!: string;
  @Column({ name: 'refund_amount', type: 'decimal', precision: 14, scale: 2 }) refundAmount!: string;
  @ManyToOne(() => AfterSaleOrderEntity, (order) => order.items) @JoinColumn({ name: 'after_sale_id' }) afterSale!: AfterSaleOrderEntity;
  @ManyToOne(() => OrderItemEntity) @JoinColumn({ name: 'order_item_id' }) orderItem!: OrderItemEntity;
  @ManyToOne(() => SkuEntity) @JoinColumn({ name: 'sku_id' }) sku!: SkuEntity;
}

@Entity({ name: 'after_sale_media' })
@Index(['afterSaleId', 'mediaType', 'sort'])
export class AfterSaleMediaEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true }) tenantId!: string;
  @Column({ name: 'after_sale_id', type: 'bigint', unsigned: true }) afterSaleId!: string;
  @Column({ name: 'media_type', type: 'varchar', length: 20 }) mediaType!: 'VIDEO' | 'IMAGE';
  @Column({ type: 'varchar', length: 1000 }) url!: string;
  @Column({ name: 'thumbnail_url', type: 'varchar', length: 1000, nullable: true }) thumbnailUrl!: string | null;
  @Column({ type: 'int', unsigned: true, default: 0 }) sort!: number;
  @ManyToOne(() => AfterSaleOrderEntity, (order) => order.media) @JoinColumn({ name: 'after_sale_id' }) afterSale!: AfterSaleOrderEntity;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt!: Date;
}

@Entity({ name: 'after_sale_refunds' })
@Index(['afterSaleId'], { unique: true })
export class AfterSaleRefundEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true }) tenantId!: string;
  @Column({ name: 'after_sale_id', type: 'bigint', unsigned: true }) afterSaleId!: string;
  @Column({ type: 'decimal', precision: 14, scale: 2 }) amount!: string;
  @Column({ type: 'varchar', length: 20, default: 'PENDING' }) status!: 'PENDING' | 'COMPLETED';
  @Column({ name: 'completed_by', type: 'bigint', unsigned: true, nullable: true }) completedBy!: string | null;
  @Column({ name: 'completed_at', type: 'datetime', precision: 3, nullable: true }) completedAt!: Date | null;
  @OneToOne(() => AfterSaleOrderEntity, (order) => order.refund) @JoinColumn({ name: 'after_sale_id' }) afterSale!: AfterSaleOrderEntity;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 }) createdAt!: Date;
}
