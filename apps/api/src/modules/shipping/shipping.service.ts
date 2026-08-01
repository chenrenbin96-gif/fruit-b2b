import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { CustomerEntity } from '../customers/entities/customer.entities';
import { OrderEntity } from '../orders/entities/order.entities';
import { centsToAmount, multiplyPriceToCents } from '../orders/money';
import { DeliveryRegionEntity } from '../system/entities/system.entities';
import {
  ShippingRecordEntity,
  ShippingRuleEntity,
} from './entities/shipping.entities';

@Injectable()
export class ShippingService {
  constructor(
    @InjectRepository(ShippingRuleEntity)
    private readonly rules: Repository<ShippingRuleEntity>,
    @InjectRepository(DeliveryRegionEntity)
    private readonly regions: Repository<DeliveryRegionEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customers: Repository<CustomerEntity>,
  ) {}

  async listRegions(tenantId: string, activeOnly = false) {
    const items = await this.regions.find({
      where: {
        tenantId,
        ...(activeOnly ? { status: 'ACTIVE' } : {}),
      },
      order: { sort: 'ASC', id: 'ASC' },
    });
    return items.map((item) => this.regionView(item));
  }

  async createRegion(
    tenantId: string,
    dto: {
      region_code: string;
      region_name: string;
      address_keywords?: string;
      min_order_amount: number;
      is_default: boolean;
      sort: number;
      status: 'ACTIVE' | 'DISABLED';
    },
  ) {
    return this.regions.manager.transaction(async (manager) => {
      if (dto.is_default) {
        await manager.update(
          DeliveryRegionEntity,
          { tenantId, isDefault: true },
          { isDefault: false },
        );
      }
      const item = manager.create(DeliveryRegionEntity, {
        tenantId,
        regionCode: dto.region_code.trim(),
        regionName: dto.region_name.trim(),
        addressKeywords: dto.address_keywords?.trim() || null,
        minOrderAmount: dto.min_order_amount.toFixed(2),
        isDefault: dto.is_default,
        sort: dto.sort,
        status: dto.status,
        description: null,
      });
      return this.regionView(await manager.save(item));
    });
  }

  async updateRegion(
    tenantId: string,
    id: string,
    dto: {
      region_code: string;
      region_name: string;
      address_keywords?: string;
      min_order_amount: number;
      is_default: boolean;
      sort: number;
      status: 'ACTIVE' | 'DISABLED';
    },
  ) {
    return this.regions.manager.transaction(async (manager) => {
      const item = await manager.findOneBy(DeliveryRegionEntity, {
        id,
        tenantId,
      });
      if (!item) {
        throw new NotFoundException({
          code: 'DELIVERY_REGION_NOT_FOUND',
          message: '配送区域不存在',
        });
      }
      if (dto.is_default) {
        await manager.update(
          DeliveryRegionEntity,
          { tenantId, isDefault: true },
          { isDefault: false },
        );
      }
      item.regionCode = dto.region_code.trim();
      item.regionName = dto.region_name.trim();
      item.addressKeywords = dto.address_keywords?.trim() || null;
      item.minOrderAmount = dto.min_order_amount.toFixed(2);
      item.isDefault = dto.is_default;
      item.sort = dto.sort;
      item.status = dto.status;
      return this.regionView(await manager.save(item));
    });
  }

  async createRule(
    tenantId: string,
    dto: {
      delivery_region_id: string;
      name: string;
      calculation_type: 'WEIGHT' | 'FIXED';
      price_per_weight?: number;
      weight_unit?: '斤' | '公斤';
      fixed_fee?: number;
      status: 'ACTIVE' | 'DISABLED';
    },
  ) {
    this.validateRule(dto);
    const region = await this.regions.findOneBy({
      id: dto.delivery_region_id,
      tenantId,
    });
    if (!region) {
      throw new BadRequestException({
        code: 'DELIVERY_REGION_NOT_FOUND',
        message: '配送区域不存在',
      });
    }
    const rule = this.rules.create({
      tenantId,
      deliveryRegionId: region.id,
      name: dto.name.trim(),
      calculationType: dto.calculation_type,
      fixedFee:
        dto.calculation_type === 'FIXED'
          ? Number(dto.fixed_fee).toFixed(2)
          : null,
      pricePerWeight:
        dto.calculation_type === 'WEIGHT'
          ? Number(dto.price_per_weight).toFixed(4)
          : null,
      weightUnit:
        dto.calculation_type === 'WEIGHT' ? dto.weight_unit! : null,
      status: dto.status,
    });
    await this.rules.save(rule);
    return this.view(
      await this.rules.findOneOrFail({
        where: { id: rule.id, tenantId },
        relations: { region: true },
      }),
    );
  }

