import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

import type {
  CreateProductMediaDto,
  SortProductMediaDto,
} from './dto/product.dto';
import { ProductMediaEntity } from './entities/product-media.entity';
import { ProductEntity } from './entities/product.entities';

@Injectable()
export class ProductMediaService {
  constructor(private readonly dataSource: DataSource) {}

  async list(tenantId: string, productId: string, enabledOnly = false) {
    await this.requireProduct(tenantId, productId);
    const rows = await this.dataSource.getRepository(ProductMediaEntity).find({
      where: {
        tenantId,
        productId,
        ...(enabledOnly ? { status: 'ENABLE' as const } : {}),
      },
      order: { mediaType: 'DESC', sort: 'ASC', id: 'ASC' },
    });
    return rows.map((row) => this.view(row));
  }

  async create(tenantId: string, productId: string, dto: CreateProductMediaDto) {
    const id = await this.dataSource.transaction(async (manager) => {
      const product = await manager.getRepository(ProductEntity)
        .createQueryBuilder('product')
        .setLock('pessimistic_write')
        .where('product.id = :productId', { productId })
        .andWhere('product.tenant_id = :tenantId', { tenantId })
        .getOne();
      if (!product) throw this.notFound();
      const repository = manager.getRepository(ProductMediaEntity);
      const count = await repository.countBy({
        tenantId,
        productId,
        mediaType: dto.media_type,
      });
      const limit = dto.media_type === 'VIDEO' ? 1 : 6;
      if (count >= limit) {
        throw new BadRequestException({
          code:
            dto.media_type === 'VIDEO'
              ? 'PRODUCT_VIDEO_LIMIT_EXCEEDED'
              : 'PRODUCT_IMAGE_LIMIT_EXCEEDED',
          message:
            dto.media_type === 'VIDEO'
              ? '同一商品最多上传1个视频'
              : '同一商品最多上传6张主图',
        });
      }
      const saved = await repository.save({
        tenantId,
        productId,
        mediaType: dto.media_type,
        url: dto.url,
        thumbnailUrl: dto.thumbnail_url ?? null,
        sort: dto.sort ?? count,
        status: 'ENABLE',
      });
      if (dto.media_type === 'IMAGE' && !product.mainImage) {
        product.mainImage = dto.url;
        await manager.save(product);
      }
      return saved.id;
    });
    return (await this.list(tenantId, productId)).find((item) => item.id === id);
  }

  async sort(
    tenantId: string,
    productId: string,
    mediaId: string,
    dto: SortProductMediaDto,
  ) {
    const row = await this.dataSource.getRepository(ProductMediaEntity).findOneBy({
      id: mediaId,
      tenantId,
      productId,
    });
    if (!row) throw this.notFound();
    row.sort = dto.sort;
    await this.dataSource.getRepository(ProductMediaEntity).save(row);
    return this.view(row);
  }

  async remove(tenantId: string, productId: string, mediaId: string) {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ProductMediaEntity);
      const row = await repository.findOneBy({
        id: mediaId,
        tenantId,
        productId,
      });
      if (!row) throw this.notFound();
      await repository.delete(row.id);
      if (row.mediaType === 'IMAGE') {
        const product = await manager.findOneBy(ProductEntity, {
          id: productId,
          tenantId,
        });
        if (product?.mainImage === row.url) {
          const next = await repository.findOne({
            where: { tenantId, productId, mediaType: 'IMAGE', status: 'ENABLE' },
            order: { sort: 'ASC', id: 'ASC' },
          });
          product.mainImage = next?.url ?? null;
          await manager.save(product);
        }
      }
    });
    return { deleted: true };
  }

  private async requireProduct(tenantId: string, productId: string) {
    const product = await this.dataSource.getRepository(ProductEntity).findOneBy({
      id: productId,
      tenantId,
    });
    if (!product) throw this.notFound();
    return product;
  }

  private view(row: ProductMediaEntity) {
    return {
      id: row.id,
      product_id: row.productId,
      media_type: row.mediaType,
      url: row.url,
      thumbnail_url: row.thumbnailUrl,
      sort: row.sort,
      status: row.status,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  private notFound() {
    return new NotFoundException({
      code: 'PRODUCT_MEDIA_NOT_FOUND',
      message: '商品或媒体资源不存在',
    });
  }
}
