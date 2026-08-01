import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { IsNull, Repository } from 'typeorm';

import { REDIS_CLIENT } from '../../infrastructure/redis/redis.constants';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/product.dto';
import { CategoryEntity, ProductEntity } from './entities/product.entities';

export type CategoryNode = {
  id: string;
  parent_id: string | null;
  name: string;
  image: string | null;
  sort: number;
  status: string;
  children: CategoryNode[];
};

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
    @InjectRepository(CategoryEntity)
    private readonly categories: Repository<CategoryEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
  ) {}

  async tree(tenantId: string, activeOnly = false): Promise<CategoryNode[]> {
    const cacheKey = `catalog:category-tree:${tenantId}:${activeOnly ? 'active' : 'all'}`;
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as CategoryNode[];
    } catch {
      // Catalog remains available if Redis is temporarily unavailable.
    }
    const categories = await this.categories.find({
      where: {
        tenantId,
        ...(activeOnly ? { status: 'ACTIVE' as const } : {}),
      },
      order: { sort: 'ASC', id: 'ASC' },
    });
    const nodes = new Map<string, CategoryNode>();
    for (const category of categories) {
      nodes.set(category.id, this.view(category));
    }
    const roots: CategoryNode[] = [];
    for (const category of categories) {
      const node = nodes.get(category.id);
      if (!node) continue;
      if (category.parentId) {
        nodes.get(category.parentId)?.children.push(node);
      } else {
        roots.push(node);
      }
    }
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(roots),
        'EX',
        this.config.get<number>('CATEGORY_CACHE_TTL_SECONDS', 300),
      );
    } catch {
      // Database is the source of truth; cache writes are best effort.
    }
    return roots;
  }

  async create(tenantId: string, dto: CreateCategoryDto) {
    await this.validateParent(tenantId, dto.parent_id);
    const category = this.categories.create({
      tenantId,
      parentId: dto.parent_id ?? null,
      name: dto.name.trim(),
      image: dto.image ?? null,
      sort: dto.sort ?? 0,
      status: dto.status ?? 'ACTIVE',
    });
    const result = this.view(await this.categories.save(category));
    await this.invalidateTreeCache(tenantId);
    return result;
  }

  async update(tenantId: string, id: string, dto: UpdateCategoryDto) {
    const category = await this.require(tenantId, id);
    if (dto.parent_id === id) {
      throw new BadRequestException({
        code: 'CATEGORY_PARENT_INVALID',
        message: '分类不能将自身设置为上级',
      });
    }
    await this.validateParent(tenantId, dto.parent_id);
    if (dto.parent_id) {
      const child = await this.categories.findOneBy({
        tenantId,
        parentId: id,
      });
      if (child) {
        throw new BadRequestException({
          code: 'CATEGORY_LEVEL_EXCEEDED',
          message: '系统仅支持两级分类，含子分类的分类不能移动到二级',
        });
      }
    }
    Object.assign(category, {
      parentId: dto.parent_id ?? null,
      name: dto.name.trim(),
      image: dto.image ?? null,
      sort: dto.sort ?? 0,
      status: dto.status ?? category.status,
    });
    const result = this.view(await this.categories.save(category));
    await this.invalidateTreeCache(tenantId);
    return result;
  }

  async updateSort(tenantId: string, id: string, sort: number) {
    const category = await this.require(tenantId, id);
    category.sort = sort;
    const result = this.view(await this.categories.save(category));
    await this.invalidateTreeCache(tenantId);
    return result;
  }

  async remove(tenantId: string, id: string): Promise<{ deleted: true }> {
    const category = await this.require(tenantId, id);
    const [childCount, productCount] = await Promise.all([
      this.categories.countBy({ tenantId, parentId: id }),
      this.products.countBy({ tenantId, categoryId: id }),
    ]);
    if (childCount > 0 || productCount > 0) {
      throw new ConflictException({
        code: 'CATEGORY_IN_USE',
        message: '分类下存在子分类或商品，不能删除',
      });
    }
    await this.categories.softRemove(category);
    await this.invalidateTreeCache(tenantId);
    return { deleted: true };
  }

  async descendantIds(tenantId: string, categoryId: string): Promise<string[]> {
    const category = await this.require(tenantId, categoryId);
    if (category.parentId) return [category.id];
    const children = await this.categories.findBy({
      tenantId,
      parentId: category.id,
    });
    return [category.id, ...children.map((child) => child.id)];
  }

  private async validateParent(
    tenantId: string,
    parentId?: string,
  ): Promise<void> {
    if (!parentId) return;
    const parent = await this.categories.findOneBy({
      id: parentId,
      tenantId,
      parentId: IsNull(),
    });
    if (!parent) {
      throw new BadRequestException({
        code: 'CATEGORY_PARENT_INVALID',
        message: '上级分类不存在或不是一级分类',
      });
    }
  }

  private async require(tenantId: string, id: string): Promise<CategoryEntity> {
    const category = await this.categories.findOneBy({ id, tenantId });
    if (!category) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: '分类不存在',
      });
    }
    return category;
  }

  private view(category: CategoryEntity): CategoryNode {
    return {
      id: category.id,
      parent_id: category.parentId,
      name: category.name,
      image: category.image,
      sort: category.sort,
      status: category.status,
      children: [],
    };
  }

  private async invalidateTreeCache(tenantId: string): Promise<void> {
    try {
      await this.redis.del(
        `catalog:category-tree:${tenantId}:active`,
        `catalog:category-tree:${tenantId}:all`,
      );
    } catch {
      // Cache invalidation is best effort and never blocks catalog writes.
    }
  }
}