  async listRules(tenantId: string, activeOnly = false) {
    const items = await this.rules.find({
      where: {
        tenantId,
        ...(activeOnly ? { status: 'ACTIVE' as const } : {}),
      },
      relations: { region: true },
      order: { id: 'ASC' },
    });
    return items.map((rule) => this.view(rule));
  }

  async updateRule(
    tenantId: string,
    id: string,
    dto: {
      name: string;
      calculation_type: 'WEIGHT' | 'FIXED';
      price_per_weight?: number;
      weight_unit?: '斤' | '公斤';
      fixed_fee?: number;
      status: 'ACTIVE' | 'DISABLED';
    },
  ) {
    this.validateRule(dto);
    const rule = await this.rules.findOneBy({ id, tenantId });
    if (!rule) throw this.notFound();
    rule.name = dto.name.trim();
    rule.calculationType = dto.calculation_type;
    rule.fixedFee =
      dto.calculation_type === 'FIXED'
        ? Number(dto.fixed_fee).toFixed(2)
        : null;
    rule.pricePerWeight =
      dto.calculation_type === 'WEIGHT'
        ? Number(dto.price_per_weight).toFixed(4)
        : null;
    rule.weightUnit =
      dto.calculation_type === 'WEIGHT' ? dto.weight_unit! : null;
    rule.status = dto.status;
    await this.rules.save(rule);
    return this.view(
      await this.rules.findOneOrFail({
        where: { id, tenantId },
        relations: { region: true },
      }),
    );
  }

  async estimate(
    tenantId: string,
    weight: number,
    weightUnit: '斤' | '公斤',
    regionId?: string,
  ) {
    const rule = await this.requireRule(undefined, tenantId, regionId);
    return this.calculate(rule, weight, weightUnit);
  }

  async quoteForCustomer(input: {
    tenantId: string;
    customerId: string;
    weight: number;
    weightUnit: '斤' | '公斤';
    manager?: EntityManager;
  }) {
    const customers =
      input.manager?.getRepository(CustomerEntity) ?? this.customers;
    const customer = await customers.findOneBy({
      id: input.customerId,
      tenantId: input.tenantId,
    });
    if (!customer) {
      throw new BadRequestException({
        code: 'CUSTOMER_NOT_FOUND',
        message: '客户不存在',
      });
    }
    const region = await this.resolveRegion(
      input.tenantId,
      customer.address,
      customer.deliveryRegionId,
      input.manager,
    );
    const rule = await this.requireRule(
      input.manager,
      input.tenantId,
      region.id,
    );
    return {
      ...this.calculate(rule, input.weight, input.weightUnit),
      delivery_region_name: region.regionName,
      min_order_amount: region.minOrderAmount,
    };
  }

  async deliveryMinimumCheck(input: {
    tenantId: string;
    customerId: string;
    productAmount: string;
    manager?: EntityManager;
  }) {
    const customers =
      input.manager?.getRepository(CustomerEntity) ?? this.customers;
    const customer = await customers.findOneBy({
      id: input.customerId,
      tenantId: input.tenantId,
    });
    if (!customer) {
      throw new BadRequestException({
        code: 'CUSTOMER_NOT_FOUND',
        message: '客户不存在',
      });
    }
    const region = await this.resolveRegion(
      input.tenantId,
      customer.address,
      customer.deliveryRegionId,
      input.manager,
    );
    const required = Number(region.minOrderAmount);
    const current = Number(input.productAmount);
    return {
      delivery_region_id: region.id,
      delivery_region_name: region.regionName,
      required_min_amount: required.toFixed(2),
      current_amount: current.toFixed(2),
      shortfall_amount: Math.max(0, required - current).toFixed(2),
      passed: current >= required,
    };
  }

