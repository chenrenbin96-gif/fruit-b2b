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

import { SkuEntity } from '../../products/entities/product.entities';
import { WarehouseEntity } from '../../system/entities/system.entities';

@Entity({ name: 'suppliers' })
@Index(['tenantId', 'supplierNo'], { unique: true })
export class SupplierEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'supplier_no', type: 'varchar', length: 32 })
  supplierNo!: string;

  @Column({ name: 'supplier_name', type: 'varchar', length: 150 })
  supplierName!: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 50 })
  contactName!: string;

  @Column({ type: 'varchar', length: 30 })
  phone!: string;

  @Column({ type: 'varchar', length: 255 })
  address!: string;

  @Column({ name: 'supply_categories', type: 'json', nullable: true })
  supplyCategories!: string[] | null;

  @Column({ name: 'settlement_method', type: 'varchar', length: 30, nullable: true })
  settlementMethod!: string | null;

  @Column({ name: 'credit_days', type: 'int', unsigned: true, default: 0 })
  creditDays!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'DISABLED';

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'datetime', precision: 3 })
  deletedAt!: Date | null;
}

export type PurchaseOrderStatus =
  | 'PENDING_PURCHASE'
  | 'PURCHASING'
  | 'ARRIVED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'COMPLETED'
  | 'STOCKED'
  | 'CANCELLED';

@Entity({ name: 'purchase_orders' })
@Index(['tenantId', 'purchaseNo'], { unique: true })
export class PurchaseOrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'purchase_no', type: 'varchar', length: 32 })
  purchaseNo!: string;

  @Column({ name: 'purchase_type', type: 'varchar', length: 20, default: 'SUPPLIER' })
  purchaseType!: 'MARKET' | 'SUPPLIER';

  @Column({ name: 'source_type', type: 'varchar', length: 20, default: 'MANUAL' })
  sourceType!: 'MANUAL' | 'PLAN' | 'IMPORT';

  @Column({ name: 'supplier_id', type: 'bigint', unsigned: true })
  supplierId!: string;

  @Column({ name: 'warehouse_id', type: 'bigint', unsigned: true })
  warehouseId!: string;

  @Column({ name: 'responsible_person_id', type: 'bigint', unsigned: true, nullable: true })
  responsiblePersonId!: string | null;

  @Column({ name: 'purchaser_id', type: 'bigint', unsigned: true, nullable: true })
  purchaserId!: string | null;

  @Column({ type: 'varchar', length: 24, default: 'PENDING_PURCHASE' })
  status!: PurchaseOrderStatus;

  @Column({ name: 'purchase_date', type: 'date', nullable: true })
  purchaseDate!: string | null;

  @Column({ name: 'planned_delivery_date', type: 'date', nullable: true })
  plannedDeliveryDate!: string | null;

  @Column({ name: 'sort_mode', type: 'varchar', length: 20, default: 'ADDED' })
  sortMode!: 'ADDED' | 'CATEGORY';

  @Column({ name: 'update_last_purchase_price', type: 'boolean', default: true })
  updateLastPurchasePrice!: boolean;

  @Column({ name: 'total_amount', type: 'decimal', precision: 14, scale: 2 })
  totalAmount!: string;

  @Column({ name: 'received_amount', type: 'decimal', precision: 14, scale: 2, default: 0 })
  receivedAmount!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true })
  createdBy!: string;

  @Column({ name: 'submitted_at', type: 'datetime', precision: 3, nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'arrived_at', type: 'datetime', precision: 3, nullable: true })
  arrivedAt!: Date | null;

  @Column({ name: 'received_by', type: 'bigint', unsigned: true, nullable: true })
  receivedBy!: string | null;

  @Column({ name: 'received_at', type: 'datetime', precision: 3, nullable: true })
  receivedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'datetime', precision: 3, nullable: true })
  completedAt!: Date | null;

  @ManyToOne(() => SupplierEntity)
  @JoinColumn({ name: 'supplier_id' })
  supplier!: SupplierEntity;

  @ManyToOne(() => WarehouseEntity)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: WarehouseEntity;

  @OneToMany(() => PurchaseOrderItemEntity, (item) => item.purchaseOrder)
  items!: PurchaseOrderItemEntity[];

  @OneToMany(() => PurchaseReceiptEntity, (receipt) => receipt.purchaseOrder)
  receipts!: PurchaseReceiptEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'purchase_order_items' })
