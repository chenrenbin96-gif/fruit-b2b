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

import { SkuEntity } from '../../products/entities/product.entities';
import { UserEntity } from '../../users/entities/user.entities';
import { WarehouseEntity } from '../../system/entities/system.entities';
import { OrderEntity, OrderItemEntity } from './order.entities';

export type PickingTaskStatus = 'WAITING' | 'PICKING' | 'DONE' | 'CANCELLED';
export type PackageStatus = 'WAITING' | 'PACKING' | 'DONE';

@Entity({ name: 'picking_tasks' })
@Index(['orderId'], { unique: true })
export class PickingTaskEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'order_id', type: 'bigint', unsigned: true })
  orderId!: string;
  @Column({ name: 'warehouse_id', type: 'bigint', unsigned: true })
  warehouseId!: string;
  @Column({ name: 'picker_id', type: 'bigint', unsigned: true, nullable: true })
  pickerId!: string | null;
  @Column({ type: 'varchar', length: 20 })
  status!: PickingTaskStatus;
  @Column({ name: 'started_at', type: 'datetime', precision: 3, nullable: true })
  startedAt!: Date | null;
  @Column({ name: 'completed_at', type: 'datetime', precision: 3, nullable: true })
  completedAt!: Date | null;
  @OneToOne(() => OrderEntity, (order) => order.pickingTask)
  @JoinColumn({ name: 'order_id' })
  order!: OrderEntity;
  @ManyToOne(() => WarehouseEntity)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: WarehouseEntity;
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'picker_id' })
  picker!: UserEntity | null;
  @OneToMany(() => PickingTaskItemEntity, (item) => item.task)
  items!: PickingTaskItemEntity[];
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'picking_task_items' })
@Index(['orderItemId'], { unique: true })
export class PickingTaskItemEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'task_id', type: 'bigint', unsigned: true })
  taskId!: string;
  @Column({ name: 'order_item_id', type: 'bigint', unsigned: true })
  orderItemId!: string;
  @Column({ name: 'sku_id', type: 'bigint', unsigned: true })
  skuId!: string;
  @Column({ name: 'planned_quantity', type: 'decimal', precision: 18, scale: 3 })
  plannedQuantity!: string;
  @Column({ name: 'picked_quantity', type: 'decimal', precision: 18, scale: 3, nullable: true })
  pickedQuantity!: string | null;
  @Column({ type: 'varchar', length: 20 })
  status!: 'WAITING' | 'DONE' | 'SHORT';
  @ManyToOne(() => PickingTaskEntity, (task) => task.items)
  @JoinColumn({ name: 'task_id' })
  task!: PickingTaskEntity;
  @OneToOne(() => OrderItemEntity)
  @JoinColumn({ name: 'order_item_id' })
  orderItem!: OrderItemEntity;
  @ManyToOne(() => SkuEntity)
  @JoinColumn({ name: 'sku_id' })
  sku!: SkuEntity;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'shipping_packages' })
@Index(['orderId'], { unique: true })
export class ShippingPackageEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'order_id', type: 'bigint', unsigned: true })
  orderId!: string;
  @Column({ name: 'package_no', type: 'varchar', length: 40 })
  packageNo!: string;
  @Column({ name: 'packer_id', type: 'bigint', unsigned: true, nullable: true })
  packerId!: string | null;
  @Column({ name: 'outbound_by', type: 'bigint', unsigned: true, nullable: true })
  outboundBy!: string | null;
  @Column({ type: 'varchar', length: 20 })
  status!: PackageStatus;
  @Column({ name: 'started_at', type: 'datetime', precision: 3, nullable: true })
  startedAt!: Date | null;
  @Column({ name: 'completed_at', type: 'datetime', precision: 3, nullable: true })
  completedAt!: Date | null;
  @Column({ name: 'outbound_at', type: 'datetime', precision: 3, nullable: true })
  outboundAt!: Date | null;
  @OneToOne(() => OrderEntity, (order) => order.shippingPackage)
  @JoinColumn({ name: 'order_id' })
  order!: OrderEntity;
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'packer_id' })
  packer!: UserEntity | null;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