  async calculateAndRecord(input: {
    manager: EntityManager;
    order: OrderEntity;
    actualKilograms: number;
  }): Promise<{ shippingFee: string; rule: ShippingRuleEntity }> {
    const rule = await this.requireRule(
      input.manager,
      input.order.tenantId,
      input.order.deliveryRegionId ?? undefined,
    );
    const calculated = this.calculate(rule, input.actualKilograms, '公斤');
    const estimated = this.calculate(
      rule,
      Number(input.order.estimatedWeight ?? 0),
      '公斤',
    );
    const records = input.manager.getRepository(ShippingRecordEntity);
    const record =
      (await records.findOneBy({ orderId: input.order.id })) ??
      records.create({
        tenantId: input.order.tenantId,
        orderId: input.order.id,
      });
    record.shippingRuleId = rule.id;
    record.deliveryRegionId = rule.deliveryRegionId;
    record.estimatedWeight = estimated.weight;
    record.actualWeight = calculated.weight;
    record.weightUnit = calculated.weight_unit;
    record.shippingPrice =
      rule.calculationType === 'FIXED'
        ? rule.fixedFee ?? '0.00'
        : rule.pricePerWeight ?? '0.0000';
    record.shippingFee = calculated.shipping_fee;
    record.status = 'COMPLETED';
    await records.save(record);
    input.order.deliveryRegionId = rule.deliveryRegionId;
    return { shippingFee: calculated.shipping_fee, rule };
  }

  async calculateEstimateAndRecord(input: {
    manager: EntityManager;
    order: OrderEntity;
    estimatedKilograms: number;
  }): Promise<{ shippingFee: string; rule: ShippingRuleEntity }> {
    const rule = await this.requireRule(
      input.manager,
      input.order.tenantId,
      input.order.deliveryRegionId ?? undefined,
    );
    const calculated = this.calculate(
      rule,
      input.estimatedKilograms,
      '公斤',
    );
    const records = input.manager.getRepository(ShippingRecordEntity);
    const record =
      (await records.findOneBy({ orderId: input.order.id })) ??
      records.create({
        tenantId: input.order.tenantId,
        orderId: input.order.id,
      });
    record.shippingRuleId = rule.id;
    record.deliveryRegionId = rule.deliveryRegionId;
    record.estimatedWeight = calculated.weight;
    record.actualWeight = null;
    record.weightUnit = calculated.weight_unit;
    record.shippingPrice =
      rule.calculationType === 'FIXED'
        ? rule.fixedFee ?? '0.00'
        : rule.pricePerWeight ?? '0.0000';
    record.shippingFee = calculated.shipping_fee;
    record.status = 'PENDING_CALCULATION';
    await records.save(record);
    input.order.deliveryRegionId = rule.deliveryRegionId;
    return { shippingFee: calculated.shipping_fee, rule };
  }

  private async requireRule(
    manager: EntityManager | undefined,
    tenantId: string,
    regionId?: string,
  ): Promise<ShippingRuleEntity> {
    const ruleRepository = manager?.getRepository(ShippingRuleEntity) ?? this.rules;
    let selectedRegionId = regionId;
    if (!selectedRegionId) {
      const regions = manager?.getRepository(DeliveryRegionEntity);
      const region = regions
        ? await regions.findOneBy({
            tenantId,
            isDefault: true,
            status: 'ACTIVE',
          })
        : await this.rules.manager.getRepository(DeliveryRegionEntity).findOneBy({
            tenantId,
            isDefault: true,
            status: 'ACTIVE',
          });
      selectedRegionId = region?.id;
    }
    if (!selectedRegionId) {
      throw new BadRequestException({
        code: 'DELIVERY_REGION_NOT_CONFIGURED',
        message: '未配置默认配送区域',
      });
    }
    const rule = await ruleRepository.findOne({
      where: {
        tenantId,
        deliveryRegionId: selectedRegionId,
        status: 'ACTIVE',
      },
      relations: { region: true },
    });
    if (!rule) throw this.notFound();
    return rule;
  }

