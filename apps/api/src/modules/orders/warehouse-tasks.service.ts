import { randomInt } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import type { AuthPrincipal } from '../auth/types/auth-principal';
import { UserEntity } from '../users/entities/user.entities';
import type { CompletePickingItemDto } from './dto/warehouse-task.dto';
import {
  OrderEntity,
  OrderItemEntity,
  OrderStatusLogEntity,
} from './entities/order.entities';
import {
  PickingTaskEntity,
  PickingTaskItemEntity,
  ShippingPackageEntity,
} from './entities/warehouse-task.entities';

@Injectable()
export class WarehouseTasksService {
  constructor(private readonly dataSource: DataSource) {}

  async createForApprovedOrder(manager: EntityManager, order: OrderEntity) {
    const tasks = manager.getRepository(PickingTaskEntity);
    const existing = await tasks.findOneBy({ orderId: order.id });
    if (existing) return existing;
    const task = await tasks.save({
      tenantId: order.tenantId,
      orderId: order.id,
      warehouseId: order.warehouseId,
      pickerId: null,
      status: 'WAITING',
    });
    const orderItems = await manager.getRepository(OrderItemEntity).findBy({
      tenantId: order.tenantId,
      orderId: order.id,
    });
    await manager.getRepository(PickingTaskItemEntity).save(
      orderItems.map((item) => ({
        tenantId: order.tenantId,
        taskId: task.id,
        orderItemId: item.id,
        skuId: item.skuId,
        plannedQuantity: item.plannedQuantity ?? '0.000',
        pickedQuantity: null,
        status: 'WAITING' as const,
      })),
    );
    return task;
  }

  async list(
    principal: AuthPrincipal,
    query: { stage?: string; page: number; page_size: number },
  ) {
    const builder = this.dataSource
      .getRepository(OrderEntity)
      .createQueryBuilder('orders')
      .leftJoinAndSelect('orders.customer', 'customer')
      .leftJoinAndSelect('orders.pickingTask', 'task')
      .leftJoinAndSelect('orders.shippingPackage', 'shipment')
      .leftJoinAndSelect('orders.delivery', 'delivery')
      .loadRelationCountAndMap('orders.itemCount', 'orders.items')
      .where('orders.tenant_id = :tenantId', { tenantId: principal.tenantId })
      .andWhere("orders.status <> 'CANCELLED'");
    if (principal.roleCode === 'WAREHOUSE') {
      const user = await this.dataSource.getRepository(UserEntity).findOneBy({
        id: principal.userId ?? '',
        tenantId: principal.tenantId,
      });
      if (!user?.warehouseId) throw this.scopeError();
      builder.andWhere('orders.warehouse_id = :warehouseId', {
        warehouseId: user.warehouseId,
      });
    }
    this.applyStage(builder, query.stage);
    const [orders, total] = await builder
      .orderBy('orders.id', 'DESC')
      .skip((query.page - 1) * query.page_size)
      .take(query.page_size)
      .getManyAndCount();
    return {
      items: orders.map((order) => this.summary(order)),
      pagination: {
        page: query.page,
        page_size: query.page_size,
        total,
        total_pages: Math.ceil(total / query.page_size),
      },
    };
  }

  async detail(principal: AuthPrincipal, orderId: string) {
    const order = await this.dataSource.getRepository(OrderEntity).findOne({
      where: { id: orderId, tenantId: principal.tenantId },
      relations: {
        customer: true,
        pickingTask: { items: { orderItem: true } },
        shippingPackage: true,
        delivery: true,
      },
    });
    if (!order) throw this.notFound();
    await this.assertScope(principal, order.warehouseId);
    return {
      ...this.summary(order),
      picking_task: order.pickingTask
        ? {
            id: order.pickingTask.id,
            picker_id: order.pickingTask.pickerId,
            status: order.pickingTask.status,
            started_at: order.pickingTask.startedAt,
            completed_at: order.pickingTask.completedAt,
            items: order.pickingTask.items.map((item) => ({
              id: item.id,
              order_item_id: item.orderItemId,
              sku_id: item.skuId,
              product_name: item.orderItem.productName,
              sku_name: item.orderItem.skuName,
              sale_type: item.orderItem.saleType,
              unit: item.orderItem.pieceUnit,
              planned_quantity: item.plannedQuantity,
              picked_quantity: item.pickedQuantity,
              status: item.status,
            })),
          }
        : null,
    };
  }

