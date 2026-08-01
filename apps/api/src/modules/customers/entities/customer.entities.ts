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
import { DeliveryRegionEntity } from '../../system/entities/system.entities';

@Entity({ name: 'customer_levels' })
@Index(['tenantId', 'levelCode'], { unique: true })
export class CustomerLevelEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Column({ name: 'level_code', type: 'varchar', length: 32 })
  levelCode!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Column({ type: 'int', default: 0 })
  sort!: number;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: string;

  @OneToMany(() => CustomerEntity, (customer) => customer.level)
  customers!: CustomerEntity[];

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

@Entity({ name: 'customers' })
@Index(['tenantId', 'customerNo'], { unique: true })
export class CustomerEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'customer_no', type: 'varchar', length: 32 })
  customerNo!: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 150 })
  customerName!: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 50 })
  contactName!: string;

  @Column({ type: 'varchar', length: 30 })
  phone!: string;

  @Column({ type: 'varchar', length: 255 })
  address!: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude!: string | null;

  @Column({ name: 'delivery_time', type: 'varchar', length: 100, nullable: true })
  deliveryTime!: string | null;

  @Column({ name: 'receiving_cycle', type: 'varchar', length: 100, nullable: true })
  receivingCycle!: string | null;

  @Column({
    name: 'delivery_region_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  deliveryRegionId!: string | null;

  @Column({ name: 'default_route', type: 'varchar', length: 100, nullable: true })
  defaultRoute!: string | null;

  @Column({ name: 'business_type', type: 'varchar', length: 32 })
  businessType!: string;

  @Column({ name: 'customer_type_id', type: 'bigint', unsigned: true, nullable: true })
  customerTypeId!: string | null;

  @Column({ name: 'group_id', type: 'bigint', unsigned: true, nullable: true })
  groupId!: string | null;

  @Column({ name: 'level_id', type: 'bigint', unsigned: true })
  levelId!: string;

  @Column({
    name: 'settlement_type',
    type: 'varchar',
    length: 20,
    default: 'CASH',
  })
  settlementType!: string;

  @Column({
    name: 'credit_days',
    type: 'int',
    unsigned: true,
    default: 0,
  })
  creditDays!: number;

  @Column({
    name: 'credit_limit',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  creditLimit!: string;

  @Column({ name: 'credit_enabled', type: 'boolean', default: false })
  creditEnabled!: boolean;

  @Column({
    name: 'balance_due',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  balanceDue!: string;

  @Column({
    name: 'sales_owner_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  salesOwnerId!: string | null;

  @Column({ name: 'salesperson_id', type: 'bigint', unsigned: true, nullable: true })
  salespersonId!: string | null;

  @Column({ name: 'unified_social_credit_code', type: 'varchar', length: 40, nullable: true })
  unifiedSocialCreditCode!: string | null;

  @Column({ name: 'certification_status', type: 'varchar', length: 20, default: 'UNVERIFIED' })
  certificationStatus!: string;

  @Column({ name: 'registration_channel', type: 'varchar', length: 30, default: 'ADMIN' })
  registrationChannel!: string;

  @Column({ name: 'cod_enabled', type: 'boolean', default: true })
  codEnabled!: boolean;

  @Column({ name: 'online_payment_enabled', type: 'boolean', default: false })
  onlinePaymentEnabled!: boolean;

  @Column({ name: 'balance_payment_enabled', type: 'boolean', default: false })
  balancePaymentEnabled!: boolean;

  @Column({ name: 'credit_payment_enabled', type: 'boolean', default: false })
  creditPaymentEnabled!: boolean;

  @Column({ name: 'order_review_mode', type: 'varchar', length: 20, default: 'SYSTEM' })
  orderReviewMode!: string;

  @Column({ name: 'min_order_amount', type: 'decimal', precision: 14, scale: 2, nullable: true })
  minOrderAmount!: string | null;

  @Column({ name: 'discount_rate', type: 'decimal', precision: 6, scale: 4, default: 1 })
  discountRate!: string;

  @Column({ name: 'debt_limit', type: 'decimal', precision: 14, scale: 2, nullable: true })
  debtLimit!: string | null;

  @Column({ name: 'print_templates', type: 'json', nullable: true })
  printTemplates!: Record<string, string> | null;

  @Column({ name: 'sales_remark', type: 'varchar', length: 1000, nullable: true })
  salesRemark!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: string;

  @ManyToOne(() => CustomerLevelEntity, (level) => level.customers)
  @JoinColumn({ name: 'level_id' })
  level!: CustomerLevelEntity;

  @ManyToOne(() => DeliveryRegionEntity)
  @JoinColumn({ name: 'delivery_region_id' })
  deliveryRegion!: DeliveryRegionEntity | null;

  @OneToMany(() => CustomerAccountEntity, (account) => account.customer)
  accounts!: CustomerAccountEntity[];

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

@Entity({ name: 'customer_accounts' })
@Index(['tenantId', 'phone'], { unique: true })
@Index(['tenantId', 'wxOpenid'], { unique: true })
export class CustomerAccountEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'customer_id', type: 'bigint', unsigned: true })
  customerId!: string;

  @Column({ name: 'account_name', type: 'varchar', length: 50 })
  accountName!: string;

  @Column({ type: 'varchar', length: 30 })
  phone!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'wx_openid', type: 'varchar', length: 128, nullable: true })
  wxOpenid!: string | null;

  @Column({ name: 'wx_unionid', type: 'varchar', length: 128, nullable: true })
  wxUnionid!: string | null;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: string;

  @Column({
    name: 'last_login_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  lastLoginAt!: Date | null;

  @ManyToOne(() => CustomerEntity, (customer) => customer.accounts)
  @JoinColumn({ name: 'customer_id' })
  customer!: CustomerEntity;

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

@Entity({ name: 'customer_settings' })
@Index(['tenantId', 'customerId'], { unique: true })
export class CustomerSettingEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'customer_id', type: 'bigint', unsigned: true })
  customerId!: string;

  @Column({
    name: 'first_order_min_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
  })
  firstOrderMinAmount!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