  private calculate(
    rule: ShippingRuleEntity,
    weight: number,
    fromUnit: '斤' | '公斤',
  ) {
    if (rule.calculationType === 'FIXED') {
      return {
        delivery_region_id: rule.deliveryRegionId,
        calculation_type: rule.calculationType,
        weight: weight.toFixed(3),
        weight_unit: fromUnit,
        shipping_price: rule.fixedFee ?? '0.00',
        fixed_fee: rule.fixedFee ?? '0.00',
        shipping_fee: Number(rule.fixedFee ?? 0).toFixed(2),
      };
    }
    const ruleUnit = rule.weightUnit ?? '公斤';
    const normalized =
      fromUnit === ruleUnit
        ? weight
        : fromUnit === '斤'
          ? weight / 2
          : weight * 2;
    return {
      delivery_region_id: rule.deliveryRegionId,
      calculation_type: rule.calculationType,
      weight: normalized.toFixed(3),
      weight_unit: ruleUnit,
      shipping_price: rule.pricePerWeight ?? '0.0000',
      fixed_fee: null,
      shipping_fee: centsToAmount(
        multiplyPriceToCents(rule.pricePerWeight ?? '0', normalized.toFixed(3)),
      ),
    };
  }

  private view(rule: ShippingRuleEntity) {
    return {
      id: rule.id,
      name: rule.name,
      calculation_type: rule.calculationType,
      delivery_region_id: rule.deliveryRegionId,
      delivery_region_name: rule.region?.regionName,
      min_order_amount: rule.region?.minOrderAmount,
      price_per_weight: rule.pricePerWeight,
      weight_unit: rule.weightUnit,
      fixed_fee: rule.fixedFee,
      status: rule.status,
    };
  }

  private async resolveRegion(
    tenantId: string,
    address: string,
    preferredId?: string | null,
    manager?: EntityManager,
  ): Promise<DeliveryRegionEntity> {
    const regions =
      manager?.getRepository(DeliveryRegionEntity) ?? this.regions;
    if (preferredId) {
      const preferred = await regions.findOneBy({
        id: preferredId,
        tenantId,
        status: 'ACTIVE',
      });
      if (preferred) return preferred;
    }
    const items = await regions.find({
      where: { tenantId, status: 'ACTIVE' },
      order: { sort: 'ASC', id: 'ASC' },
    });
    const matched = items.find((item) =>
      (item.addressKeywords ?? '')
        .split(/[,，]/)
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .some((keyword) => address.includes(keyword)),
    );
    const region = matched ?? items.find((item) => item.isDefault);
    if (!region) {
      throw new BadRequestException({
        code: 'DELIVERY_REGION_NOT_CONFIGURED',
        message: '客户地址不在可配送区域内',
      });
    }
    return region;
  }

  private regionView(region: DeliveryRegionEntity) {
    return {
      id: region.id,
      region_code: region.regionCode,
      region_name: region.regionName,
      address_keywords: region.addressKeywords,
      min_order_amount: region.minOrderAmount,
      is_default: region.isDefault,
      sort: region.sort,
      status: region.status,
    };
  }

  private validateRule(dto: {
    calculation_type: 'WEIGHT' | 'FIXED';
    price_per_weight?: number;
    weight_unit?: '斤' | '公斤';
    fixed_fee?: number;
  }) {
    if (
      dto.calculation_type === 'WEIGHT' &&
      (dto.price_per_weight === undefined || !dto.weight_unit)
    ) {
      throw new BadRequestException({
        code: 'SHIPPING_WEIGHT_RULE_INVALID',
        message: '按重量计费必须填写重量单价和重量单位',
      });
    }
    if (
      dto.calculation_type === 'FIXED' &&
      dto.fixed_fee === undefined
    ) {
      throw new BadRequestException({
        code: 'SHIPPING_FIXED_RULE_INVALID',
        message: '固定运费规则必须填写固定费用',
      });
    }
  }

  private notFound() {
    return new NotFoundException({
      code: 'SHIPPING_RULE_NOT_FOUND',
      message: '当前配送区域未配置有效运费规则',
    });
  }
}
