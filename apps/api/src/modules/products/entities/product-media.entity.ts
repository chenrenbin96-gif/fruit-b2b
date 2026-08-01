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

@Entity({ name: 'product_media' })
@Index(['tenantId', 'productId', 'mediaType', 'sort'])
export class ProductMediaEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'tenant_id', type: 'bigint', unsigned: true })
  tenantId!: string;

  @Column({ name: 'product_id', type: 'bigint', unsigned: true })
  productId!: string;

  @Column({ name: 'media_type', type: 'varchar', length: 20 })
  mediaType!: 'VIDEO' | 'IMAGE';

  @Column({ type: 'varchar', length: 500 })
  url!: string;

  @Column({ name: 'thumbnail_url', type: 'varchar', length: 500, nullable: true })
  thumbnailUrl!: string | null;

  @Column({ type: 'int', default: 0 })
  sort!: number;

  @Column({ type: 'varchar', length: 20, default: 'ENABLE' })
  status!: 'ENABLE' | 'DISABLE';

  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'product_id' })
  product!: ProductEntity;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt!: Date;
}
