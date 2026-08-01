import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import {
  CustomerEntity,
  CustomerLevelEntity,
} from '../customers/entities/customer.entities';
import {
  CreateQuantityPriceDto,
  UpdateQuantityPriceDto,
  UpsertCustomerPriceDto,
  UpsertLevelPriceDto,
} from './dto/price.dto';
import {
  CustomerPriceEntity,
  PriceLevelEntity,
  QuantityPriceEntity,
} from './entities/price.entities';
import { SkuEntity } from './entities/product.entities';

export type PriceCalculation = {
  sku_id: string;
  sale_type: string;
  price_unit: string;
  purchase_quantity: string;
  base_price: string;
  level_price: string | null;
  customer_price: string | null;
  quantity_price: string | null;
  agreement_price: string | null;
  price_source: 'BASE' | 'LEVEL' | 'CUSTOMER' | 'QUANTITY' | 'AGREEMENT';
  final_unit_price: string;
};

@Injectable()
export class PriceService {
  constructor(
    @InjectRepository(SkuEntity)
    private readonly skus: Repository<SkuEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customers: Repository<CustomerEntity>,
    @InjectRepository(CustomerLevelEntity)
    private readonly customerLevels: Repository<CustomerLevelEntity>,
    @InjectRepository(PriceLevelEntity)
    private readonly levelPrices: Repository<PriceLevelEntity>,
    @InjectRepository(CustomerPriceEntity)
    private readonly customerPrices: Repository<CustomerPriceEntity>,
    @InjectRepository(QuantityPriceEntity)
    private readonly quantityPrices: Repository<QuantityPriceEntity>,
  ) {}

  async calculateSkuPrice(input: {
    tenantId: string;
    skuId: string;
    customerId?: string | null;
    purchaseQuantity: number;
    manager?: EntityManager;
  }): Promise<PriceCalculation> {
    const skus = input.manager?.getRepository(SkuEntity) ?? this.skus;
    const customers =
      input.manager?.getRepository(CustomerEntity) ?? this.customers;
    const levelPrices =
      input.manager?.getRepository(PriceLevelEntity) ?? this.levelPrices;
    const customerPrices =
      input.manager?.getRepository(CustomerPriceEntity) ?? this.customerPrices;
    const quantityPrices =
      input.manager?.getRepository(QuantityPriceEntity) ?? this.quantityPrices;
    const sku = await skus.findOneBy({
      id: input.skuId,
      tenantId: input.tenantId,
      status: 'ACTIVE',
    });
    if (!sku) {
      throw new NotFoundException({
        code: 'SKU_NOT_FOUND',
        message: 'SKU不存在或已停用',
      });
    }
    this.validatePurchaseQuantity(sku, input.purchaseQuantity);

    let levelPrice: PriceLevelEntity | null = null;
    let customerPrice: CustomerPriceEntity | null = null;
    let agreementPrice: string | null = null;
    if (input.customerId) {
      const customer = await customers.findOneBy({
        id: input.customerId,
        tenantId: input.tenantId,
        status: 'ACTIVE',
      });
      if (!customer) {
        throw new NotFoundException({
          code: 'CUSTOMER_NOT_FOUND',
          message: '客户不存在或已停用',
        });
      }
      [levelPrice, customerPrice] = await Promise.all([
        levelPrices.findOneBy({
          tenantId: input.tenantId,
          levelId: customer.levelId,
          skuId: sku.id,
          status: 'ACTIVE',
        }),
        customerPrices.findOneBy({
          tenantId: input.tenantId,
          customerId: customer.id,
          skuId: sku.id,
          status: 'ACTIVE',
        }),
      ]);
      const agreementRows = await (input.manager ?? this.customerPrices.manager).query(
        `SELECT agreement_price FROM customer_agreements
         WHERE tenant_id=? AND customer_id=? AND sku_id=? AND status='ACTIVE'
           AND start_time<=NOW() AND (end_time IS NULL OR end_time>=NOW()) LIMIT 1`,
        [input.tenantId, customer.id, sku.id],
      );
      agreementPrice = agreementRows[0]?.agreement_price ?? null;
    }

    const tiers = await quantityPrices.find({
      where: {
        tenantId: input.tenantId,
        skuId: sku.id,
        status: 'ACTIVE',
      },
      order: { minQuantity: 'DESC' },
    });
    const tier =
      tiers.find(
        (item) =>
          input.purchaseQuantity >= Number(item.minQuantity) &&
          (item.maxQuantity === null ||
            input.purchaseQuantity <= Number(item.maxQuantity)),
      ) ?? null;

    let finalPrice = sku.basePrice;
    let source: PriceCalculation['price_source'] = 'BASE';
    if (customerPrice) {
      finalPrice = customerPrice.price;
      source = 'CUSTOMER';
    } else if (levelPrice) {
      finalPrice = levelPrice.price;
      source = 'LEVEL';
    }
    if (tier) {
      finalPrice = tier.price;
      source = 'QUANTITY';
    }
    if (agreementPrice !== null) {
      finalPrice = agreementPrice;
      source = 'AGREEMENT';
    }

    return {
      sku_id: sku.id,
      sale_type: sku.saleType,
      price_unit: sku.priceUnit,
      purchase_quantity: input.purchaseQuantity.toFixed(3),
      base_price: sku.basePrice,
      level_price: levelPrice?.price ?? null,
      customer_price: customerPrice?.price ?? null,
      quantity_price: tier?.price ?? null,
      agreement_price: agreementPrice,
      price_source: source,
      final_unit_price: finalPrice,
    };
  }

