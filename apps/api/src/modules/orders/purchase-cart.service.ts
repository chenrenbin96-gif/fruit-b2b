import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { InventoryEntity } from '../inventory/entities/inventory.entities';
import { PriceService } from '../products/price.service';
import { ProductEntity, SkuEntity } from '../products/entities/product.entities';
import { ShippingService } from '../shipping/shipping.service';
import { WarehouseEntity } from '../system/entities/system.entities';
import { AddCartItemDto, UpdateCartItemDto } from './dto/order.dto';
import {
  OrderEntity,
  PurchaseCartEntity,
  PurchaseCartItemEntity,
} from './entities/order.entities';
import { centsToAmount, multiplyPriceToCents } from './money';
import { OrderPolicyService } from './order-policy.service';

@Injectable()
export class PurchaseCartService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PurchaseCartEntity)
    private readonly carts: Repository<PurchaseCartEntity>,
    @InjectRepository(PurchaseCartItemEntity)
    private readonly items: Repository<PurchaseCartItemEntity>,
    @InjectRepository(SkuEntity)
    private readonly skus: Repository<SkuEntity>,
    @InjectRepository(InventoryEntity)
    private readonly inventory: Repository<InventoryEntity>,
    @InjectRepository(WarehouseEntity)
    private readonly warehouses: Repository<WarehouseEntity>,
    private readonly prices: PriceService,
    private readonly policy: OrderPolicyService,
    private readonly shipping: ShippingService,
  ) {}

  async preview(tenantId: string, customerId: string) {
    const cart = await this.getOrCreate(tenantId, customerId);
    const loaded = await this.loadCart(cart.id, tenantId, customerId);
    const warehouse = await this.warehouses.findOne({
      where: { tenantId, status: 'ACTIVE' },
      order: { id: 'ASC' },
    });
    if (!warehouse) {
      throw new BadRequestException({
        code: 'WAREHOUSE_NOT_CONFIGURED',
        message: '当前租户未配置可用仓库',
      });
    }

    let totalCents = 0n;
    let totalLines = 0;
    let estimatedKilograms = 0;
    const itemViews = [];
    for (const item of loaded.items) {
      const sku = item.sku;
      const purchaseQuantity = this.purchaseQuantity(item);
      const stockQuantity = this.stockQuantity(sku, Number(purchaseQuantity));
      const valid =
        sku.status === 'ACTIVE' && sku.product.status === 'ON_SALE';
      const price = valid
        ? await this.prices.calculateSkuPrice({
            tenantId,
            skuId: sku.id,
            customerId,
            purchaseQuantity: Number(purchaseQuantity),
          })
        : null;
      const lineCents = price
        ? multiplyPriceToCents(price.final_unit_price, purchaseQuantity)
        : 0n;
      totalCents += lineCents;
      totalLines += 1;
      estimatedKilograms += this.deliveryKilograms(
        sku,
        Number(purchaseQuantity),
      );
      const inventory = await this.inventory.findOneBy({
        tenantId,
        warehouseId: warehouse.id,
        skuId: sku.id,
      });
      const available = inventory?.availableQuantity ?? '0.000';
      itemViews.push({
        id: item.id,
        sku_id: sku.id,
        product_id: sku.productId,
        product_name: sku.product.name,
        category_id: sku.product.categoryId,
        category_name: sku.product.category?.name ?? '其他商品',
        main_image: sku.product.mainImage,
        sku_name: sku.skuName,
        specification: sku.specification,
        sale_type: sku.saleType,
        quantity: item.quantity,
        estimated_weight: item.estimatedWeight,
        standard_weight: sku.standardWeight,
        weight_unit: sku.weightUnit,
        unit: sku.pieceUnit,
        stock_unit: sku.stockUnit,
        price_unit: sku.priceUnit,
        unit_price: price?.final_unit_price ?? null,
        price_source: price?.price_source ?? null,
        amount: centsToAmount(lineCents),
        available_quantity: available,
        purchasable: valid && Number(available) >= stockQuantity,
        invalid_reason: !valid
          ? '商品或SKU已下架'
          : Number(available) < stockQuantity
            ? '可售库存不足'
            : null,
      });
    }
    const estimatedAmount = centsToAmount(totalCents);
    const shippingEstimate =
      estimatedKilograms > 0
        ? await this.shipping.quoteForCustomer({
            tenantId,
            customerId,
            weight: estimatedKilograms,
            weightUnit: '公斤',
          })
        : {
            delivery_region_id: null,
            weight: '0.000',
            weight_unit: '公斤',
            shipping_price: '0.0000',
            shipping_fee: '0.00',
          };
    return {
      id: loaded.id,
      status: loaded.status,
      warehouse: {
        id: warehouse.id,
        name: warehouse.warehouseName,
      },
      items: itemViews,
      summary: {
        item_count: totalLines,
        estimated_product_amount: estimatedAmount,
        estimated_weight: shippingEstimate.weight,
        estimated_weight_unit: shippingEstimate.weight_unit,
        shipping_price: shippingEstimate.shipping_price,
        estimated_shipping_fee: shippingEstimate.shipping_fee,
        estimated_amount: (
          Number(estimatedAmount) + Number(shippingEstimate.shipping_fee)
        ).toFixed(2),
        all_items_purchasable: itemViews.every((item) => item.purchasable),
      },
      first_order_check: await this.policy.firstOrderCheck({
        tenantId,
        customerId,
        estimatedAmount,
      }),
      delivery_minimum_check: await this.shipping.deliveryMinimumCheck({
        tenantId,
        customerId,
        productAmount: estimatedAmount,
      }),
    };
  }

  private deliveryKilograms(sku: SkuEntity, requested: number): number {
    if (sku.saleType === 'WEIGHT') {
      return this.toKilograms(
        Number(sku.standardWeight) * requested,
        sku.weightUnit ?? '',
      );
    }
    const weight = Number(sku.deliveryWeightPerPiece);
    if (
      !Number.isFinite(weight) ||
      weight <= 0 ||
      !sku.deliveryWeightUnit
    ) {
      throw new BadRequestException({
        code: 'SKU_DELIVERY_WEIGHT_REQUIRED',
        message: `${sku.skuName}未配置单件配送重量`,
      });
    }
    return this.toKilograms(
      weight * requested,
      sku.deliveryWeightUnit,
    );
  }

  private toKilograms(quantity: number, unit: string): number {
    if (unit === '斤') return quantity / 2;
    if (['公斤', '千克', 'kg', 'KG'].includes(unit)) return quantity;
    throw new BadRequestException({
      code: 'WEIGHT_UNIT_UNSUPPORTED',
      message: `暂不支持重量单位“${unit}”`,
    });
  }

  async add(
    tenantId: string,
    customerId: string,
    dto: AddCartItemDto,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const cart = await this.lockActiveCart(manager, tenantId, customerId);
      const sku = await this.requirePurchasableSku(
        tenantId,
        dto.sku_id,
        manager,
      );
      const input = this.validateInput(sku, dto);
      const itemRepository = manager.getRepository(PurchaseCartItemEntity);
      let item = await itemRepository
        .createQueryBuilder('item')
        .setLock('pessimistic_write')
        .where('item.tenant_id = :tenantId', { tenantId })
        .andWhere('item.cart_id = :cartId', { cartId: cart.id })
        .andWhere('item.sku_id = :skuId', { skuId: sku.id })
        .getOne();
      if (item) {
        item.quantity = (
          Number(item.quantity ?? 0) + Number(input.quantity)
        ).toFixed(3);
        item.estimatedWeight =
          sku.saleType === 'WEIGHT'
            ? (Number(sku.standardWeight) * Number(item.quantity)).toFixed(3)
            : null;
      } else {
        item = itemRepository.create({
          tenantId,
          cartId: cart.id,
          skuId: sku.id,
          saleType: sku.saleType,
          quantity: input.quantity,
          estimatedWeight: input.estimatedWeight,
        });
      }
      await itemRepository.save(item);
    });
    return this.preview(tenantId, customerId);
  }

  async update(
    tenantId: string,
    customerId: string,
    itemId: string,
    dto: UpdateCartItemDto,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const cart = await this.lockActiveCart(
        manager,
        tenantId,
        customerId,
        false,
      );
      const item = await this.requireOwnedItem(
        tenantId,
        cart.id,
        itemId,
        manager,
      );
      const sku = await this.requirePurchasableSku(
        tenantId,
        item.skuId,
        manager,
      );
      const input = this.validateInput(sku, dto);
      item.saleType = sku.saleType;
      item.quantity = input.quantity;
      item.estimatedWeight = input.estimatedWeight;
      await manager.getRepository(PurchaseCartItemEntity).save(item);
    });
    return this.preview(tenantId, customerId);
  }

  async batchAdd(
    tenantId: string,
    customerId: string,
    items: AddCartItemDto[],
  ) {
    await this.dataSource.transaction(async (manager) => {
      const cart = await this.lockActiveCart(manager, tenantId, customerId);
      const itemRepository = manager.getRepository(PurchaseCartItemEntity);
      const warehouse = await manager.getRepository(WarehouseEntity).findOne({
        where: { tenantId, status: 'ACTIVE' },
        order: { id: 'ASC' },
      });
      if (!warehouse) {
        throw new BadRequestException({
          code: 'WAREHOUSE_NOT_CONFIGURED',
          message: '当前租户未配置可用仓库',
        });
      }
      for (const dto of items) {
        const sku = await this.requirePurchasableSku(
          tenantId,
          dto.sku_id,
          manager,
        );
        const input = this.validateInput(sku, dto);
        let target = await itemRepository
          .createQueryBuilder('item')
          .setLock('pessimistic_write')
          .where('item.tenant_id = :tenantId', { tenantId })
          .andWhere('item.cart_id = :cartId', { cartId: cart.id })
          .andWhere('item.sku_id = :skuId', { skuId: sku.id })
          .getOne();
        const addition = Number(input.quantity);
        const existing = Number(target?.quantity ?? 0);
        const requestedUnits = existing + addition;
        const requestedStock = this.stockQuantity(sku, requestedUnits);
        const stock = await manager.getRepository(InventoryEntity).findOneBy({
          tenantId,
          warehouseId: warehouse.id,
          skuId: sku.id,
        });
        if (!stock || requestedStock > Number(stock.availableQuantity)) {
          throw new BadRequestException({
            code: 'INSUFFICIENT_AVAILABLE_STOCK',
            message: `${sku.product.name} ${sku.skuName}库存不足`,
            details: {
              sku_id: sku.id,
              requested: requestedStock.toFixed(3),
              available: stock?.availableQuantity ?? '0.000',
            },
          });
        }
        target ??= itemRepository.create({
          tenantId,
          cartId: cart.id,
          skuId: sku.id,
          saleType: sku.saleType,
        });
        target.saleType = sku.saleType;
        target.quantity = requestedUnits.toFixed(3);
        target.estimatedWeight =
          sku.saleType === 'WEIGHT'
            ? (Number(sku.standardWeight) * requestedUnits).toFixed(3)
            : null;
        await itemRepository.save(target);
      }
    });
    return this.preview(tenantId, customerId);
  }

  async remove(
    tenantId: string,
    customerId: string,
    itemId: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const cart = await this.lockActiveCart(
        manager,
        tenantId,
        customerId,
        false,
      );
      const item = await this.requireOwnedItem(
        tenantId,
        cart.id,
        itemId,
        manager,
      );
      await manager.getRepository(PurchaseCartItemEntity).delete(item.id);
    });
    return this.preview(tenantId, customerId);
  }

  async clear(tenantId: string, customerId: string) {
    await this.dataSource.transaction(async (manager) => {
      const cart = await this.lockActiveCart(manager, tenantId, customerId);
      await manager
        .getRepository(PurchaseCartItemEntity)
        .delete({ tenantId, cartId: cart.id });
    });
    return this.preview(tenantId, customerId);
  }

  async reorder(
    tenantId: string,
    customerId: string,
    orderId: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const source = await manager.getRepository(OrderEntity).findOne({
        where: { id: orderId, tenantId, customerId },
        relations: { items: { sku: { product: true } } },
      });
      if (!source) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: '订单不存在',
        });
      }
      const cart = await this.lockActiveCart(manager, tenantId, customerId);
      const itemRepository = manager.getRepository(PurchaseCartItemEntity);
      for (const sourceItem of source.items) {
        const sku = await this.requirePurchasableSku(
          tenantId,
          sourceItem.skuId,
          manager,
        );
        const value = sourceItem.actualQuantity ?? sourceItem.plannedQuantity;
        if (!value || Number(value) <= 0) continue;
        let target = await itemRepository
          .createQueryBuilder('item')
          .setLock('pessimistic_write')
          .where('item.tenant_id = :tenantId', { tenantId })
          .andWhere('item.cart_id = :cartId', { cartId: cart.id })
          .andWhere('item.sku_id = :skuId', { skuId: sku.id })
          .getOne();
        target ??= itemRepository.create({
          tenantId,
          cartId: cart.id,
          skuId: sku.id,
          saleType: sku.saleType,
        });
        target.saleType = sku.saleType;
        target.quantity = (
          Number(target.quantity ?? 0) + Number(value)
        ).toFixed(3);
        target.estimatedWeight =
          sku.saleType === 'WEIGHT'
            ? (Number(sku.standardWeight) * Number(target.quantity)).toFixed(3)
            : null;
        await itemRepository.save(target);
      }
    });
    return this.preview(tenantId, customerId);
  }

  private async lockActiveCart(
    manager: EntityManager,
    tenantId: string,
    customerId: string,
    create = true,
  ): Promise<PurchaseCartEntity> {
    if (create) {
      await manager.query(
        `INSERT INTO purchase_carts (tenant_id, customer_id, status)
         VALUES (?, ?, 'ACTIVE')
         ON DUPLICATE KEY UPDATE id = id`,
        [tenantId, customerId],
      );
    }
    const cart = await manager
      .getRepository(PurchaseCartEntity)
      .createQueryBuilder('cart')
      .setLock('pessimistic_write')
      .where('cart.tenant_id = :tenantId', { tenantId })
      .andWhere('cart.customer_id = :customerId', { customerId })
      .andWhere("cart.status = 'ACTIVE'")
      .getOne();
    if (!cart) {
      throw new NotFoundException({
        code: 'PURCHASE_CART_NOT_FOUND',
        message: '采购单不存在或已经提交',
      });
    }
    return cart;
  }

  private async getOrCreate(
    tenantId: string,
    customerId: string,
  ): Promise<PurchaseCartEntity> {
    await this.dataSource.query(
      `INSERT INTO purchase_carts (tenant_id, customer_id, status)
       VALUES (?, ?, 'ACTIVE')
       ON DUPLICATE KEY UPDATE id = id`,
      [tenantId, customerId],
    );
    const cart = await this.carts.findOneBy({
      tenantId,
      customerId,
      status: 'ACTIVE',
    });
    if (!cart) throw new Error('Active cart was not created');
    return cart;
  }

  private async loadCart(
    cartId: string,
    tenantId: string,
    customerId: string,
  ): Promise<PurchaseCartEntity> {
    const cart = await this.carts.findOne({
      where: { id: cartId, tenantId, customerId, status: 'ACTIVE' },
      relations: { items: { sku: { product: { category: true } } } },
      order: { items: { id: 'ASC' } },
    });
    if (!cart) {
      throw new NotFoundException({
        code: 'PURCHASE_CART_NOT_FOUND',
        message: '采购单不存在',
      });
    }
    return cart;
  }

  private async requireOwnedItem(
    tenantId: string,
    cartId: string,
    itemId: string,
    manager: EntityManager,
  ): Promise<PurchaseCartItemEntity> {
    const item = await manager
      .getRepository(PurchaseCartItemEntity)
      .createQueryBuilder('item')
      .setLock('pessimistic_write')
      .where('item.id = :itemId', { itemId })
      .andWhere('item.tenant_id = :tenantId', { tenantId })
      .andWhere('item.cart_id = :cartId', { cartId })
      .getOne();
    if (!item) {
      throw new NotFoundException({
        code: 'PURCHASE_CART_ITEM_NOT_FOUND',
        message: '采购单商品不存在',
      });
    }
    return item;
  }

  private async requirePurchasableSku(
    tenantId: string,
    skuId: string,
    manager?: EntityManager,
  ): Promise<SkuEntity> {
    const repository = manager?.getRepository(SkuEntity) ?? this.skus;
    const sku = await repository.findOne({
      where: { id: skuId, tenantId, status: 'ACTIVE' },
      relations: { product: { category: true } },
    });
    if (!sku || sku.product.status !== 'ON_SALE') {
      throw new BadRequestException({
        code: 'SKU_NOT_PURCHASABLE',
        message: '商品或SKU已下架',
      });
    }
    return sku;
  }

  private validateInput(
    sku: SkuEntity,
    dto: Pick<AddCartItemDto, 'quantity' | 'estimated_weight'>,
  ): { quantity: string | null; estimatedWeight: string | null } {
    if (
      Number.isInteger(dto.quantity) &&
      Number(dto.quantity) > 0 &&
      dto.estimated_weight === undefined
    ) {
      return {
        quantity: Number(dto.quantity).toFixed(3),
        estimatedWeight:
          sku.saleType === 'WEIGHT'
            ? (Number(sku.standardWeight) * Number(dto.quantity)).toFixed(3)
            : null,
      };
    }
    throw new BadRequestException({
      code: 'PURCHASE_CART_QUANTITY_INVALID',
      message: '所有SKU均须传入正整数quantity；称重SKU不能由客户填写预计重量',
    });
  }

  private purchaseQuantity(item: PurchaseCartItemEntity): string {
    return item.quantity ?? '0.000';
  }

  private stockQuantity(sku: SkuEntity, units: number): number {
    return sku.saleType === 'WEIGHT'
      ? Number(sku.standardWeight) * units
      : units;
  }
}