@Index(['purchaseOrderId', 'skuId'], { unique: true })
export class PurchaseOrderItemEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'purchase_order_id', type: 'bigint', unsigned: true })
  purchaseOrderId!: string;

  @Column({ name: 'sku_id', type: 'bigint', unsigned: true })
  skuId!: string;

  @Column({ name: 'product_name', type: 'varchar', length: 150 })
  productName!: string;

  @Column({ name: 'sku_name', type: 'varchar', length: 150 })
  skuName!: string;

  @Column({ name: 'sale_type', type: 'varchar', length: 20 })
  saleType!: 'PIECE' | 'WEIGHT';

  @Column({ name: 'ordered_quantity', type: 'decimal', precision: 18, scale: 3 })
  orderedQuantity!: string;

  @Column({ name: 'received_quantity', type: 'decimal', precision: 18, scale: 3 })
  receivedQuantity!: string;

  @Column({ name: 'purchase_unit', type: 'varchar', length: 20 })
  purchaseUnit!: string;

  @Column({ name: 'purchase_price', type: 'decimal', precision: 14, scale: 4 })
  purchasePrice!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @ManyToOne(() => PurchaseOrderEntity, (order) => order.items)
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder!: PurchaseOrderEntity;

  @ManyToOne(() => SkuEntity)
  @JoinColumn({ name: 'sku_id' })
  sku!: SkuEntity;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'purchase_receipts' })
@Index(['tenantId', 'receiptNo'], { unique: true })
export class PurchaseReceiptEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'receipt_no', type: 'varchar', length: 32 })
  receiptNo!: string;

  @Column({ name: 'purchase_order_id', type: 'bigint', unsigned: true })
  purchaseOrderId!: string;

  @Column({ name: 'supplier_id', type: 'bigint', unsigned: true })
  supplierId!: string;

  @Column({ name: 'warehouse_id', type: 'bigint', unsigned: true })
  warehouseId!: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 14, scale: 2 })
  totalAmount!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: 'CONFIRMED';

  @Column({ name: 'received_by', type: 'bigint', unsigned: true })
  receivedBy!: string;

  @Column({ name: 'received_at', type: 'datetime', precision: 3 })
  receivedAt!: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;

  @ManyToOne(() => PurchaseOrderEntity, (order) => order.receipts)
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder!: PurchaseOrderEntity;

  @OneToMany(() => PurchaseReceiptItemEntity, (item) => item.receipt)
  items!: PurchaseReceiptItemEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

@Entity({ name: 'purchase_receipt_items' })
@Index(['receiptId', 'purchaseOrderItemId'], { unique: true })
export class PurchaseReceiptItemEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'receipt_id', type: 'bigint', unsigned: true })
  receiptId!: string;

  @Column({ name: 'purchase_order_item_id', type: 'bigint', unsigned: true })
  purchaseOrderItemId!: string;

  @Column({ name: 'sku_id', type: 'bigint', unsigned: true })
  skuId!: string;

  @Column({ name: 'received_quantity', type: 'decimal', precision: 18, scale: 3 })
  receivedQuantity!: string;

  @Column({ name: 'gross_weight', type: 'decimal', precision: 18, scale: 3, nullable: true })
  grossWeight!: string | null;

  @Column({ name: 'net_weight', type: 'decimal', precision: 18, scale: 3, nullable: true })
  netWeight!: string | null;

  @Column({ name: 'purchase_unit', type: 'varchar', length: 20 })
  purchaseUnit!: string;

  @Column({ name: 'purchase_price', type: 'decimal', precision: 14, scale: 4 })
  purchasePrice!: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: string;

  @Column({ name: 'inventory_cost_before', type: 'decimal', precision: 14, scale: 4 })
  inventoryCostBefore!: string;

  @Column({ name: 'inventory_cost_after', type: 'decimal', precision: 14, scale: 4 })
  inventoryCostAfter!: string;

  @ManyToOne(() => PurchaseReceiptEntity, (receipt) => receipt.items)
  @JoinColumn({ name: 'receipt_id' })
  receipt!: PurchaseReceiptEntity;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

@Entity({ name: 'supplier_products' })
@Index(['tenantId', 'supplierId', 'skuId'], { unique: true })
export class SupplierProductEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'supplier_id', type: 'bigint', unsigned: true })
  supplierId!: string;
  @Column({ name: 'product_id', type: 'bigint', unsigned: true })
  productId!: string;
  @Column({ name: 'sku_id', type: 'bigint', unsigned: true })
  skuId!: string;
  @Column({ name: 'purchase_price', type: 'decimal', precision: 14, scale: 4 })
  purchasePrice!: string;
  @Column({ name: 'last_purchase_time', type: 'datetime', precision: 3, nullable: true })
  lastPurchaseTime!: Date | null;
  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'DISABLED';
  @ManyToOne(() => SupplierEntity)
  @JoinColumn({ name: 'supplier_id' })
  supplier!: SupplierEntity;
  @ManyToOne(() => SkuEntity)
  @JoinColumn({ name: 'sku_id' })
  sku!: SkuEntity;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'purchase_price_history' })
