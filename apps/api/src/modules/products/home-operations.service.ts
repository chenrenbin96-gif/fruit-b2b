import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { IsNull, Not, Repository } from 'typeorm';

import { REDIS_CLIENT } from '../../infrastructure/redis/redis.constants';
import {
  SaveHomeBannerDto,
  SaveHomeCategoryDto,
  SaveHomeProductDto,
  SaveHomeRecommendationDto,
} from './dto/home-operation.dto';
import {
  HomeBannerEntity,
  HomeCategoryEntity,
  HomeProductEntity,
} from './entities/home-operation.entities';
import {
  CategoryEntity,
  ProductEntity,
} from './entities/product.entities';
import { ProductsService } from './products.service';

type HomeConfigResult = {
  banner: Array<Record<string, unknown>>;
  categories: Array<Record<string, unknown>>;
  hotProducts: Array<Awaited<ReturnType<ProductsService['detail']>>>;
  newProducts: Array<Awaited<ReturnType<ProductsService['detail']>>>;
  recommendProducts: Array<Awaited<ReturnType<ProductsService['detail']>>>;
};

@Injectable()
export class HomeOperationsService {
  private readonly cacheTtl: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService,
    @InjectRepository(HomeBannerEntity)
    private readonly banners: Repository<HomeBannerEntity>,
    @InjectRepository(HomeCategoryEntity)
    private readonly homeCategories: Repository<HomeCategoryEntity>,
    @InjectRepository(HomeProductEntity)
    private readonly homeProducts: Repository<HomeProductEntity>,
    @InjectRepository(CategoryEntity)
    private readonly categories: Repository<CategoryEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    private readonly productService: ProductsService,
  ) {
    this.cacheTtl = config.get<number>('HOME_CONFIG_CACHE_TTL_SECONDS', 300);
  }

  async config(
    tenantId: string,
    customerId: string,
  ): Promise<HomeConfigResult> {
    const cacheVersion = await this.cacheVersion(tenantId);
    const cacheKey = this.cacheKey(tenantId, customerId, cacheVersion);
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as HomeConfigResult;
    } catch {
      // Database remains the source of truth when Redis is unavailable.
    }

    const now = new Date();
    const [banners, categories, configuredProducts, automatic] =
      await Promise.all([
        this.banners
          .createQueryBuilder('banner')
          .where('banner.tenant_id = :tenantId', { tenantId })
          .andWhere("banner.status = 'ACTIVE'")
          .andWhere(
            '(banner.start_time IS NULL OR banner.start_time <= :now)',
            { now },
          )
          .andWhere('(banner.end_time IS NULL OR banner.end_time >= :now)', {
            now,
          })
          .orderBy('banner.sort', 'ASC')
          .addOrderBy('banner.id', 'DESC')
          .getMany(),
        this.homeCategories.find({
          where: {
            tenantId,
            status: 'ACTIVE',
            category: { status: 'ACTIVE' },
          },
          relations: { category: true },
          order: { sort: 'ASC', id: 'ASC' },
          take: 10,
        }),
        this.homeProducts.find({
          where: {
            tenantId,
            status: 'ACTIVE',
            product: { status: 'ON_SALE' },
          },
          relations: { product: true },
          order: { position: 'ASC', sort: 'ASC', id: 'ASC' },
        }),
        this.productService.recommendations(tenantId, customerId),
      ]);

    const productIds = (position: HomeProductEntity['position']) =>
      configuredProducts
        .filter((item) => item.position === position)
        .slice(0, 8)
        .map((item) => item.productId);
    const [hot, newest, recommended] = await Promise.all([
      this.mapProducts(tenantId, customerId, productIds('HOT')),
      this.mapProducts(tenantId, customerId, productIds('NEW')),
      this.mapProducts(tenantId, customerId, productIds('RECOMMEND')),
    ]);
    const result = {
      banner: banners.map((item) => this.bannerView(item)),
      categories: categories.map((item) => this.categoryView(item)),
      hotProducts: hot.length ? hot : automatic.hot_selling,
      newProducts: newest.length ? newest : automatic.new_arrivals,
      recommendProducts: recommended.length
        ? recommended
        : automatic.hot_selling,
    };
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        this.cacheTtl,
      );
    } catch {
      // Cache writes are best effort.
    }
    return result;
  }

  async home(tenantId: string, customerId?: string | null) {
    if (!customerId) {
      throw new BadRequestException({
        code: 'CUSTOMER_CONTEXT_REQUIRED',
        message: '首页客户价格需要客户身份',
      });
    }
    const result = await this.config(tenantId, customerId);
    return {
      banners: result.banner,
      recommended_products: result.recommendProducts,
      hot_products: result.hotProducts,
      new_products: result.newProducts,
      special_products: [],
      frequent_products: [],
    };
  }

  async adminData(tenantId: string) {
    const [banners, homeCategories, homeProducts, products, categories] =
      await Promise.all([
        this.banners.find({
          where: { tenantId },
          order: { sort: 'ASC', id: 'DESC' },
        }),
        this.homeCategories.find({
          where: { tenantId },
          relations: { category: { parent: true } },
          order: { sort: 'ASC', id: 'ASC' },
        }),
        this.homeProducts.find({
          where: { tenantId },
          relations: { product: true },
          order: { position: 'ASC', sort: 'ASC', id: 'ASC' },
        }),
        this.products.find({
          where: { tenantId, status: 'ON_SALE' },
          order: { name: 'ASC' },
        }),
        this.categories.find({
          where: {
            tenantId,
            parentId: Not(IsNull()),
            status: 'ACTIVE',
          },
          relations: { parent: true },
          order: { sort: 'ASC', name: 'ASC' },
        }),
      ]);
    return {
      banners: banners.map((item) => this.bannerView(item)),
      categories: homeCategories.map((item) => this.categoryView(item)),
      home_products: homeProducts.map((item) => this.productPositionView(item)),
      products: products.map((item) => ({
        id: item.id,
        name: item.name,
        origin: item.origin,
        status: item.status,
      })),
      category_options: categories.map((item) => ({
        id: item.id,
        name: item.name,
        parent_name: item.parent?.name ?? '',
        image: item.image,
      })),
    };
  }

  async createBanner(tenantId: string, dto: SaveHomeBannerDto) {
    await this.validateBannerTarget(tenantId, dto);
    this.validateSchedule(dto);
    const item = await this.banners.save(
      this.banners.create({
        tenantId,
        ...this.bannerFields(dto),
      }),
    );
    await this.invalidate(tenantId);
    return this.bannerView(item);
  }

  async updateBanner(
    tenantId: string,
    id: string,
    dto: SaveHomeBannerDto,
  ) {
    const item = await this.banners.findOneBy({ id, tenantId });
    if (!item) throw this.notFound('Banner');
    await this.validateBannerTarget(tenantId, dto);
    this.validateSchedule(dto);
    Object.assign(item, this.bannerFields(dto));
    const saved = await this.banners.save(item);
    await this.invalidate(tenantId);
    return this.bannerView(saved);
  }

  async removeBanner(tenantId: string, id: string) {
    const result = await this.banners.delete({ id, tenantId });
    if (!result.affected) throw this.notFound('Banner');
    await this.invalidate(tenantId);
    return { id, deleted: true };
  }

  async createCategory(tenantId: string, dto: SaveHomeCategoryDto) {
    await this.requireSecondLevelCategory(tenantId, dto.category_id);
    const duplicate = await this.homeCategories.findOneBy({
      tenantId,
      categoryId: dto.category_id,
    });
    if (duplicate) throw this.duplicate('该分类已配置为首页入口');
    const item = await this.homeCategories.save(
      this.homeCategories.create({
        tenantId,
        categoryId: dto.category_id,
        imageUrl: dto.image_url?.trim() || null,
        title: dto.title.trim(),
        sort: dto.sort,
        status: dto.status,
      }),
    );
    await this.invalidate(tenantId);
    return { id: item.id };
  }

  async updateCategory(
    tenantId: string,
    id: string,
    dto: SaveHomeCategoryDto,
  ) {
    const item = await this.homeCategories.findOneBy({ id, tenantId });
    if (!item) throw this.notFound('首页分类入口');
    await this.requireSecondLevelCategory(tenantId, dto.category_id);
    const duplicate = await this.homeCategories.findOneBy({
      tenantId,
      categoryId: dto.category_id,
    });
    if (duplicate && duplicate.id !== id) {
      throw this.duplicate('该分类已配置为首页入口');
    }
    Object.assign(item, {
      categoryId: dto.category_id,
      imageUrl: dto.image_url?.trim() || null,
      title: dto.title.trim(),
      sort: dto.sort,
      status: dto.status,
    });
    await this.homeCategories.save(item);
    await this.invalidate(tenantId);
    return { id: item.id };
  }

  async removeCategory(tenantId: string, id: string) {
    const result = await this.homeCategories.delete({ id, tenantId });
    if (!result.affected) throw this.notFound('首页分类入口');
    await this.invalidate(tenantId);
    return { id, deleted: true };
  }

  async createProduct(tenantId: string, dto: SaveHomeProductDto) {
    await this.requireOnSaleProduct(tenantId, dto.product_id);
    const duplicate = await this.homeProducts.findOneBy({
      tenantId,
      productId: dto.product_id,
      position: dto.position,
    });
    if (duplicate) throw this.duplicate('该商品已存在于当前运营位');
    const item = await this.homeProducts.save(
      this.homeProducts.create({
        tenantId,
        productId: dto.product_id,
        position: dto.position,
        sort: dto.sort,
        status: dto.status,
      }),
    );
    await this.invalidate(tenantId);
    return { id: item.id };
  }

  async updateProduct(
    tenantId: string,
    id: string,
    dto: SaveHomeProductDto,
  ) {
    const item = await this.homeProducts.findOneBy({ id, tenantId });
    if (!item) throw this.notFound('首页商品位');
    await this.requireOnSaleProduct(tenantId, dto.product_id);
    const duplicate = await this.homeProducts.findOneBy({
      tenantId,
      productId: dto.product_id,
      position: dto.position,
    });
    if (duplicate && duplicate.id !== id) {
      throw this.duplicate('该商品已存在于当前运营位');
    }
    Object.assign(item, {
      productId: dto.product_id,
      position: dto.position,
      sort: dto.sort,
      status: dto.status,
    });
    await this.homeProducts.save(item);
    await this.invalidate(tenantId);
    return { id: item.id };
  }

  async removeProduct(tenantId: string, id: string) {
    const result = await this.homeProducts.delete({ id, tenantId });
    if (!result.affected) throw this.notFound('首页商品位');
    await this.invalidate(tenantId);
    return { id, deleted: true };
  }

  async createRecommendation(
    tenantId: string,
    dto: SaveHomeRecommendationDto,
  ) {
    return this.createProduct(tenantId, {
      product_id: dto.product_id,
      position: this.legacyPosition(dto.recommendation_type),
      sort: dto.sort,
      status: dto.status,
    });
  }

  async updateRecommendation(
    tenantId: string,
    id: string,
    dto: SaveHomeRecommendationDto,
  ) {
    return this.updateProduct(tenantId, id, {
      product_id: dto.product_id,
      position: this.legacyPosition(dto.recommendation_type),
      sort: dto.sort,
      status: dto.status,
    });
  }

  removeRecommendation(tenantId: string, id: string) {
    return this.removeProduct(tenantId, id);
  }

  private async mapProducts(
    tenantId: string,
    customerId: string,
    ids: string[],
  ) {
    return Promise.all(
      ids.map((id) =>
        this.productService.detail(tenantId, id, {
          catalogOnly: true,
          customerId,
        }),
      ),
    );
  }

  private bannerFields(dto: SaveHomeBannerDto) {
    const linkId = dto.link_id ?? null;
    return {
      title: dto.title.trim(),
      subtitle: dto.subtitle?.trim() || null,
      imageUrl: dto.image_url?.trim() || null,
      bannerType: dto.banner_type,
      linkType: dto.link_type,
      linkId,
      linkValue:
        linkId ??
        (dto.link_type === 'URL' ? dto.link_value?.trim() || null : null),
      sort: dto.sort,
      status: dto.status,
      startTime: dto.start_time ? new Date(dto.start_time) : null,
      endTime: dto.end_time ? new Date(dto.end_time) : null,
    };
  }

  private async validateBannerTarget(
    tenantId: string,
    dto: SaveHomeBannerDto,
  ) {
    if (dto.link_type === 'PRODUCT') {
      if (!dto.link_id) throw this.targetRequired();
      await this.requireOnSaleProduct(tenantId, dto.link_id);
    }
    if (dto.link_type === 'CATEGORY') {
      if (!dto.link_id) throw this.targetRequired();
      await this.requireSecondLevelCategory(tenantId, dto.link_id);
    }
  }

  private validateSchedule(dto: SaveHomeBannerDto) {
    if (
      dto.start_time &&
      dto.end_time &&
      new Date(dto.start_time) >= new Date(dto.end_time)
    ) {
      throw new BadRequestException({
        code: 'HOME_BANNER_SCHEDULE_INVALID',
        message: 'Banner结束时间必须晚于开始时间',
      });
    }
  }

  private async requireSecondLevelCategory(
    tenantId: string,
    categoryId: string,
  ) {
    const category = await this.categories.findOneBy({
      id: categoryId,
      tenantId,
      parentId: Not(IsNull()),
      status: 'ACTIVE',
    });
    if (!category) throw this.notFound('二级分类');
    return category;
  }

  private async requireOnSaleProduct(tenantId: string, productId: string) {
    const product = await this.products.findOneBy({
      id: productId,
      tenantId,
      status: 'ON_SALE',
    });
    if (!product) throw this.notFound('在售商品');
    return product;
  }

  private async invalidate(tenantId: string) {
    try {
      await this.redis.incr(`home:config-version:${tenantId}`);
    } catch {
      // Cache invalidation is best effort.
    }
  }

  private async cacheVersion(tenantId: string): Promise<string> {
    try {
      return (
        (await this.redis.get(`home:config-version:${tenantId}`)) ?? '0'
      );
    } catch {
      return '0';
    }
  }

  private cacheKey(
    tenantId: string,
    customerId: string,
    version: string,
  ) {
    return `home:config:${tenantId}:${customerId}:v${version}`;
  }

  private bannerView(item: HomeBannerEntity) {
    return {
      id: item.id,
      title: item.title,
      subtitle: item.subtitle,
      image_url: item.imageUrl,
      banner_type: item.bannerType,
      link_type: item.linkType,
      link_id: item.linkId,
      link_value: item.linkId ?? item.linkValue,
      sort: item.sort,
      status: item.status,
      start_time: item.startTime?.toISOString() ?? null,
      end_time: item.endTime?.toISOString() ?? null,
    };
  }

  private categoryView(item: HomeCategoryEntity) {
    return {
      id: item.id,
      category_id: item.categoryId,
      title: item.title,
      image_url: item.imageUrl ?? item.category.image,
      category_name: item.category.name,
      parent_name: item.category.parent?.name ?? null,
      sort: item.sort,
      status: item.status,
    };
  }

  private productPositionView(item: HomeProductEntity) {
    return {
      id: item.id,
      product_id: item.productId,
      product_name: item.product.name,
      position: item.position,
      sort: item.sort,
      status: item.status,
    };
  }

  private legacyPosition(type: SaveHomeRecommendationDto['recommendation_type']) {
    if (type === 'HOT') return 'HOT' as const;
    if (type === 'NEW_ARRIVAL') return 'NEW' as const;
    return 'RECOMMEND' as const;
  }

  private targetRequired() {
    return new BadRequestException({
      code: 'HOME_BANNER_LINK_TARGET_REQUIRED',
      message: '商品或分类跳转必须选择目标',
    });
  }

  private duplicate(message: string) {
    return new ConflictException({
      code: 'HOME_OPERATION_DUPLICATE',
      message,
    });
  }

  private notFound(resource: string) {
    return new NotFoundException({
      code: 'HOME_OPERATION_RESOURCE_NOT_FOUND',
      message: `${resource}不存在`,
    });
  }
}
