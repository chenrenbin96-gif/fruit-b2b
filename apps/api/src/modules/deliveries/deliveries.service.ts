import { randomInt } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import type { AuthPrincipal } from '../auth/types/auth-principal';
import { CustomerEntity } from '../customers/entities/customer.entities';
import {
  OrderEntity,
  OrderStatusLogEntity,
} from '../orders/entities/order.entities';
import { ShippingPackageEntity } from '../orders/entities/warehouse-task.entities';
import { UserEntity } from '../users/entities/user.entities';
import { FinanceService } from '../finance/finance.service';
import {
  DeliveryEntity,
  DeliveryLogEntity,
  type DeliveryStatus,
} from './entities/delivery.entity';

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(DeliveryEntity)
    private readonly deliveries: Repository<DeliveryEntity>,
    private readonly finance: FinanceService,
  ) {}

  async createForOrder(
    manager: EntityManager,
    order: OrderEntity,
    customer: CustomerEntity,
  ): Promise<DeliveryEntity> {
    const existing = await manager.getRepository(DeliveryEntity).findOneBy({
      orderId: order.id,
    });
    if (existing) return existing;
    const delivery = await manager.getRepository(DeliveryEntity).save({
      tenantId: order.tenantId,
      orderId: order.id,
      deliveryNo: this.generateDeliveryNo(),
      customerName: customer.customerName,
      phone: customer.phone,
      address: customer.address,
      status: 'WAITING',
    });
    await manager.getRepository(DeliveryLogEntity).save({
      tenantId: order.tenantId,
      deliveryId: delivery.id,
      orderId: order.id,
      deliveryPersonId: null,
      status: 'WAITING',
    });
    return delivery;
  }

  async list(principal: AuthPrincipal, query: {
    status?: DeliveryStatus;
    page: number;
    page_size: number;
  }) {
    const builder = this.deliveries
      .createQueryBuilder('delivery')
      .leftJoinAndSelect('delivery.order', 'orders')
      .leftJoinAndSelect('delivery.deliveryPerson', 'deliveryPerson')
      .loadRelationCountAndMap('orders.itemCount', 'orders.items')
      .where('delivery.tenant_id = :tenantId', {
        tenantId: principal.tenantId,
      });
    if (principal.roleCode === 'DELIVERY') {
      builder.andWhere('delivery.delivery_person_id = :userId', {
        userId: principal.userId,
      });
    }
    if (query.status) {
      builder.andWhere('delivery.status = :status', { status: query.status });
    }
    const [items, total] = await builder
      .orderBy('delivery.id', 'DESC')
      .skip((query.page - 1) * query.page_size)
      .take(query.page_size)
      .getManyAndCount();
    return {
      items: items.map((item) => this.view(item)),
      pagination: {
        page: query.page,
        page_size: query.page_size,
        total,
        total_pages: Math.ceil(total / query.page_size),
      },
    };
  }

  async detail(principal: AuthPrincipal, id: string) {
    const delivery = await this.deliveries.findOne({
      where: { id, tenantId: principal.tenantId },
      relations: { order: { items: true }, deliveryPerson: true, logs: true },
    });
    if (!delivery) throw this.notFound();
    this.assertScope(principal, delivery);
    return this.view(delivery, true);
  }

  async deliveryPeople(tenantId: string) {
    const users = await this.dataSource.getRepository(UserEntity)
      .createQueryBuilder('users')
      .innerJoinAndSelect('users.role', 'role')
      .where('users.tenant_id = :tenantId', { tenantId })
      .andWhere("users.status = 'ACTIVE'")
      .andWhere("role.role_code = 'DELIVERY'")
      .getMany();
    return users.map((user) => ({ id: user.id, name: user.name, phone: user.phone }));
  }

  async assign(principal: AuthPrincipal, id: string, deliveryPersonId: string) {
    if (principal.roleCode !== 'ADMIN') {
      throw new ForbiddenException({
        code: 'DELIVERY_ASSIGN_FORBIDDEN',
        message: '只有管理员可以分配配送员',
      });
    }
    await this.dataSource.transaction(async (manager) => {
      const delivery = await this.lockDelivery(
        manager,
        principal.tenantId,
        id,
      );
      if (delivery.status !== 'WAITING') {
        throw new BadRequestException({
          code: 'DELIVERY_STATUS_INVALID',
          message: '只有待配送任务可以分配配送员',
        });
      }
      const user = await manager.getRepository(UserEntity)
        .createQueryBuilder('users')
        .innerJoinAndSelect('users.role', 'role')
        .where('users.id = :id', { id: deliveryPersonId })
        .andWhere('users.tenant_id = :tenantId', {
          tenantId: principal.tenantId,
        })
        .andWhere("users.status = 'ACTIVE'")
        .andWhere("role.role_code = 'DELIVERY'")
        .getOne();
      if (!user) {
        throw new BadRequestException({
          code: 'DELIVERY_PERSON_INVALID',
          message: '配送人员不存在或已停用',
        });
      }
      delivery.deliveryPersonId = user.id;
      delivery.assignedAt = new Date();
      await manager.getRepository(DeliveryEntity).save(delivery);
    });
    return this.detail(principal, id);
  }

  async updateStatus(
    principal: AuthPrincipal,
    id: string,
    status: 'DELIVERING' | 'DELIVERED' | 'FAILED',
    signedBy?: string,
    remark?: string,
    reasonCode?:
      | 'CUSTOMER_REJECTED'
      | 'UNREACHABLE'
      | 'ADDRESS_ERROR'
      | 'OTHER',
    reason?: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const delivery = await this.lockDelivery(
        manager,
        principal.tenantId,
        id,
      );
      this.assertScope(principal, delivery);
      if (
        (status === 'DELIVERING' && delivery.status !== 'WAITING') ||
        (status === 'DELIVERED' && delivery.status !== 'DELIVERING') ||
        (status === 'FAILED' &&
          !['WAITING', 'DELIVERING'].includes(delivery.status))
      ) {
        throw new BadRequestException({
          code: 'DELIVERY_STATUS_INVALID',
          message:
            status === 'DELIVERING'
              ? '只有待配送任务可以开始配送'
              : status === 'DELIVERED'
                ? '只有配送中任务可以确认送达'
                : '只有待配送或配送中任务可以登记异常',
        });
      }
      if (!delivery.deliveryPersonId) {
        throw new BadRequestException({
          code: 'DELIVERY_PERSON_REQUIRED',
          message: '请先分配配送员',
        });
      }
      const order = await manager
        .getRepository(OrderEntity)
        .createQueryBuilder('orders')
        .setLock('pessimistic_write')
        .where('orders.id = :id', { id: delivery.orderId })
        .getOneOrFail();
      const fromStatus = order.status;
      if (status === 'DELIVERING') {
        if (order.status !== 'WAITING_DELIVERY') {
          throw new BadRequestException({
            code: 'ORDER_STATUS_INVALID',
            message: '订单尚未进入待配送状态',
          });
        }
        const shipment = await manager.getRepository(ShippingPackageEntity)
          .findOneBy({ orderId: order.id, tenantId: order.tenantId });
        if (!shipment?.outboundAt) {
          throw new BadRequestException({
            code: 'PACKAGE_NOT_OUTBOUND',
            message: '仓库尚未确认出库',
          });
        }
        delivery.status = 'DELIVERING';
        delivery.startedAt = new Date();
        order.status = 'DELIVERING';
      } else if (status === 'DELIVERED') {
        if (order.status !== 'DELIVERING') {
          throw new BadRequestException({
            code: 'ORDER_STATUS_INVALID',
            message: '订单尚未进入配送中状态',
          });
        }
        delivery.status = 'DELIVERED';
        delivery.deliveredAt = new Date();
        delivery.signedBy = signedBy?.trim() ?? null;
        order.status = 'COMPLETED';
        await this.finance.createReceivableForCompletedOrder(manager, order);
      } else {
        delivery.status = 'FAILED';
        delivery.remark = reason?.trim() || remark?.trim() || delivery.remark;
      }
      delivery.remark = remark?.trim() ?? delivery.remark;
      await manager.getRepository(DeliveryEntity).save(delivery);
      await manager.getRepository(OrderEntity).save(order);
      await manager.getRepository(DeliveryLogEntity).save({
        tenantId: order.tenantId,
        deliveryId: delivery.id,
        orderId: order.id,
        deliveryPersonId: principal.userId ?? delivery.deliveryPersonId,
        status,
        reasonCode: status === 'FAILED' ? reasonCode ?? 'OTHER' : null,
        reason: status === 'FAILED' ? reason?.trim() ?? null : remark?.trim() ?? null,
      });
      if (status !== 'FAILED') {
        await manager.getRepository(OrderStatusLogEntity).save({
          tenantId: order.tenantId,
          orderId: order.id,
          fromStatus,
          toStatus: order.status,
          action: status === 'DELIVERING' ? 'DELIVERY_START' : 'DELIVERY_COMPLETE',
          operatorType: 'EMPLOYEE',
          operatorId: principal.userId,
          remark: remark?.trim() ?? null,
        });
      }
    });
    return this.detail(principal, id);
  }

  private async lockDelivery(
    manager: EntityManager,
    tenantId: string,
    id: string,
  ) {
    const delivery = await manager
      .getRepository(DeliveryEntity)
      .createQueryBuilder('delivery')
      .setLock('pessimistic_write')
      .where('delivery.id = :id', { id })
      .andWhere('delivery.tenant_id = :tenantId', { tenantId })
      .getOne();
    if (!delivery) throw this.notFound();
    return delivery;
  }

  private assertScope(principal: AuthPrincipal, delivery: DeliveryEntity) {
    if (
      principal.roleCode === 'DELIVERY' &&
      delivery.deliveryPersonId !== principal.userId
    ) {
      throw new ForbiddenException({
        code: 'DELIVERY_SCOPE_FORBIDDEN',
        message: '不能访问其他配送员的任务',
      });
    }
  }

  private view(delivery: DeliveryEntity, detailed = false) {
    return {
      id: delivery.id,
      delivery_no: delivery.deliveryNo,
      order_id: delivery.orderId,
      order_no: delivery.order?.orderNo,
      delivery_person_id: delivery.deliveryPersonId,
      delivery_person_name: delivery.deliveryPerson?.name,
      customer_name: delivery.customerName,
      phone: delivery.phone,
      address: delivery.address,
      status: delivery.status,
      order_amount: delivery.order?.finalAmount ?? delivery.order?.estimatedAmount,
      item_count: Number(
        (delivery.order as (OrderEntity & { itemCount?: number }) | undefined)
          ?.itemCount ?? delivery.order?.items?.length ?? 0,
      ),
      assigned_at: delivery.assignedAt,
      started_at: delivery.startedAt,
      delivered_at: delivery.deliveredAt,
      signed_by: delivery.signedBy,
      remark: delivery.remark,
      logs: (delivery.logs ?? []).map((log) => ({
        id: log.id,
        status: log.status,
        reason_code: log.reasonCode,
        reason: log.reason,
        created_at: log.createdAt,
      })),
      ...(detailed
        ? {
            items: (delivery.order?.items ?? []).map((item) => ({
              product_name: item.productName,
              sku_name: item.skuName,
              sale_type: item.saleType,
              actual_quantity: item.actualQuantity,
              actual_weight: item.actualWeight,
              unit: item.saleType === 'PIECE' ? item.pieceUnit : item.weightUnit,
            })),
          }
        : {}),
    };
  }

  private generateDeliveryNo() {
    return `PS${Date.now()}${randomInt(1000, 10_000)}`;
  }

  private notFound() {
    return new NotFoundException({
      code: 'DELIVERY_NOT_FOUND',
      message: '配送任务不存在',
    });
  }
}