  async list(tenantId: string, skuId?: string) {
    const where = { tenantId, ...(skuId ? { skuId } : {}) };
    const [levels, customers, quantities] = await Promise.all([
      this.levelPrices.find({ where, order: { id: 'DESC' } }),
      this.customerPrices.find({ where, order: { id: 'DESC' } }),
      this.quantityPrices.find({
        where,
        order: { skuId: 'ASC', minQuantity: 'ASC' },
      }),
    ]);
    return {
      level_prices: levels.map((item) => this.levelView(item)),
      customer_prices: customers.map((item) => this.customerView(item)),
      quantity_prices: quantities.map((item) => this.quantityView(item)),
    };
  }

  async referenceData(tenantId: string) {
    const [skus, customers, levels] = await Promise.all([
      this.skus.find({
        where: { tenantId },
        relations: { product: true },
        order: { id: 'DESC' },
      }),
      this.customers.find({
        where: { tenantId },
        relations: { level: true },
        order: { id: 'DESC' },
      }),
      this.customerLevels.find({
        where: { tenantId, status: 'ACTIVE' },
        order: { sort: 'ASC', id: 'ASC' },
      }),
    ]);
    return {
      skus: skus.map((sku) => ({
        id: sku.id,
        sku_code: sku.skuCode,
        sku_name: sku.skuName,
        product_name: sku.product.name,
        sale_type: sku.saleType,
        price_unit: sku.priceUnit,
        base_price: sku.basePrice,
      })),
      customers: customers.map((customer) => ({
        id: customer.id,
        customer_no: customer.customerNo,
        customer_name: customer.customerName,
        level_id: customer.levelId,
      })),
      levels: levels.map((level) => ({
        id: level.id,
        name: level.name,
        level_code: level.levelCode,
      })),
    };
  }

  async upsertLevel(tenantId: string, dto: UpsertLevelPriceDto) {
    await this.requireSku(tenantId, dto.sku_id);
    const level = await this.customerLevels.findOneBy({
      id: dto.level_id,
      tenantId,
    });
    if (!level) {
      throw new NotFoundException({
        code: 'CUSTOMER_LEVEL_NOT_FOUND',
        message: '客户等级不存在',
      });
    }
    const existing = await this.levelPrices.findOneBy({
      tenantId,
      levelId: dto.level_id,
      skuId: dto.sku_id,
    });
    const entity =
      existing ??
      this.levelPrices.create({
        tenantId,
        levelId: dto.level_id,
        skuId: dto.sku_id,
      });
    entity.price = dto.price.toFixed(4);
    entity.status = dto.status ?? 'ACTIVE';
    return this.levelView(await this.levelPrices.save(entity));
  }