@Index(['tenantId', 'skuId', 'purchaseDate'])
export class PurchasePriceHistoryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'supplier_id', type: 'bigint', unsigned: true })
  supplierId!: string;
  @Column({ name: 'purchase_order_id', type: 'bigint', unsigned: true })
  purchaseOrderId!: string;
  @Column({ name: 'sku_id', type: 'bigint', unsigned: true })
  skuId!: string;
  @Column({ type: 'decimal', precision: 14, scale: 4 })
  price!: string;
  @Column({ type: 'decimal', precision: 18, scale: 3 })
  quantity!: string;
  @Column({ name: 'purchase_date', type: 'datetime', precision: 3 })
  purchaseDate!: Date;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}

@Entity({ name: 'purchase_plans' })
@Index(['tenantId', 'status', 'createdAt'])
export class PurchasePlanEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'sku_id', type: 'bigint', unsigned: true })
  skuId!: string;
  @Column({ name: 'supplier_id', type: 'bigint', unsigned: true, nullable: true })
  supplierId!: string | null;
  @Column({ name: 'current_stock', type: 'decimal', precision: 18, scale: 3 })
  currentStock!: string;
  @Column({ name: 'safe_stock', type: 'decimal', precision: 18, scale: 3 })
  safeStock!: string;
  @Column({ name: 'thirty_day_sales', type: 'decimal', precision: 18, scale: 3 })
  thirtyDaySales!: string;
  @Column({ name: 'supply_cycle_days', type: 'int', unsigned: true, default: 7 })
  supplyCycleDays!: number;
  @Column({ name: 'suggest_quantity', type: 'decimal', precision: 18, scale: 3 })
  suggestQuantity!: string;
  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status!: 'PENDING' | 'ORDERED' | 'IGNORED';
  @Column({ name: 'generated_order_id', type: 'bigint', unsigned: true, nullable: true })
  generatedOrderId!: string | null;
  @ManyToOne(() => SkuEntity)
  @JoinColumn({ name: 'sku_id' })
  sku!: SkuEntity;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'purchase_returns' })
@Index(['tenantId', 'returnNo'], { unique: true })
export class PurchaseReturnEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'return_no', type: 'varchar', length: 32 })
  returnNo!: string;
  @Column({ name: 'purchase_order_id', type: 'bigint', unsigned: true })
  purchaseOrderId!: string;
  @Column({ name: 'supplier_id', type: 'bigint', unsigned: true })
  supplierId!: string;
  @Column({ name: 'warehouse_id', type: 'bigint', unsigned: true })
  warehouseId!: string;
  @Column({ type: 'varchar', length: 20, default: 'PENDING_REVIEW' })
  status!: 'PENDING_REVIEW' | 'APPROVED' | 'COMPLETED' | 'CANCELLED';
  @Column({ type: 'varchar', length: 255 })
  reason!: string;
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  amount!: string;
  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null;
  @Column({ name: 'created_by', type: 'bigint', unsigned: true })
  createdBy!: string;
  @Column({ name: 'reviewed_by', type: 'bigint', unsigned: true, nullable: true })
  reviewedBy!: string | null;
  @Column({ name: 'reviewed_at', type: 'datetime', precision: 3, nullable: true })
  reviewedAt!: Date | null;
  @Column({ name: 'completed_at', type: 'datetime', precision: 3, nullable: true })
  completedAt!: Date | null;
  @OneToMany(() => PurchaseReturnItemEntity, (item) => item.purchaseReturn)
  items!: PurchaseReturnItemEntity[];
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'purchase_return_items' })
export class PurchaseReturnItemEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;
  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;
  @Column({ name: 'purchase_return_id', type: 'bigint', unsigned: true })
  purchaseReturnId!: string;
  @Column({ name: 'purchase_order_item_id', type: 'bigint', unsigned: true })
  purchaseOrderItemId!: string;
  @Column({ name: 'sku_id', type: 'bigint', unsigned: true })
  skuId!: string;
  @Column({ name: 'return_quantity', type: 'decimal', precision: 18, scale: 3 })
  returnQuantity!: string;
  @Column({ name: 'purchase_price', type: 'decimal', precision: 14, scale: 4 })
  purchasePrice!: string;
  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount!: string;
  @ManyToOne(() => PurchaseReturnEntity, (row) => row.items)
  @JoinColumn({ name: 'purchase_return_id' })
  purchaseReturn!: PurchaseReturnEntity;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;
}
