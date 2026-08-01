import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

import type { SaveProductDescriptionDto } from './dto/product.dto';
import { ProductDescriptionEntity } from './entities/product-description.entity';
import { ProductEntity } from './entities/product.entities';

@Injectable()
export class ProductDescriptionService {
  constructor(private readonly dataSource: DataSource) {}

  async list(tenantId: string, productId: string) {
    await this.requireProduct(tenantId, productId);
    const rows = await this.dataSource.getRepository(ProductDescriptionEntity).find({
      where: { tenantId, productId },
      order: { sort: 'ASC', id: 'ASC' },
    });
    return rows.map((row) => this.view(row));
  }

  async create(tenantId: string, productId: string, dto: SaveProductDescriptionDto) {
    await this.requireProduct(tenantId, productId);
    const content = this.validateContent(dto.content_json);
    const row = await this.dataSource.getRepository(ProductDescriptionEntity).save({
      tenantId,
      productId,
      contentJson: content,
      sort: dto.sort,
    });
    return this.view(row);
  }

  async update(
    tenantId: string,
    productId: string,
    id: string,
    dto: SaveProductDescriptionDto,
  ) {
    const repository = this.dataSource.getRepository(ProductDescriptionEntity);
    const row = await repository.findOneBy({ id, tenantId, productId });
    if (!row) throw this.notFound();
    row.contentJson = this.validateContent(dto.content_json);
    row.sort = dto.sort;
    return this.view(await repository.save(row));
  }

  async remove(tenantId: string, productId: string, id: string) {
    const result = await this.dataSource.getRepository(ProductDescriptionEntity)
      .delete({ id, tenantId, productId });
    if (!result.affected) throw this.notFound();
    return { deleted: true };
  }

  private validateContent(content: Record<string, unknown>) {
    if (content.type === 'TEXT' && typeof content.text === 'string' && content.text.trim()) {
      return { type: 'TEXT' as const, text: content.text.trim() };
    }
    if (
      content.type === 'IMAGE' &&
      typeof content.url === 'string' &&
      /^(\/uploads\/|https?:\/\/)/.test(content.url)
    ) {
      return { type: 'IMAGE' as const, url: content.url };
    }
    throw new BadRequestException({
      code: 'PRODUCT_DESCRIPTION_CONTENT_INVALID',
      message: '详情说明只支持非空文字节点或有效图片节点',
    });
  }

  private async requireProduct(tenantId: string, productId: string) {
    const product = await this.dataSource.getRepository(ProductEntity)
      .findOneBy({ id: productId, tenantId });
    if (!product) throw this.notFound();
  }

  private view(row: ProductDescriptionEntity) {
    return {
      id: row.id,
      product_id: row.productId,
      content_json: row.contentJson,
      sort: row.sort,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
    };
  }

  private notFound() {
    return new NotFoundException({
      code: 'PRODUCT_DESCRIPTION_NOT_FOUND',
      message: '商品或详情说明不存在',
    });
  }
}
