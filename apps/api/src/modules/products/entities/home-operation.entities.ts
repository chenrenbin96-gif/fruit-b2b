import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ProductEntity } from './product.entities';
import { CategoryEntity } from './product.entities';

@Entity({ name: 'home_banners' })
@Index(['tenantId', 'status', 'sort'])
export class HomeBannerEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'varchar', length: 240, nullable: true })
  subtitle!: string | null;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl!: string | null;

  @Column({ name: 'banner_type', type: 'varchar', length: 20 })
  bannerType!: 'ACTIVITY' | 'MARKET' | 'NEW_ARRIVAL';

  @Column({ name: 'link_type', type: 'varchar', length: 20 })
  linkType!: 'NONE' | 'PRODUCT' | 'CATEGORY' | 'URL';

  @Column({
    name: 'link_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  linkId!: string | null;

  @Column({ name: 'link_value', type: 'varchar', length: 500, nullable: true })
  linkValue!: string | null;

  @Column({ type: 'int', default: 0 })
  sort!: number;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'DISABLED';

  @Column({
    name: 'start_time',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  startTime!: Date | null;

  @Column({
    name: 'end_time',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  endTime!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'home_product_recommendations' })
@Index(['tenantId', 'recommendationType', 'sort'])
@Index(['tenantId', 'productId', 'recommendationType'], { unique: true })
export class HomeProductRecommendationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'product_id', type: 'bigint', unsigned: true })
  productId!: string;

  @Column({ name: 'recommendation_type', type: 'varchar', length: 20 })
  recommendationType!: 'RECOMMENDED' | 'HOT' | 'NEW_ARRIVAL' | 'SPECIAL';

  @Column({ type: 'int', default: 0 })
  sort!: number;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'DISABLED';

  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'product_id' })
  product!: ProductEntity;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'home_categories' })
@Index(['tenantId', 'categoryId'], { unique: true })
@Index(['tenantId', 'status', 'sort'])
export class HomeCategoryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'category_id', type: 'bigint', unsigned: true })
  categoryId!: string;

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({ type: 'int', default: 0 })
  sort!: number;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'DISABLED';

  @ManyToOne(() => CategoryEntity)
  @JoinColumn({ name: 'category_id' })
  category!: CategoryEntity;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}

@Entity({ name: 'home_products' })
@Index(['tenantId', 'productId', 'position'], { unique: true })
@Index(['tenantId', 'position', 'status', 'sort'])
export class HomeProductEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'product_id', type: 'bigint', unsigned: true })
  productId!: string;

  @Column({ type: 'varchar', length: 20 })
  position!: 'HOT' | 'NEW' | 'RECOMMEND';

  @Column({ type: 'int', default: 0 })
  sort!: number;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'DISABLED';

  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'product_id' })
  product!: ProductEntity;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
