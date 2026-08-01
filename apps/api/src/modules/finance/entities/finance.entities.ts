import {
  Column,
  CreateDateColumn,
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
import { UserEntity } from '../../users/entities/user.entities';

export type ReceivableStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'WECHAT' | 'ALIPAY';

@Entity({ name: 'receivables' })
@Index(['tenantId', 'receivableNo'], { unique: true })
@Index(['orderId'], { unique: true })
export class ReceivableEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'receivable_no', type: 'varchar', length: 40 })
  receivableNo!: string;
  @Column({ name: 'customer_id', type: 'bigint', unsigned: true })
  customerId!: string;
  @Column({ name: 'order_id', type: 'bigint', unsigned: true })
  orderId!: string;
  @Column({ name: 'order_amount', type: 'decimal', precision: 14, scale: 2 })
  orderAmount!: string;
  @Column({ name: 'discount_amount', type: 'decimal', precision: 14, scale: 2 })
  discountAmount!: string;
  @Column({ name: 'shipping_fee', type: 'decimal', precision: 14, scale: 2 })
  shippingFee!: string;
  @Column({ name: 'final_amount', type: 'decimal', precision: 14, scale: 2 })
  finalAmount!: string;
  @Column({ name: 'receivable_amount', type: 'decimal', precision: 14, scale: 2 })
  receivableAmount!: string;
  @Column({ name: 'paid_amount', type: 'decimal', precision: 14, scale: 2 })
  paidAmount!: string;
  @Column({ name: 'remaining_amount', type: 'decimal', precision: 14, scale: 2 })
  remainingAmount!: string;
  @Column({ type: 'varchar', length: 20 })
  status!: ReceivableStatus;
  @Column({ name: 'bill_date', type: 'datetime', precision: 3 })
  billDate!: Date;
  @Column({ name: 'due_date', type: 'datetime', precision: 3 })
  dueDate!: Date;
  @Column({ name: 'settled_at', type: 'datetime', precision: 3, nullable: true })
  settledAt!: Date | null;
  @ManyToOne(() => CustomerEntity)
  @JoinColumn({ name: 'customer_id' })
  customer!: CustomerEntity;
  @ManyToOne(() => OrderEntity)
  @JoinColumn({ name: 'order_id' })
  order!: OrderEntity;
  @OneToMany(() => PaymentAllocationEntity, (item) => item.receivable)
  allocations!: PaymentAllocationEntity[];
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'payments' })
@Index(['tenantId', 'paymentNo'], { unique: true })
export class PaymentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'payment_no', type: 'varchar', length: 40 })
  paymentNo!: string;
  @Column({ name: 'customer_id', type: 'bigint', unsigned: true })
  customerId!: string;
  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: string;
  @Column({ name: 'payment_method', type: 'varchar', length: 20 })
  paymentMethod!: PaymentMethod;
  @Column({ name: 'payment_time', type: 'datetime', precision: 3 })
  paymentTime!: Date;
  @Column({ name: 'operator_id', type: 'bigint', unsigned: true })
  operatorId!: string;
  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;
  @ManyToOne(() => CustomerEntity)
  @JoinColumn({ name: 'customer_id' })
  customer!: CustomerEntity;
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'operator_id' })
  operator!: UserEntity;
  @OneToMany(() => PaymentAllocationEntity, (item) => item.payment)
  allocations!: PaymentAllocationEntity[];
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

@Entity({ name: 'payment_allocations' })
@Index(['paymentId', 'receivableId'], { unique: true })
export class PaymentAllocationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'payment_id', type: 'bigint', unsigned: true })
  paymentId!: string;
  @Column({ name: 'receivable_id', type: 'bigint', unsigned: true })
  receivableId!: string;
  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: string;
  @ManyToOne(() => PaymentEntity, (payment) => payment.allocations)
  @JoinColumn({ name: 'payment_id' })
  payment!: PaymentEntity;
  @ManyToOne(() => ReceivableEntity, (receivable) => receivable.allocations)
  @JoinColumn({ name: 'receivable_id' })
  receivable!: ReceivableEntity;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
