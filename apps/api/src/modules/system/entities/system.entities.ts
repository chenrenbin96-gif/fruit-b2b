import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'tenants' })
export class TenantEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'tenant_code', type: 'varchar', length: 32 })
  tenantCode!: string;

  @Column({ name: 'tenant_name', type: 'varchar', length: 100 })
  tenantName!: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 50, nullable: true })
  contactName!: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 30, nullable: true })
  contactPhone!: string | null;

  @Column({ name: 'expire_at', type: 'datetime', precision: 3, nullable: true })
  expireAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'stores' })
@Index(['tenantId', 'storeCode'], { unique: true })
export class StoreEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'store_code', type: 'varchar', length: 32 })
  storeCode!: string;

  @Column({ name: 'store_name', type: 'varchar', length: 100 })
  storeName!: string;

  @Column({ name: 'city_code', type: 'varchar', length: 20, nullable: true })
  cityCode!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address!: string | null;

  @Column({ name: 'contact_name', type: 'varchar', length: 50, nullable: true })
  contactName!: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 30, nullable: true })
  contactPhone!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: string;

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

@Entity({ name: 'warehouses' })
@Index(['tenantId', 'warehouseCode'], { unique: true })
export class WarehouseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({
    name: 'store_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  storeId!: string | null;

  @Column({ name: 'warehouse_code', type: 'varchar', length: 32 })
  warehouseCode!: string;

  @Column({ name: 'warehouse_name', type: 'varchar', length: 100 })
  warehouseName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address!: string | null;

  @Column({ name: 'contact_name', type: 'varchar', length: 50, nullable: true })
  contactName!: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 30, nullable: true })
  contactPhone!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: string;

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

@Entity({ name: 'delivery_regions' })
@Index(['tenantId', 'regionCode'], { unique: true })
export class DeliveryRegionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'region_code', type: 'varchar', length: 32 })
  regionCode!: string;

  @Column({ name: 'region_name', type: 'varchar', length: 100 })
  regionName!: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({ name: 'address_keywords', type: 'varchar', length: 500, nullable: true })
  addressKeywords!: string | null;

  @Column({
    name: 'min_order_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  minOrderAmount!: string;

  @Column({ type: 'int', default: 0 })
  sort!: number;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: string;

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

@Entity({ name: 'system_settings' })
@Index(['tenantId', 'settingKey'], { unique: true })
export class SystemSettingEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'setting_key', type: 'varchar', length: 100 })
  settingKey!: string;

  @Column({ name: 'value_type', type: 'varchar', length: 20 })
  valueType!: string;

  @Column({ name: 'setting_value', type: 'varchar', length: 1000 })
  settingValue!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Column({ name: 'updated_by', type: 'bigint', unsigned: true })
  updatedBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
