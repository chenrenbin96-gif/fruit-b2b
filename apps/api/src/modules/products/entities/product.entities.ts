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

export type RecordStatus = 'ACTIVE' | 'DISABLED';
export type ProductStatus = 'DRAFT' | 'ON_SALE' | 'OFF_SALE';
export type SaleType = 'PIECE' | 'WEIGHT';

@Entity({ name: 'categories' })
@Index(['tenantId', 'parentId', 'name'], { unique: true })
export class CategoryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({
    name: 'parent_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  parentId!: string | null;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image!: string | null;

  @Column({ type: 'int', default: 0 })
  sort!: number;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: RecordStatus;

  @ManyToOne(() => CategoryEntity, (category) => category.children)
  @JoinColumn({ name: 'parent_id' })
  parent!: CategoryEntity | null;

  @OneToMany(() => CategoryEntity, (category) => category.parent)
  children!: CategoryEntity[];

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

@Entity({ name: 'products' })
@Index(['tenantId', 'productCode'], { unique: true })
export class ProductEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'category_id', type: 'bigint', unsigned: true })
  categoryId!: string;

  @Column({ name: 'product_code', type: 'varchar', length: 32 })
  productCode!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  barcode!: string | null;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'main_image', type: 'varchar', length: 500, nullable: true })
  mainImage!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  origin!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  grade!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'purchase_manager_id', type: 'bigint', unsigned: true, nullable: true })
  purchaseManagerId!: string | null;

  @Column({ name: 'purchase_manager_name', type: 'varchar', length: 50, nullable: true })
  purchaseManagerName!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status!: ProductStatus;

  @ManyToOne(() => CategoryEntity)
  @JoinColumn({ name: 'category_id' })
  category!: CategoryEntity;

  @OneToMany(() => SkuEntity, (sku) => sku.product)
  skus!: SkuEntity[];

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

@Entity({ name: 'skus' })
@Index(['tenantId', 'skuCode'], { unique: true })
export class SkuEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'product_id', type: 'bigint', unsigned: true })
  productId!: string;

  @Column({ name: 'purchase_manager_id', type: 'bigint', unsigned: true, nullable: true })
  purchaseManagerId!: string | null;

  @Column({ name: 'purchase_manager_name', type: 'varchar', length: 50, nullable: true })
  purchaseManagerName!: string | null;

  @Column({ name: 'sku_code', type: 'varchar', length: 50 })
  skuCode!: string;

  @Column({ name: 'sku_name', type: 'varchar', length: 150 })
  skuName!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  specification!: string | null;

  @Column({ name: 'sale_type', type: 'varchar', length: 20 })
  saleType!: SaleType;

  @Column({ name: 'piece_unit', type: 'varchar', length: 20, nullable: true })
  pieceUnit!: string | null;

  @Column({ name: 'weight_unit', type: 'varchar', length: 20, nullable: true })
  weightUnit!: string | null;

  @Column({ name: 'stock_unit', type: 'varchar', length: 20 })
  stockUnit!: string;

  @Column({ name: 'price_unit', type: 'varchar', length: 20 })
  priceUnit!: string;

  @Column({
    name: 'standard_weight',
    type: 'decimal',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  standardWeight!: string | null;

  @Column({ name: 'weight_price_type', type: 'varchar', length: 30, nullable: true })
  weightPriceType!: 'ACTUAL_WEIGHT' | null;

  @Column({
    name: 'gross_weight_unit_price',
    type: 'decimal',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  grossWeightUnitPrice!: string | null;

  @Column({
    name: 'net_weight_unit_price',
    type: 'decimal',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  netWeightUnitPrice!: string | null;

  @Column({
    name: 'delivery_weight_per_piece',
    type: 'decimal',
    precision: 18,
    scale: 3,
    nullable: true,
  })
  deliveryWeightPerPiece!: string | null;

  @Column({
    name: 'delivery_weight_unit',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  deliveryWeightUnit!: string | null;

  @Column({
    name: 'cost_price',
    type: 'decimal',
    precision: 14,
    scale: 4,
    default: 0,
  })
  costPrice!: string;

  @Column({ name: 'base_price', type: 'decimal', precision: 14, scale: 4 })
  basePrice!: string;

  @Column({
    name: 'market_price',
    type: 'decimal',
    precision: 14,
    scale: 4,
    default: 0,
  })
  marketPrice!: string;

  @Column({
    name: 'stock_warning',
    type: 'decimal',
    precision: 18,
    scale: 3,
    default: 0,
  })
  stockWarning!: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: RecordStatus;

  @ManyToOne(() => ProductEntity, (product) => product.skus)
  @JoinColumn({ name: 'product_id' })
  product!: ProductEntity;

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