  async upsertCustomer(tenantId: string, dto: UpsertCustomerPriceDto) {
    await this.requireSku(tenantId, dto.sku_id);
    const customer = await this.customers.findOneBy({
      id: dto.customer_id,
      tenantId,
    });
    if (!customer) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: '客户不存在',
      });
    }
    const existing = await this.customerPrices.findOneBy({
      tenantId,
      customerId: dto.customer_id,
      skuId: dto.sku_id,
    });
    const entity =
      existing ??
      this.customerPrices.create({
        tenantId,
        customerId: dto.customer_id,
        skuId: dto.sku_id,
      });
    entity.price = dto.price.toFixed(4);
    entity.status = dto.status ?? 'ACTIVE';
    return this.customerView(await this.customerPrices.save(entity));
  }

  async createQuantity(tenantId: string, dto: CreateQuantityPriceDto) {
    await this.requireSku(tenantId, dto.sku_id);
    await this.validateTier(tenantId, dto);
    const entity = this.quantityPrices.create({
      tenantId,
      skuId: dto.sku_id,
      minQuantity: dto.min_quantity.toFixed(3),
      maxQuantity: dto.max_quantity?.toFixed(3) ?? null,
      price: dto.price.toFixed(4),
      status: dto.status ?? 'ACTIVE',
    });
    return this.quantityView(await this.quantityPrices.save(entity));
  }

  async updateQuantity(
    tenantId: string,
    id: string,
    dto: UpdateQuantityPriceDto,
  ) {
    const entity = await this.quantityPrices.findOneBy({ id, tenantId });
    if (!entity) {
      throw new NotFoundException({
        code: 'QUANTITY_PRICE_NOT_FOUND',
        message: '阶梯价格不存在',
      });
    }
    await this.requireSku(tenantId, dto.sku_id);
    await this.validateTier(tenantId, dto, id);
    Object.assign(entity, {
      skuId: dto.sku_id,
      minQuantity: dto.min_quantity.toFixed(3),
      maxQuantity: dto.max_quantity?.toFixed(3) ?? null,
      price: dto.price.toFixed(4),
      status: dto.status ?? entity.status,
    });
    return this.quantityView(await this.quantityPrices.save(entity));
  }

  async remove(
    tenantId: string,
    type: 'levels' | 'customers' | 'quantities',
    id: string,
  ): Promise<{ deleted: true }> {
    const repository =
      type === 'levels'
        ? this.levelPrices
        : type === 'customers'
          ? this.customerPrices
          : this.quantityPrices;
    const result = await repository.delete({ id, tenantId });
    if (!result.affected) {
      throw new NotFoundException({
        code: 'PRICE_RULE_NOT_FOUND',
        message: '价格规则不存在',
      });
    }
    return { deleted: true };
  }

  private validatePurchaseQuantity(sku: SkuEntity, quantity: number): void {
    if (quantity <= 0 || (sku.saleType === 'PIECE' && !Number.isInteger(quantity))) {
      throw new BadRequestException({
        code: 'PURCHASE_QUANTITY_INVALID',
        message:
          sku.saleType === 'PIECE'
            ? '按件SKU的采购数量必须为正整数'
            : '称重SKU的预计重量必须大于0',
      });
    }
  }

  private async validateTier(
    tenantId: string,
    dto: CreateQuantityPriceDto,
    excludeId?: string,
  ): Promise<void> {
    if (
      dto.max_quantity !== undefined &&
      dto.max_quantity < dto.min_quantity
    ) {
      throw new BadRequestException({
        code: 'QUANTITY_PRICE_RANGE_INVALID',
        message: '阶梯价格最大数量不能小于最小数量',
      });
    }
    const rules = await this.quantityPrices.findBy({
      tenantId,
      skuId: dto.sku_id,
    });
    const min = dto.min_quantity;
    const max = dto.max_quantity ?? Number.POSITIVE_INFINITY;
    const overlap = rules.some((rule) => {
      if (rule.id === excludeId) return false;
      const currentMin = Number(rule.minQuantity);
      const currentMax =
        rule.maxQuantity === null
          ? Number.POSITIVE_INFINITY
          : Number(rule.maxQuantity);
      return min <= currentMax && max >= currentMin;
    });
    if (overlap) {
      throw new BadRequestException({
        code: 'QUANTITY_PRICE_RANGE_OVERLAP',
        message: '阶梯价格区间不能重叠',
      });
    }
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

  private levelView(item: PriceLevelEntity) {
    return {
      id: item.id,
      level_id: item.levelId,
      sku_id: item.skuId,
      price: item.price,
      status: item.status,
    };
  }

  private customerView(item: CustomerPriceEntity) {
    return {
      id: item.id,
      customer_id: item.customerId,
      sku_id: item.skuId,
      price: item.price,
      status: item.status,
    };
  }

  private quantityView(item: QuantityPriceEntity) {
    return {
      id: item.id,
      sku_id: item.skuId,
      min_quantity: item.minQuantity,
      max_quantity: item.maxQuantity,
      price: item.price,
      status: item.status,
    };
  }
}
