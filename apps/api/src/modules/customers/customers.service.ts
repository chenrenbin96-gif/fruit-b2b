import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { AuthPrincipal } from '../auth/types/auth-principal';
import { UpdateCustomerProfileDto } from './dto/customer-profile.dto';
import {
  CustomerAccountEntity,
  CustomerEntity,
} from './entities/customer.entities';
import { DeliveryRegionEntity } from '../system/entities/system.entities';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly customers: Repository<CustomerEntity>,
  ) {}

  async me(principal: AuthPrincipal) {
    const customer = await this.customers.findOne({
      where: {
        id: principal.customerId ?? '',
        tenantId: principal.tenantId,
      },
      relations: { level: true, deliveryRegion: true },
    });
    if (!customer) {
      throw new NotFoundException({
        code: 'CUSTOMER_NOT_FOUND',
        message: '客户资料不存在',
      });
    }

    return {
      id: customer.id,
      customer_no: customer.customerNo,
      customer_name: customer.customerName,
      contact_name: customer.contactName,
      phone: customer.phone,
      address: customer.address,
      delivery_region: customer.deliveryRegion
        ? {
            id: customer.deliveryRegion.id,
            name: customer.deliveryRegion.regionName,
          }
        : null,
      business_type: customer.businessType,
      level: {
        id: customer.level.id,
        code: customer.level.levelCode,
        name: customer.level.name,
      },
      settlement_type: customer.settlementType,
      credit_days: customer.creditDays,
      credit_enabled: customer.creditEnabled,
      credit_limit: customer.creditLimit,
      balance_due: customer.balanceDue,
      status: customer.status,
    };
  }

  async updateMe(
    principal: AuthPrincipal,
    dto: UpdateCustomerProfileDto,
  ) {
    const customerId = principal.customerId ?? '';
    try {
      await this.customers.manager.transaction(async (manager) => {
        const customer = await manager.findOne(CustomerEntity, {
          where: {
            id: customerId,
            tenantId: principal.tenantId,
          },
        });
        if (!customer) {
          throw new NotFoundException({
            code: 'CUSTOMER_NOT_FOUND',
            message: '客户资料不存在',
          });
        }

        if (dto.customer_name !== undefined) {
          customer.customerName = dto.customer_name.trim();
        }
        const accountChanges: Partial<CustomerAccountEntity> = {};
        if (dto.contact_name !== undefined) {
          customer.contactName = dto.contact_name.trim();
          accountChanges.accountName = customer.contactName;
        }
        if (dto.address !== undefined) {
          customer.address = dto.address.trim();
        }
        if (dto.delivery_region_id !== undefined) {
          const region = await manager.findOneBy(DeliveryRegionEntity, {
            id: dto.delivery_region_id,
            tenantId: principal.tenantId,
            status: 'ACTIVE',
          });
          if (!region) {
            throw new BadRequestException({
              code: 'DELIVERY_REGION_NOT_FOUND',
              message: '配送区域不存在或已停用',
            });
          }
          customer.deliveryRegionId = region.id;
        }
        if (dto.phone !== undefined && dto.phone !== customer.phone) {
          customer.phone = dto.phone;
          accountChanges.phone = dto.phone;
        }
        if (Object.keys(accountChanges).length > 0) {
          await manager.update(
            CustomerAccountEntity,
            {
              tenantId: principal.tenantId,
              customerId,
              isPrimary: true,
            },
            accountChanges,
          );
        }
        await manager.save(customer);
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'errno' in error &&
        error.errno === 1062
      ) {
        throw new BadRequestException({
          code: 'CUSTOMER_PHONE_ALREADY_EXISTS',
          message: '该手机号已绑定其他客户账号',
        });
      }
      throw error;
    }
    return this.me(principal);
  }
}
