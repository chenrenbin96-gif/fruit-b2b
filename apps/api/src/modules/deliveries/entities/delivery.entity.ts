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

import { OrderEntity } from '../../orders/entities/order.entities';
import { UserEntity } from '../../users/entities/user.entities';

export type DeliveryStatus =
  | 'WAITING'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'FAILED';

@Entity({ name: 'deliveries' })
@Index(['orderId'], { unique: true })
export class DeliveryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'order_id', type: 'bigint', unsigned: true })
  orderId!: string;
  @Column({ name: 'delivery_no', type: 'varchar', length: 40 })
  deliveryNo!: string;
  @Column({ name: 'delivery_person_id', type: 'bigint', unsigned: true, nullable: true })
  deliveryPersonId!: string | null;
  @Column({ name: 'customer_name', type: 'varchar', length: 150 })
  customerName!: string;
  @Column({ type: 'varchar', length: 30 })
  phone!: string;
  @Column({ type: 'varchar', length: 255 })
  address!: string;
  @Column({ type: 'varchar', length: 20 })
  status!: DeliveryStatus;
  @Column({ name: 'assigned_at', type: 'datetime', precision: 3, nullable: true })
  assignedAt!: Date | null;
  @Column({ name: 'started_at', type: 'datetime', precision: 3, nullable: true })
  startedAt!: Date | null;
  @Column({ name: 'delivered_at', type: 'datetime', precision: 3, nullable: true })
  deliveredAt!: Date | null;
  @Column({ name: 'signed_by', type: 'varchar', length: 50, nullable: true })
  signedBy!: string | null;
  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;
  @OneToOne(() => OrderEntity, (order) => order.delivery)
  @JoinColumn({ name: 'order_id' })
  order!: OrderEntity;
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'delivery_person_id' })
  deliveryPerson!: UserEntity | null;
  @OneToMany(() => DeliveryLogEntity, (log) => log.delivery)
  logs!: DeliveryLogEntity[];
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'delivery_logs' })
@Index(['deliveryId', 'createdAt'])
export class DeliveryLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'delivery_id', type: 'bigint', unsigned: true })
  deliveryId!: string;
  @Column({ name: 'order_id', type: 'bigint', unsigned: true })
  orderId!: string;
  @Column({ name: 'delivery_person_id', type: 'bigint', unsigned: true, nullable: true })
  deliveryPersonId!: string | null;
  @Column({ type: 'varchar', length: 20 })
  status!: DeliveryStatus;
  @Column({ name: 'reason_code', type: 'varchar', length: 30, nullable: true })
  reasonCode!: 'CUSTOMER_REJECTED' | 'UNREACHABLE' | 'ADDRESS_ERROR' | 'OTHER' | null;
  @Column({ type: 'varchar', length: 500, nullable: true })
  reason!: string | null;
  @ManyToOne(() => DeliveryEntity, (delivery) => delivery.logs)
  @JoinColumn({ name: 'delivery_id' })
  delivery!: DeliveryEntity;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
