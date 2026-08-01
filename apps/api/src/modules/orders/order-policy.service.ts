import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Not, Repository } from 'typeorm';

import { CustomerSettingEntity } from '../customers/entities/customer.entities';
import { SystemSettingEntity } from '../system/entities/system.entities';
import { OrderEntity } from './entities/order.entities';

@Injectable()
export class OrderPolicyService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(CustomerSettingEntity)
    private readonly customerSettings: Repository<CustomerSettingEntity>,
    @InjectRepository(SystemSettingEntity)
    private readonly systemSettings: Repository<SystemSettingEntity>,
  ) {}

  async firstOrderCheck(input: {
    tenantId: string;
    customerId: string;
    estimatedAmount: string;
    manager?: EntityManager;
  }) {
    const orders =
      input.manager?.getRepository(OrderEntity) ?? this.orders;
    const customerSettings =
      input.manager?.getRepository(CustomerSettingEntity) ??
      this.customerSettings;
    const systemSettings =
      input.manager?.getRepository(SystemSettingEntity) ??
      this.systemSettings;
    const historicalOrders = await orders.count({
      where: {
        tenantId: input.tenantId,
        customerId: input.customerId,
        status: Not('CANCELLED'),
      },
    });
    const isFirstOrder = historicalOrders === 0;
    if (!isFirstOrder) {
      return {
        is_first_order: false,
        historical_order_count: historicalOrders,
        required_min_amount: '0.00',
        current_amount: input.estimatedAmount,
        passed: true,
      };
    }

    const customerSetting = await customerSettings.findOneBy({
      tenantId: input.tenantId,
      customerId: input.customerId,
      enabled: true,
    });
    let minimum = customerSetting?.firstOrderMinAmount;
    if (minimum === undefined) {
      const setting = await systemSettings.findOneBy({
        tenantId: input.tenantId,
        settingKey: 'order.first_order_min_amount',
      });
      minimum = setting?.settingValue ?? '0';
    }
    return {
      is_first_order: true,
      historical_order_count: historicalOrders,
      required_min_amount: Number(minimum).toFixed(2),
      current_amount: input.estimatedAmount,
      passed: Number(input.estimatedAmount) >= Number(minimum),
    };
  }
}
