import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { Brackets, DataSource, In, Repository } from 'typeorm';

import { REDIS_CLIENT } from '../../infrastructure/redis/redis.constants';
import { InventoryEntity } from '../inventory/entities/inventory.entities';
import {
  CreateProductDto,
  CreateSkuDto,
  ProductBatchDto,
  ProductListQueryDto,
  SkuListQueryDto,
  UpdateProductDisplayDto,
  UpdateProductDto,
  UpdateSkuDto,
} from './dto/product.dto';
import {
  ProductEntity,
  SkuEntity,
} from './entities/product.entities';
import { CategoriesService } from './categories.service';
import { PriceService } from './price.service';
import { ProductMediaEntity } from './entities/product-media.entity';
import { ProductDescriptionEntity } from './entities/product-description.entity';

@Injectable()
export class ProductsService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly dataSource: DataSource,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    @InjectRepository(SkuEntity)
    private readonly skus: Repository<SkuEntity>,
    @InjectRepository(InventoryEntity)
    private readonly inventory: Repository<InventoryEntity>,
    @InjectRepository(ProductMediaEntity)
    private readonly media: Repository<ProductMediaEntity>,
    @InjectRepository(ProductDescriptionEntity)
    private readonly descriptions: Repository<ProductDescriptionEntity>,
    private readonly categories: CategoriesService,
    private readonly prices: PriceService,
  ) {}

  async recommendations(
    tenantId: string,
    customerId: string | null | undefined,
  ) {
    const newest = await this.products.find({
      where: { tenantId, status: 'ON_SALE' },
      relations: { category: true, skus: true },
      order: { createdAt: 'DESC' },
      take: 6,
    });
    const hotRows = (await this.dataSource.query(
      `SELECT oi.sku_id, s.product_id, SUM(
         COALESCE(oi.actual_quantity, oi.actual_weight,
                  oi.planned_quantity, oi.planned_weight, 0)
       ) AS sales_volume
       FROM order_items oi
       INNER JOIN orders o ON o.id = oi.order_id
       INNER JOIN skus s ON s.id = oi.sku_id
       WHERE o.tenant_id = ?
         AND o.status = 'COMPLETED'
         AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY oi.sku_id, s.product_id
       ORDER BY sales_volume DESC
       LIMIT 6`,
      [tenantId],
    )) as Array<{ product_id: string }>;
    const recentRows = customerId
      ? ((await this.dataSource.query(
          `SELECT s.product_id, MAX(o.created_at) AS last_bought_at
           FROM order_items oi
           INNER JOIN orders o ON o.id = oi.order_id
           INNER JOIN skus s ON s.id = oi.sku_id
           WHERE o.tenant_id = ? AND o.customer_id = ?
             AND o.status <> 'CANCELLED'
           GROUP BY s.product_id
           ORDER BY last_bought_at DESC
           LIMIT 6`,
          [tenantId, customerId],
        )) as Array<{ product_id: string }>)
      : [];

    const mapProducts = async (ids: string[]) => {
      if (ids.length === 0) return [];
      const products = await this.products.find({
        where: { tenantId, id: In(ids), status: 'ON_SALE' },
        relations: { category: true, skus: true },
      });
      const byId = new Map(products.map((item) => [item.id, item]));
      return Promise.all(
        ids
          .map((id) => byId.get(id))
          .filter((item): item is ProductEntity => Boolean(item))
          .map((item) =>
            this.productView(item, {
              activeSkusOnly: true,
              customerId,
              includeInventory: true,
            }),
          ),
      );
    };
    const newArrivals = await Promise.all(
      newest.map((item) =>
        this.productView(item, {
          activeSkusOnly: true,
          customerId,
          includeInventory: true,
        }),
      ),
    );
    const hotSelling = await mapProducts(
      [...new Set(hotRows.map((row) => row.product_id))],
    );
    const recentlyPurchased = await mapProducts(
      recentRows.map((row) => row.product_id),
    );
    return {
      hot_selling: hotSelling.length > 0 ? hotSelling : newArrivals,
      new_arrivals: newArrivals,
      recently_purchased: recentlyPurchased,
    };
  }

  async catalogFilters(tenantId: string, categoryId?: string) {
    const categoryIds = categoryId
      ? await this.categories.descendantIds(tenantId, categoryId)
      : undefined;
    const productBuilder = this.products
      .createQueryBuilder('product')
      .select(['product.origin AS origin', 'product.brand AS brand'])
      .where('product.tenant_id = :tenantId', { tenantId })
      .andWhere("product.status = 'ON_SALE'");
    if (categoryIds?.length) {
      productBuilder.andWhere('product.category_id IN (:...categoryIds)', {
        categoryIds,
      });
    }
    const products = (await productBuilder.getRawMany()) as Array<{
      origin: string | null;
      brand: string | null;
    }>;
    const skuBuilder = this.skus
      .createQueryBuilder('sku')
      .innerJoin(ProductEntity, 'product', 'product.id = sku.product_id')
      .select([
        'sku.sku_name AS sku_name',
        'sku.specification AS specification',
      ])
      .where('sku.tenant_id = :tenantId', { tenantId })
      .andWhere("sku.status = 'ACTIVE'")
      .andWhere("product.status = 'ON_SALE'");
    if (categoryIds?.length) {
      skuBuilder.andWhere('product.category_id IN (:...categoryIds)', {
        categoryIds,
      });
    }
    const skuAttributes = (await skuBuilder.getRawMany()) as Array<{
      sku_name: string;
      specification: string | null;
    }>;
    const unique = (values: Array<string | null>) =>
      [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
    return {
      levels: unique(
        skuAttributes.map((item) =>
          this.catalogGrade(item.sku_name, item.specification),
        ),
      ),
      origins: unique(products.map((item) => item.origin)),
      brands: unique(products.map((item) => item.brand)),
      specifications: unique(
        skuAttributes.map((item) => item.specification),
      ),
      price_ranges: [
        { label: '¥0-50', min: 0, max: 50 },
        { label: '¥50-100', min: 50, max: 100 },
        { label: '¥100-500', min: 100, max: 500 },
        { label: '¥500以上', min: 500, max: null },
      ],
      stock_options: [
        { label: '有库存', value: 'AVAILABLE' },
        { label: '库存紧张', value: 'LOW' },
        { label: '缺货', value: 'OUT' },
      ],
    };
  }

  async list(
    tenantId: string,
    query: ProductListQueryDto,
    options: { catalogOnly?: boolean; customerId?: string | null } = {},
  ) {
    const categoryIds = query.category_id
      ? await this.categories.descendantIds(tenantId, query.category_id)
      : undefined;
    const builder = this.products
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.skus', 'sku')
      .where('product.tenant_id = :tenantId', { tenantId })
      .distinct(true);
    if (categoryIds) {
      builder.andWhere('product.category_id IN (:...categoryIds)', {
        categoryIds,
      });
    }
    if (query.keyword) {
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('product.name LIKE :keyword')
            .orWhere('product.product_code LIKE :keyword')
            .orWhere('product.barcode LIKE :keyword')
            .orWhere('product.origin LIKE :keyword')
            .orWhere('product.brand LIKE :keyword')
            .orWhere('sku.sku_name LIKE :keyword')
            .orWhere('sku.specification LIKE :keyword');
        }),
        { keyword: `%${query.keyword.trim()}%` },
      );
    }
    if (query.sale_type) {
      builder.andWhere('sku.sale_type = :saleType', {
        saleType: query.sale_type,
      });
    }
    if (query.inventory_status) {
      const available = `COALESCE((
        SELECT SUM(i.available_quantity)
        FROM inventory i
        INNER JOIN skus inventory_sku ON inventory_sku.id = i.sku_id
        WHERE inventory_sku.product_id = product.id
      ), 0)`;
      const warning = `COALESCE((
        SELECT SUM(warning_sku.stock_warning)
        FROM skus warning_sku
        WHERE warning_sku.product_id = product.id
          AND warning_sku.deleted_at IS NULL
      ), 0)`;
      if (query.inventory_status === 'OUT') {
        builder.andWhere(`${available} <= 0`);
      } else if (query.inventory_status === 'LOW') {
        builder.andWhere(`${available} > 0 AND ${available} <= ${warning}`);
      } else {
        builder.andWhere(`${available} > ${warning}`);
      }
    }
    const status = options.catalogOnly ? 'ON_SALE' : query.status;
    if (status) builder.andWhere('product.status = :status', { status });
    const [items, total] = await builder
      .orderBy('product.id', 'DESC')
      .skip((query.page - 1) * query.page_size)
      .take(query.page_size)
      .getManyAndCount();

    let mapped = await Promise.all(
      items.map((product) =>
        this.productView(product, {
          activeSkusOnly: options.catalogOnly,
          customerId: options.customerId,
          includeInventory: true,
        }),
      ),
    );
    if (!options.catalogOnly && items.length) {
      const summaries = (await this.dataSource.query(
        `SELECT p.id AS product_id,
                (SELECT MIN(s.market_price) FROM skus s
                  WHERE s.product_id = p.id AND s.deleted_at IS NULL) AS market_price,
                (SELECT GROUP_CONCAT(DISTINCT s.sale_type ORDER BY s.sale_type)
                  FROM skus s WHERE s.product_id = p.id
                    AND s.deleted_at IS NULL) AS sale_types,
                (SELECT GROUP_CONCAT(DISTINCT s.piece_unit ORDER BY s.piece_unit)
                  FROM skus s WHERE s.product_id = p.id
                    AND s.deleted_at IS NULL) AS units,
                (SELECT COALESCE(SUM(i.available_quantity), 0)
                  FROM inventory i JOIN skus s ON s.id = i.sku_id
                  WHERE s.product_id = p.id) AS available_quantity,
                (SELECT poi.purchase_price
                  FROM purchase_order_items poi
                  JOIN purchase_orders po ON po.id = poi.purchase_order_id
                  JOIN skus s ON s.id = poi.sku_id
                  WHERE s.product_id = p.id AND po.status <> 'CANCELLED'
                  ORDER BY po.id DESC LIMIT 1) AS recent_purchase_price
         FROM products p
         WHERE p.tenant_id = ? AND p.id IN (?)
        `,
        [tenantId, items.map((item) => item.id)],
      )) as Array<{
        product_id: string;
        market_price: string | null;
        sale_types: string | null;
        units: string | null;
        available_quantity: string;
        recent_purchase_price: string | null;
      }>;
      const byProduct = new Map(
        summaries.map((item) => [String(item.product_id), item]),
      );
      mapped = mapped.map((item) => {
        const summary = byProduct.get(item.id);
        return {
          ...item,
          market_price: summary?.market_price ?? null,
          sale_types: summary?.sale_types?.split(',') ?? [],
          units: summary?.units?.split(',').filter(Boolean) ?? [],
          available_quantity: summary?.available_quantity ?? '0.000',
          recent_purchase_price: summary?.recent_purchase_price ?? null,
        };
      });
    }
    return {
      items: mapped,
      pagination: {
        page: query.page,
        page_size: query.page_size,
        total,
        total_pages: Math.ceil(total / query.page_size),
      },
    };
  }

  async detail(
    tenantId: string,
    id: string,
    options: { catalogOnly?: boolean; customerId?: string | null } = {},
  ) {
    const product = await this.products.findOne({
      where: {
        id,
        tenantId,
        ...(options.catalogOnly ? { status: 'ON_SALE' as const } : {}),
      },
      relations: { category: true, skus: true },
    });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: '商品不存在',
      });
    }
    return this.productView(product, {
      activeSkusOnly: options.catalogOnly,
      customerId: options.customerId,
      includeInventory: true,
    });
  }

  async create(tenantId: string, dto: CreateProductDto) {
    await this.requireLeafCategory(tenantId, dto.category_id);
    const product = this.products.create({
      tenantId,
      categoryId: dto.category_id,
      productCode: dto.product_code.trim(),
      barcode: dto.barcode?.trim() || null,
      name: dto.name.trim(),
      mainImage: dto.main_image ?? null,
      origin: dto.origin?.trim() ?? null,
      brand: dto.brand?.trim() ?? null,
      grade: dto.grade ?? null,
      description: dto.description?.trim() ?? null,
      status: dto.status ?? 'DRAFT',
    });
    return this.simpleProductView(await this.products.save(product));
  }

  async update(tenantId: string, id: string, dto: UpdateProductDto) {
    const product = await this.requireProduct(tenantId, id);
    await this.requireLeafCategory(tenantId, dto.category_id);
    Object.assign(product, {
      categoryId: dto.category_id,
      productCode: dto.product_code.trim(),
      barcode: dto.barcode?.trim() || null,
      name: dto.name.trim(),
      mainImage: dto.main_image ?? null,
      origin: dto.origin?.trim() ?? null,
      brand: dto.brand?.trim() ?? null,
      grade: dto.grade ?? null,
      description: dto.description?.trim() ?? null,
      status: dto.status ?? product.status,
    });
    return this.simpleProductView(await this.products.save(product));
  }

  async updateDisplay(
    tenantId: string,
    id: string,
    dto: UpdateProductDisplayDto,
  ) {
    const product = await this.requireProduct(tenantId, id);
    Object.assign(product, {
      name: dto.name.trim(),
      mainImage: dto.main_image ?? null,
      origin: dto.origin?.trim() || null,
      brand: dto.brand?.trim() || null,
      grade: dto.grade ?? null,
      description: dto.description?.trim() || null,
    });
    return this.simpleProductView(await this.products.save(product));
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: ProductEntity['status'],
  ) {
    const product = await this.requireProduct(tenantId, id);
    if (status === 'ON_SALE') {
      const activeSkuCount = await this.skus.countBy({
        tenantId,
        productId: id,
        status: 'ACTIVE',
      });
      if (activeSkuCount === 0) {
        throw new BadRequestException({
          code: 'PRODUCT_ACTIVE_SKU_REQUIRED',
          message: '商品至少需要一个启用SKU才能上架',
        });
      }
      const imageCount = await this.media.countBy({
        tenantId,
        productId: id,
        mediaType: 'IMAGE',
        status: 'ENABLE',
      });
      if (!product.mainImage && imageCount === 0) {
        throw new BadRequestException({
          code: 'PRODUCT_MAIN_IMAGE_REQUIRED',
          message: '商品至少需要一张启用主图才能上架',
        });
      }
    }
    product.status = status;
    const saved = await this.products.save(product);
    await this.invalidateHomeConfig(tenantId);
    return this.simpleProductView(saved);
  }

  async listSkus(tenantId: string, query: SkuListQueryDto) {
    const skus = await this.skus.find({
      where: {
        tenantId,
        ...(query.product_id ? { productId: query.product_id } : {}),
        ...(query.sale_type ? { saleType: query.sale_type } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      relations: { product: true },
      order: { id: 'DESC' },
    });
    return Promise.all(skus.map((sku) => this.skuView(sku, true)));
  }

  async createSku(tenantId: string, dto: CreateSkuDto) {
    await this.requireProduct(tenantId, dto.product_id);
    this.validateUnits(dto);
    const sku = this.skus.create({
      tenantId,
      productId: dto.product_id,
      skuCode: dto.sku_code.trim(),
      skuName: dto.sku_name.trim(),
      specification: dto.specification?.trim() ?? null,
      saleType: dto.sale_type,
      pieceUnit: dto.piece_unit!.trim(),
      weightUnit:
        dto.sale_type === 'WEIGHT' ? dto.weight_unit!.trim() : null,
      stockUnit: dto.stock_unit.trim(),
      priceUnit: dto.price_unit.trim(),
      standardWeight:
        dto.sale_type === 'WEIGHT' ? dto.standard_weight!.toFixed(3) : null,
      weightPriceType:
        dto.sale_type === 'WEIGHT' ? dto.weight_price_type! : null,
      grossWeightUnitPrice:
        dto.sale_type === 'WEIGHT'
          ? dto.gross_weight_unit_price!.toFixed(4)
          : null,
      netWeightUnitPrice:
        dto.sale_type === 'WEIGHT'
          ? dto.net_weight_unit_price!.toFixed(4)
          : null,
      deliveryWeightPerPiece:
        dto.sale_type === 'PIECE'
          ? dto.delivery_weight_per_piece!.toFixed(3)
          : null,
      deliveryWeightUnit:
        dto.sale_type === 'PIECE' ? dto.delivery_weight_unit! : null,
      costPrice: dto.cost_price.toFixed(4),
      basePrice: dto.base_price.toFixed(4),
      marketPrice: (dto.market_price ?? dto.base_price).toFixed(4),
      stockWarning: dto.stock_warning.toFixed(3),
      status: dto.status ?? 'ACTIVE',
    });
    return this.skuView(await this.skus.save(sku), false);
  }

  async updateSku(tenantId: string, id: string, dto: UpdateSkuDto) {
    const sku = await this.requireSku(tenantId, id);
    await this.requireProduct(tenantId, dto.product_id);
    this.validateUnits(dto);
    const hasInventory = await this.inventory.countBy({ tenantId, skuId: id });
    if (
      hasInventory > 0 &&
      (sku.saleType !== dto.sale_type || sku.stockUnit !== dto.stock_unit)
    ) {
      throw new BadRequestException({
        code: 'SKU_STOCK_UNIT_IMMUTABLE',
        message: 'SKU已有库存记录，不能修改销售方式或库存单位',
      });
    }
    Object.assign(sku, {
      productId: dto.product_id,
      skuCode: dto.sku_code.trim(),
      skuName: dto.sku_name.trim(),
      specification: dto.specification?.trim() ?? null,
      saleType: dto.sale_type,
      pieceUnit: dto.piece_unit!.trim(),
      weightUnit:
        dto.sale_type === 'WEIGHT' ? dto.weight_unit!.trim() : null,
      stockUnit: dto.stock_unit.trim(),
      priceUnit: dto.price_unit.trim(),
      standardWeight:
        dto.sale_type === 'WEIGHT' ? dto.standard_weight!.toFixed(3) : null,
      weightPriceType:
        dto.sale_type === 'WEIGHT' ? dto.weight_price_type! : null,
      grossWeightUnitPrice:
        dto.sale_type === 'WEIGHT'
          ? dto.gross_weight_unit_price!.toFixed(4)
          : null,
      netWeightUnitPrice:
        dto.sale_type === 'WEIGHT'
          ? dto.net_weight_unit_price!.toFixed(4)
          : null,
      deliveryWeightPerPiece:
        dto.sale_type === 'PIECE'
          ? dto.delivery_weight_per_piece!.toFixed(3)
          : null,
      deliveryWeightUnit:
        dto.sale_type === 'PIECE' ? dto.delivery_weight_unit! : null,
      costPrice: dto.cost_price.toFixed(4),
      basePrice: dto.base_price.toFixed(4),
      marketPrice: (dto.market_price ?? dto.base_price).toFixed(4),
      stockWarning: dto.stock_warning.toFixed(3),
      status: dto.status ?? sku.status,
    });
    return this.skuView(await this.skus.save(sku), false);
  }

  async updateSkuStatus(
    tenantId: string,
    id: string,
    status: SkuEntity['status'],
  ) {
    const sku = await this.requireSku(tenantId, id);
    sku.status = status;
    return this.skuView(await this.skus.save(sku), false);
  }

  async removeSku(tenantId: string, id: string) {
    const sku = await this.requireSku(tenantId, id);
    const inventory = await this.inventory.findBy({ tenantId, skuId: id });
    if (
      inventory.some(
        (item) =>
          Number(item.stockQuantity) !== 0 ||
          Number(item.lockedQuantity) !== 0,
      )
    ) {
      throw new BadRequestException({
        code: 'SKU_INVENTORY_NOT_EMPTY',
        message: 'SKU仍有库存或锁定库存，不能删除',
      });
    }
    sku.status = 'DISABLED';
    await this.skus.save(sku);
    await this.skus.softDelete({ id, tenantId });
    return { deleted: true };
  }

  async duplicate(tenantId: string, id: string) {
    const source = await this.products.findOne({
      where: { id, tenantId },
      relations: { skus: true },
    });
    if (!source) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: '商品不存在',
      });
    }
    const suffix = Date.now().toString().slice(-8);
    const newId = await this.dataSource.transaction(async (manager) => {
      const product = await manager.save(
        ProductEntity,
        manager.create(ProductEntity, {
          tenantId,
          categoryId: source.categoryId,
          productCode: `${source.productCode.slice(0, 22)}-CP${suffix}`,
          barcode: null,
          name: `${source.name}（复制）`,
          mainImage: source.mainImage,
          origin: source.origin,
          brand: source.brand,
          grade: source.grade,
          description: source.description,
          status: 'DRAFT',
        }),
      );
      for (const sku of source.skus ?? []) {
        await manager.save(
          SkuEntity,
          manager.create(SkuEntity, {
            tenantId,
            productId: product.id,
            skuCode: `${sku.skuCode.slice(0, 38)}-CP${suffix}`,
            skuName: sku.skuName,
            specification: sku.specification,
            saleType: sku.saleType,
            pieceUnit: sku.pieceUnit,
            weightUnit: sku.weightUnit,
            stockUnit: sku.stockUnit,
            priceUnit: sku.priceUnit,
            standardWeight: sku.standardWeight,
            weightPriceType: sku.weightPriceType,
            grossWeightUnitPrice: sku.grossWeightUnitPrice,
            netWeightUnitPrice: sku.netWeightUnitPrice,
            deliveryWeightPerPiece: sku.deliveryWeightPerPiece,
            deliveryWeightUnit: sku.deliveryWeightUnit,
            costPrice: sku.costPrice,
            basePrice: sku.basePrice,
            marketPrice: sku.marketPrice,
            stockWarning: sku.stockWarning,
            status: 'DISABLED',
          }),
        );
      }
      const [media, descriptions] = await Promise.all([
        manager.findBy(ProductMediaEntity, { tenantId, productId: source.id }),
        manager.findBy(ProductDescriptionEntity, {
          tenantId,
          productId: source.id,
        }),
      ]);
      if (media.length) {
        await manager.save(
          ProductMediaEntity,
          media.map((item) =>
            manager.create(ProductMediaEntity, {
              tenantId,
              productId: product.id,
              mediaType: item.mediaType,
              url: item.url,
              thumbnailUrl: item.thumbnailUrl,
              sort: item.sort,
              status: item.status,
            }),
          ),
        );
      }
      if (descriptions.length) {
        await manager.save(
          ProductDescriptionEntity,
          descriptions.map((item) =>
            manager.create(ProductDescriptionEntity, {
              tenantId,
              productId: product.id,
              contentJson: item.contentJson,
              sort: item.sort,
            }),
          ),
        );
      }
      return product.id;
    });
    return this.detail(tenantId, newId);
  }

  async remove(tenantId: string, id: string) {
    const product = await this.requireProduct(tenantId, id);
    const skuIds = (
      await this.skus.findBy({ tenantId, productId: product.id })
    ).map((item) => item.id);
    if (skuIds.length) {
      const inventory = await this.inventory.findBy({
        tenantId,
        skuId: In(skuIds),
      });
      if (
        inventory.some(
          (item) =>
            Number(item.stockQuantity) !== 0 ||
            Number(item.lockedQuantity) !== 0,
        )
      ) {
        throw new BadRequestException({
          code: 'PRODUCT_INVENTORY_NOT_EMPTY',
          message: '商品仍有库存或锁定库存，不能删除',
        });
      }
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.softDelete(SkuEntity, { tenantId, productId: id });
      await manager.softDelete(ProductEntity, { tenantId, id });
    });
    return { deleted: true };
  }

  async batch(tenantId: string, dto: ProductBatchDto) {
    for (const id of dto.ids) {
      if (dto.action === 'DELETE') await this.remove(tenantId, id);
      else await this.updateStatus(tenantId, id, dto.action);
    }
    return { affected: dto.ids.length };
  }

  private async invalidateHomeConfig(tenantId: string): Promise<void> {
    try {
      await this.redis.incr(`home:config-version:${tenantId}`);
    } catch {
      // Product status remains the source of truth if Redis is unavailable.
    }
  }

  async workbench(tenantId: string, id: string) {
    const product = await this.detail(tenantId, id);
    const skuIds = product.skus.map((item) => item.id);
    const [prices, inventoryLogs, purchases, operationLogs] =
      await Promise.all([
        skuIds.length
          ? Promise.all(skuIds.map((skuId) => this.prices.list(tenantId, skuId)))
          : [],
        skuIds.length
          ? this.dataSource.query(
              `SELECT il.id, il.sku_id, s.sku_name, il.operation_type,
                      il.change_quantity, il.before_quantity, il.after_quantity,
                      il.stock_unit, il.reason, il.operator_id, il.created_at
               FROM inventory_logs il
               JOIN skus s ON s.id = il.sku_id
               WHERE il.tenant_id = ? AND il.sku_id IN (?)
               ORDER BY il.id DESC LIMIT 200`,
              [tenantId, skuIds],
            )
          : [],
        this.dataSource.query(
          `SELECT po.id, po.purchase_no, po.purchase_date, po.status,
                  po.remark, poi.sku_id, poi.sku_name, poi.purchase_price,
                  poi.purchase_unit, poi.ordered_quantity,
                  supplier.id AS supplier_id,
                  supplier.supplier_name, po.created_at
           FROM purchase_order_items poi
           JOIN purchase_orders po ON po.id = poi.purchase_order_id
           JOIN suppliers supplier ON supplier.id = po.supplier_id
           JOIN skus s ON s.id = poi.sku_id
           WHERE po.tenant_id = ? AND s.product_id = ?
           ORDER BY po.id DESC LIMIT 100`,
          [tenantId, id],
        ),
        this.dataSource.query(
          `SELECT id, operator_name, action_code, before_data, after_data,
                  created_at
           FROM operation_logs
           WHERE tenant_id = ?
             AND (
               (target_type = 'PRODUCT' AND target_id = ?)
               OR (target_type = 'SKU' AND target_id IN (
                 SELECT id FROM skus WHERE product_id = ?
               ))
             )
           ORDER BY id DESC LIMIT 100`,
          [tenantId, id, id],
        ),
      ]);
    return {
      product,
      prices: {
        level_prices: prices.flatMap((item) => item.level_prices),
        customer_prices: prices.flatMap((item) => item.customer_prices),
        quantity_prices: prices.flatMap((item) => item.quantity_prices),
      },
      inventory_logs: inventoryLogs,
      purchases,
      operation_logs: operationLogs,
    };
  }

  private async productView(
    product: ProductEntity,
    options: {
      activeSkusOnly?: boolean;
      customerId?: string | null;
      includeInventory?: boolean;
    },
  ) {
    const skus = (product.skus ?? []).filter(
      (sku) => !options.activeSkusOnly || sku.status === 'ACTIVE',
    );
    const media = await this.media.find({
      where: {
        tenantId: product.tenantId,
        productId: product.id,
        ...(options.activeSkusOnly ? { status: 'ENABLE' as const } : {}),
      },
      order: { mediaType: 'DESC', sort: 'ASC', id: 'ASC' },
    });
    const descriptions = await this.descriptions.find({
      where: { tenantId: product.tenantId, productId: product.id },
      order: { sort: 'ASC', id: 'ASC' },
    });
    return {
      ...this.simpleProductView(product),
      category: {
        id: product.category.id,
        name: product.category.name,
        parent_id: product.category.parentId,
      },
      media: media.map((item) => ({
        id: item.id,
        media_type: item.mediaType,
        url: item.url,
        thumbnail_url: item.thumbnailUrl,
        sort: item.sort,
        status: item.status,
      })),
      descriptions: descriptions.map((item) => ({
        id: item.id,
        content_json: item.contentJson,
        sort: item.sort,
      })),
      skus: await Promise.all(
        skus.map(async (sku) => {
          const view = await this.skuView(sku, options.includeInventory ?? false);
          const price = await this.prices.calculateSkuPrice({
            tenantId: product.tenantId,
            skuId: sku.id,
            customerId: options.customerId,
            purchaseQuantity: 1,
          });
          return { ...view, price };
        }),
      ),
    };
  }

  private simpleProductView(product: ProductEntity) {
    return {
      id: product.id,
      product_code: product.productCode,
      barcode: product.barcode,
      category_id: product.categoryId,
      name: product.name,
      main_image: product.mainImage,
      origin: product.origin,
      brand: product.brand,
      grade: product.grade,
      description: product.description,
      status: product.status,
      created_at: product.createdAt,
      updated_at: product.updatedAt,
    };
  }

  private async skuView(sku: SkuEntity, includeInventory: boolean) {
    let inventory:
      | {
          stock_quantity: string;
          locked_quantity: string;
          available_quantity: string;
          stock_unit: string;
        }
      | undefined;
    if (includeInventory) {
      const rows = await this.inventory.findBy({
        tenantId: sku.tenantId,
        skuId: sku.id,
      });
      inventory = {
        stock_quantity: this.sum(rows.map((row) => row.stockQuantity)),
        locked_quantity: this.sum(rows.map((row) => row.lockedQuantity)),
        available_quantity: this.sum(
          rows.map((row) => row.availableQuantity),
        ),
        stock_unit: sku.stockUnit,
      };
    }
    return {
      id: sku.id,
      product_id: sku.productId,
      product_name: sku.product?.name,
      sku_code: sku.skuCode,
      sku_name: sku.skuName,
      specification: sku.specification,
      sale_type: sku.saleType,
      piece_unit: sku.pieceUnit,
      weight_unit: sku.weightUnit,
      stock_unit: sku.stockUnit,
      price_unit: sku.priceUnit,
      standard_weight: sku.standardWeight,
      weight_price_type: sku.weightPriceType,
      gross_weight_unit_price: sku.grossWeightUnitPrice,
      net_weight_unit_price: sku.netWeightUnitPrice,
      delivery_weight_per_piece: sku.deliveryWeightPerPiece,
      delivery_weight_unit: sku.deliveryWeightUnit,
      unit: sku.pieceUnit,
      cost_price: sku.costPrice,
      base_price: sku.basePrice,
      market_price: sku.marketPrice,
      stock_warning: sku.stockWarning,
      grade: this.catalogGrade(sku.skuName, sku.specification),
      status: sku.status,
      ...(inventory ? { inventory } : {}),
    };
  }

  private sum(values: string[]): string {
    return values.reduce((sum, value) => sum + Number(value), 0).toFixed(3);
  }

  private catalogGrade(
    skuName: string,
    specification: string | null,
  ): string {
    const source = `${skuName} ${specification ?? ''}`;
    for (const grade of ['特级', '精品', '一级', '二级']) {
      if (source.includes(grade)) return grade;
    }
    return '标准级';
  }

  private validateUnits(dto: CreateSkuDto): void {
    const pieceValid =
      Boolean(dto.piece_unit) &&
      dto.price_unit === dto.piece_unit;
    const weightValid =
      dto.sale_type === 'WEIGHT'
        ? Boolean(dto.weight_unit) &&
          dto.stock_unit === dto.weight_unit &&
          Boolean(dto.standard_weight) &&
          dto.weight_price_type === 'ACTUAL_WEIGHT' &&
          dto.gross_weight_unit_price !== undefined &&
          dto.net_weight_unit_price !== undefined
        : !dto.weight_unit && dto.stock_unit === dto.piece_unit;
    if (!pieceValid || !weightValid) {
      throw new BadRequestException({
        code: 'SKU_UNIT_INVALID',
        message:
          dto.sale_type === 'PIECE'
            ? '按件SKU必须填写一致的件单位、库存单位和价格单位，且不能填写重量单位'
            : '称重SKU必须配置销售件单位、重量库存单位、标准重量及毛重/净重单价',
      });
    }
  }

  private async requireProduct(
    tenantId: string,
    id: string,
  ): Promise<ProductEntity> {
    const product = await this.products.findOneBy({ id, tenantId });
    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: '商品不存在',
      });
    }
    return product;
  }

  private async requireSku(tenantId: string, id: string): Promise<SkuEntity> {
    const sku = await this.skus.findOneBy({ id, tenantId });
    if (!sku) {
      throw new NotFoundException({
        code: 'SKU_NOT_FOUND',
        message: 'SKU不存在',
      });
    }
    return sku;
  }

  private async requireLeafCategory(
    tenantId: string,
    categoryId: string,
  ): Promise<void> {
    const tree = await this.categories.tree(tenantId);
    const category = tree
      .flatMap((root) => root.children)
      .find((item) => item.id === categoryId);
    if (!category) {
      throw new BadRequestException({
        code: 'PRODUCT_CATEGORY_INVALID',
        message: '商品必须关联有效的二级分类',
      });
    }
  }
}