  async startPicking(principal: AuthPrincipal, orderId: string) {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, principal, orderId);
      if (order.status !== 'APPROVED') {
        throw this.statusError('只有审核通过的订单可以开始拣货');
      }
      const task = await manager.getRepository(PickingTaskEntity)
        .createQueryBuilder('task')
        .setLock('pessimistic_write')
        .where('task.order_id = :orderId', { orderId })
        .getOne();
      if (!task || task.status !== 'WAITING') {
        throw this.statusError('拣货任务不存在或已经开始');
      }
      task.status = 'PICKING';
      task.pickerId = principal.userId ?? null;
      task.startedAt = new Date();
      order.status = 'PICKING';
      await manager.getRepository(PickingTaskEntity).save(task);
      await manager.getRepository(OrderEntity).save(order);
      await this.log(manager, order, 'APPROVED', 'PICKING', 'PICKING_START', principal);
    });
    return this.detail(principal, orderId);
  }

  async completePicking(
    principal: AuthPrincipal,
    orderId: string,
    input: CompletePickingItemDto[],
  ) {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, principal, orderId);
      if (order.status !== 'PICKING') {
        throw this.statusError('只有拣货中的订单可以确认拣货');
      }
      const task = await manager.getRepository(PickingTaskEntity).findOne({
        where: { orderId, tenantId: principal.tenantId },
        relations: { items: { orderItem: true } },
      });
      if (!task || task.status !== 'PICKING') {
        throw this.statusError('拣货任务状态不正确');
      }
      const picked = new Map(input.map((item) => [item.task_item_id, item.picked_quantity]));
      if (picked.size !== input.length || task.items.length !== input.length) {
        throw new BadRequestException({
          code: 'PICKING_ITEMS_INCOMPLETE',
          message: '必须一次确认全部拣货明细',
        });
      }
      for (const item of task.items) {
        const quantity = picked.get(item.id);
        if (quantity === undefined) {
          throw new BadRequestException({
            code: 'PICKING_ITEMS_INCOMPLETE',
            message: '拣货明细不完整',
          });
        }
        if (Math.abs(quantity - Number(item.plannedQuantity)) > 0.0001) {
          throw new BadRequestException({
            code: 'PICKING_QUANTITY_MISMATCH',
            message: `${item.orderItem.productName}拣货数量必须与订单数量一致`,
          });
        }
        item.pickedQuantity = quantity.toFixed(3);
        item.status = 'DONE';
      }
      task.status = 'DONE';
      task.completedAt = new Date();
      const hasWeight = task.items.some((item) => item.orderItem.saleType === 'WEIGHT');
      const fromStatus = order.status;
      if (hasWeight) order.status = 'WEIGHING';
      await manager.getRepository(PickingTaskItemEntity).save(task.items);
      await manager.getRepository(PickingTaskEntity).save(task);
      await manager.getRepository(OrderEntity).save(order);
      await this.log(
        manager,
        order,
        fromStatus,
        order.status,
        'PICKING_COMPLETE',
        principal,
      );
    });
    return this.detail(principal, orderId);
  }

  async createPackage(manager: EntityManager, order: OrderEntity) {
    const packages = manager.getRepository(ShippingPackageEntity);
    const existing = await packages.findOneBy({ orderId: order.id });
    if (existing) return existing;
    return packages.save({
      tenantId: order.tenantId,
      orderId: order.id,
      packageNo: `PK${Date.now()}${randomInt(1000, 10_000)}`,
      status: 'WAITING',
    });
  }

  async updatePackage(
    principal: AuthPrincipal,
    orderId: string,
    action: 'START' | 'COMPLETE' | 'OUTBOUND',
  ) {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, principal, orderId);
      if (order.status !== 'WAITING_DELIVERY') {
        throw this.statusError('只有仓库履约完成的订单可以打包出库');
      }
      const shipment = await manager.getRepository(ShippingPackageEntity)
        .createQueryBuilder('shipment')
        .setLock('pessimistic_write')
        .where('shipment.order_id = :orderId', { orderId })
        .getOne();
      if (!shipment) throw this.statusError('未生成打包任务');
      if (action === 'START') {
        if (shipment.status !== 'WAITING') throw this.statusError('打包任务已经开始');
        shipment.status = 'PACKING';
        shipment.packerId = principal.userId ?? null;
        shipment.startedAt = new Date();
      } else if (action === 'COMPLETE') {
        if (shipment.status !== 'PACKING') throw this.statusError('请先开始打包');
        shipment.status = 'DONE';
        shipment.completedAt = new Date();
      } else {
        if (shipment.status !== 'DONE') throw this.statusError('请先完成打包');
        if (shipment.outboundAt) throw this.statusError('订单已经出库');
        shipment.outboundBy = principal.userId ?? null;
        shipment.outboundAt = new Date();
      }
      await manager.getRepository(ShippingPackageEntity).save(shipment);
      await this.log(
        manager,
        order,
        order.status,
        order.status,
        `PACKAGE_${action}`,
        principal,
      );
    });
    return this.detail(principal, orderId);
  }

  private summary(order: OrderEntity) {
    const itemCount = Number(
      (order as OrderEntity & { itemCount?: number }).itemCount ?? 0,
    );
    return {
      order_id: order.id,
      order_no: order.orderNo,
      customer_name: order.customer?.customerName,
      item_count: itemCount || order.pickingTask?.items?.length || 0,
      order_amount: order.finalAmount ?? order.estimatedAmount,
      order_status: order.status,
      stage: this.stage(order),
      picking_status: order.pickingTask?.status ?? null,
      package: order.shippingPackage
        ? {
            id: order.shippingPackage.id,
            package_no: order.shippingPackage.packageNo,
            status: order.shippingPackage.status,
            outbound_at: order.shippingPackage.outboundAt,
          }
        : null,
      delivery_status: order.delivery?.status ?? null,
      created_at: order.createdAt,
    };
  }

  private stage(order: OrderEntity) {
    if (order.status === 'WAITING_REVIEW') return 'WAITING_REVIEW';
    if (order.status === 'APPROVED') return 'WAITING_PICKING';
    if (order.pickingTask?.status === 'PICKING') return 'PICKING';
    if (
      order.status === 'WEIGHING' ||
      (order.status === 'PICKING' && order.pickingTask?.status === 'DONE')
    ) return 'WAITING_WEIGHING';
    if (
      order.status === 'WAITING_DELIVERY' &&
      !order.shippingPackage?.outboundAt
    ) return 'WAITING_OUTBOUND';
    if (order.status === 'DELIVERING') return 'DELIVERING';
    if (order.status === 'COMPLETED') return 'COMPLETED';
    return order.status;
  }

  private applyStage(builder: any, stage?: string) {
    if (!stage) return;
    const expressions: Record<string, string> = {
      WAITING_REVIEW: "orders.status = 'WAITING_REVIEW'",
      WAITING_PICKING: "orders.status = 'APPROVED'",
      PICKING: "task.status = 'PICKING'",
      WAITING_WEIGHING: "orders.status = 'WEIGHING'",
      WAITING_OUTBOUND:
        "orders.status = 'WAITING_DELIVERY' AND shipment.outbound_at IS NULL",
      DELIVERING: "orders.status = 'DELIVERING'",
      COMPLETED: "orders.status = 'COMPLETED'",
    };
    if (expressions[stage]) builder.andWhere(expressions[stage]);
  }

  private async lockOrder(
    manager: EntityManager,
    principal: AuthPrincipal,
    orderId: string,
  ) {
    const order = await manager.getRepository(OrderEntity)
      .createQueryBuilder('orders')
      .setLock('pessimistic_write')
      .where('orders.id = :orderId', { orderId })
      .andWhere('orders.tenant_id = :tenantId', { tenantId: principal.tenantId })
      .getOne();
    if (!order) throw this.notFound();
    await this.assertScope(principal, order.warehouseId, manager);
    return order;
  }

  private async assertScope(
    principal: AuthPrincipal,
    warehouseId: string,
    manager?: EntityManager,
  ) {
    if (principal.roleCode !== 'WAREHOUSE') return;
    const users = manager?.getRepository(UserEntity) ??
      this.dataSource.getRepository(UserEntity);
    const user = await users.findOneBy({
      id: principal.userId ?? '',
      tenantId: principal.tenantId,
    });
    if (!user || user.warehouseId !== warehouseId) throw this.scopeError();
  }

  private async log(
    manager: EntityManager,
    order: OrderEntity,
    fromStatus: OrderEntity['status'],
    toStatus: OrderEntity['status'],
    action: string,
    principal: AuthPrincipal,
  ) {
    await manager.getRepository(OrderStatusLogEntity).save({
      tenantId: order.tenantId,
      orderId: order.id,
      fromStatus,
      toStatus,
      action,
      operatorType: 'EMPLOYEE',
      operatorId: principal.userId,
      remark: null,
    });
  }

  private statusError(message: string) {
    return new BadRequestException({ code: 'WAREHOUSE_TASK_STATUS_INVALID', message });
  }
  private notFound() {
    return new NotFoundException({
      code: 'WAREHOUSE_TASK_NOT_FOUND',
      message: '仓库任务不存在',
    });
  }
  private scopeError() {
    return new ForbiddenException({
      code: 'WAREHOUSE_SCOPE_FORBIDDEN',
      message: '不能处理其他仓库的任务',
    });
  }
}
