import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import type { AuthPrincipal } from '../auth/types/auth-principal';
import { CouponsService, type CouponAmountItem } from '../coupons/coupons.service';
import { CustomerEntity } from '../customers/entities/customer.entities';
import { DeliveriesService } from '../deliveries/deliveries.service';
import {
  InventoryEntity,
  InventoryLogEntity,
} from '../inventory/entities/inventory.entities';
import { PriceService } from '../products/price.service';
import { ShippingService } from '../shipping/shipping.service';
import { UserEntity } from '../users/entities/user.entities';
import type { WeightItemDto } from './dto/fulfillment.dto';
import {
  OrderEntity,
  OrderItemEntity,
  OrderStatusLogEntity,
} from './entities/order.entities';
import { centsToAmount, multiplyPriceToCents } from './money';
import { PickingTaskEntity } from './entities/warehouse-task.entities';
import { WarehouseTasksService } from './warehouse-tasks.service';

@Injectable()
export class FulfillmentService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly prices: PriceService,
    private readonly coupons: CouponsService,
    private readonly shipping: ShippingService,
    private readonly deliveries: DeliveriesService,
    private readonly warehouseTasks: WarehouseTasksService,
  ) {}

  async startPicking(principal: AuthPrincipal, orderId: string) {
    return this.warehouseTasks.startPicking(principal, orderId);
  }

  async completeWeighing(
    principal: AuthPrincipal,
    orderId: string,
    weights: WeightItemDto[],
  ) {
    return this.finalize(principal, orderId, weights);
  }

  async completePieceOrder(principal: AuthPrincipal, orderId: string) {
    return this.finalize(principal, orderId, []);
  }

  private async finalize(
    principal: AuthPrincipal,
    orderId: string,
    weights: WeightItemDto[],
  ) {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, principal, orderId);
      if (!['PICKING', 'WEIGHING'].includes(order.status)) {
        throw this.statusError('只有拣货中或称重中的订单可以完成履约');
      }
      const pickingTask = await manager.getRepository(PickingTaskEntity)
        .findOneBy({ orderId: order.id, tenantId: order.tenantId });
      if (!pickingTask || pickingTask.status !== 'DONE') {
        throw new BadRequestException({
          code: 'PICKING_NOT_COMPLETED',
          message: '请先完成全部商品拣货',
        });
      }
      const items = await manager
        .getRepository(OrderItemEntity)
        .createQueryBuilder('item')
        .innerJoinAndSelect('item.sku', 'sku')
        .innerJoinAndSelect('sku.product', 'product')
        .setLock('pessimistic_write')
        .where('item.order_id = :orderId', { orderId: order.id })
        .orderBy('item.sku_id', 'ASC')
        .getMany();
      const weightItems = items.filter((item) => item.saleType === 'WEIGHT');
      const weightMap = new Map(
        weights.map((item) => [
          item.order_item_id,
          {
            gross: item.actual_gross_weight ?? item.actual_weight,
            net: item.actual_net_weight ?? item.actual_gross_weight ?? item.actual_weight,
          },
        ]),
      );
      if (weightItems.length === 0 && weights.length > 0) {
        throw new BadRequestException({
          code: 'PIECE_ITEM_WEIGHING_FORBIDDEN',
          message: '按件订单禁止调用称重接口',
        });
      }
      if (weightMap.size !== weights.length) {
        throw new BadRequestException({
          code: 'DUPLICATE_WEIGHT_ITEM',
          message: '称重明细不能重复',
        });
      }
      if (
        weightItems.length !== weights.length ||
        weightItems.some((item) => !weightMap.has(item.id))
      ) {
        throw new BadRequestException({
          code: 'WEIGHT_ITEMS_INCOMPLETE',
          message: '必须一次提交订单中全部称重商品的实际重量',
        });
      }
      const fromStatus = order.status;
      let productCents = 0n;
      let actualKilograms = 0;
      const couponItems: CouponAmountItem[] = [];
      for (const item of items) {
        const planned =
          item.saleType === 'PIECE'
            ? Number(item.plannedQuantity)
            : Number(item.plannedWeight);
        const purchasedUnits = Number(item.plannedQuantity);
        const weight = weightMap.get(item.id);
        const actualGross =
          item.saleType === 'PIECE' ? planned : Number(weight?.gross);
        const actualNet =
          item.saleType === 'PIECE' ? planned : Number(weight?.net);
        if (
          !Number.isFinite(actualGross) ||
          actualGross <= 0 ||
          !Number.isFinite(actualNet) ||
          actualNet <= 0 ||
          actualNet > actualGross
        ) {
          throw new BadRequestException({
            code: 'ACTUAL_WEIGHT_INVALID',
            message: `${item.productName} ${item.skuName}毛重/净重无效，且净重不能大于毛重`,
          });
        }
        const finalPrice =
          item.saleType === 'PIECE'
            ? item.unitPrice
            : item.grossWeightUnitPrice;
        if (!finalPrice) {
          throw new BadRequestException({
            code: 'WEIGHT_UNIT_PRICE_REQUIRED',
            message: `${item.productName} ${item.skuName}未配置毛重单价`,
          });
        }
        const lineCents = multiplyPriceToCents(
          finalPrice,
          (item.saleType === 'PIECE' ? purchasedUnits : actualGross).toFixed(3),
        );
        item.actualQuantity = purchasedUnits.toFixed(3);
        item.actualWeight =
          item.saleType === 'WEIGHT' ? actualGross.toFixed(3) : null;
        item.actualGrossWeight =
          item.saleType === 'WEIGHT' ? actualGross.toFixed(3) : null;
        item.actualNetWeight =
          item.saleType === 'WEIGHT' ? actualNet.toFixed(3) : null;
        item.finalUnitPrice = finalPrice;
        item.finalAmount = centsToAmount(lineCents);
        productCents += lineCents;
        couponItems.push({
          productId: item.sku.productId,
          categoryId: item.sku.product.categoryId,
          amount: item.finalAmount,
        });
        actualKilograms += this.deliveryKilograms(item, actualGross);
        await this.fulfillInventory(
          manager,
          order,
          item,
          planned,
          actualGross,
          principal,
        );
      }
      await manager.getRepository(OrderItemEntity).save(items);

      const earlierOrders = await manager
        .getRepository(OrderEntity)
        .createQueryBuilder('earlier')
        .where('earlier.tenant_id = :tenantId', {
          tenantId: order.tenantId,
        })
        .andWhere('earlier.customer_id = :customerId', {
          customerId: order.customerId,
        })
        .andWhere('earlier.id < :orderId', { orderId: order.id })
        .andWhere("earlier.status <> 'CANCELLED'")
        .getCount();
      const discountAmount = await this.coupons.finalizeForOrder({
        manager,
        order,
        items: couponItems,
        isFirstOrder: earlierOrders === 0,
      });
      const shipping = await this.shipping.calculateAndRecord({
        manager,
        order,
        actualKilograms,
      });
      const finalCents =
        productCents +
        BigInt(Math.round(Number(shipping.shippingFee) * 100)) -
        BigInt(Math.round(Number(discountAmount) * 100));
      const customer = await manager.getRepository(CustomerEntity).findOneByOrFail({
        id: order.customerId,
        tenantId: order.tenantId,
      });
      await this.deliveries.createForOrder(manager, order, customer);
      await this.warehouseTasks.createPackage(manager, order);

      order.finalProductAmount = centsToAmount(productCents);
      const adjustmentCents =
        productCents -
        BigInt(Math.round(Number(order.estimatedProductAmount) * 100));
      order.amountAdjustmentType =
        adjustmentCents > 0n
          ? 'SUPPLEMENT'
          : adjustmentCents < 0n
            ? 'REFUND'
            : 'NONE';
      order.amountAdjustment = centsToAmount(
        adjustmentCents < 0n ? -adjustmentCents : adjustmentCents,
      );
      order.discountAmount = discountAmount;
      order.shippingFee = shipping.shippingFee;
      order.actualWeight = actualKilograms.toFixed(3);
      order.weightUnit = '公斤';
      order.shippingStatus = 'COMPLETED';
      order.finalAmount = centsToAmount(finalCents < 0n ? 0n : finalCents);
      order.status = 'WAITING_DELIVERY';
      await manager.getRepository(OrderEntity).save(order);
      await this.log(
        manager,
        order,
        fromStatus,
        'WAITING_DELIVERY',
        weightItems.length ? 'WEIGHING_COMPLETE' : 'PIECE_FULFILLMENT_COMPLETE',
        principal,
      );
    });
    return { id: orderId, status: 'WAITING_DELIVERY' };
  }

  private async fulfillInventory(
    manager: EntityManager,
    order: OrderEntity,
    item: OrderItemEntity,
    planned: number,
    actual: number,
    principal: AuthPrincipal,
  ) {
    const inventory = await manager
      .getRepository(InventoryEntity)
      .createQueryBuilder('inventory')
      .setLock('pessimistic_write')
      .where('inventory.tenant_id = :tenantId', { tenantId: order.tenantId })
      .andWhere('inventory.warehouse_id = :warehouseId', {
        warehouseId: order.warehouseId,
      })
      .andWhere('inventory.sku_id = :skuId', { skuId: item.skuId })
      .getOne();
    if (
      !inventory ||
      Number(inventory.lockedQuantity) < planned ||
      Number(inventory.availableQuantity) + planned < actual
    ) {
      throw new BadRequestException({
        code: 'FULFILLMENT_STOCK_INSUFFICIENT',
        message: `${item.productName} ${item.skuName}履约库存不足`,
      });
    }
    const beforeStock = Number(inventory.stockQuantity);
    const beforeLocked = Number(inventory.lockedQuantity);
    const afterStock = beforeStock - actual;
    const afterLocked = beforeLocked - planned;
    inventory.stockQuantity = afterStock.toFixed(3);
    inventory.lockedQuantity = afterLocked.toFixed(3);
    inventory.version += 1;
    await manager.getRepository(InventoryEntity).save(inventory);
    await manager.getRepository(InventoryLogEntity).save({
      tenantId: order.tenantId,
      inventoryId: inventory.id,
      warehouseId: inventory.warehouseId,
      skuId: item.skuId,
      operationType: 'ORDER_FULFILL',
      changeQuantity: (-actual).toFixed(3),
      lockedChangeQuantity: (-planned).toFixed(3),
      beforeQuantity: beforeStock.toFixed(3),
      afterQuantity: afterStock.toFixed(3),
      beforeLockedQuantity: beforeLocked.toFixed(3),
      afterLockedQuantity: afterLocked.toFixed(3),
      stockUnit: inventory.stockUnit,
      reason: `订单${order.orderNo}仓库履约出库`,
      referenceType: 'ORDER',
      referenceId: order.id,
      operatorType: 'EMPLOYEE',
      operatorId: principal.userId,
    });
  }

  private deliveryKilograms(item: OrderItemEntity, actual: number): number {
    if (item.saleType === 'WEIGHT') {
      return this.toKilograms(actual, item.weightUnit ?? '');
    }
    const weight = Number(item.sku.deliveryWeightPerPiece);
    if (
      !Number.isFinite(weight) ||
      weight <= 0 ||
      !item.sku.deliveryWeightUnit
    ) {
      throw new BadRequestException({
        code: 'SKU_DELIVERY_WEIGHT_REQUIRED',
        message: `${item.productName} ${item.skuName}未配置单件配送重量`,
      });
    }
    return this.toKilograms(
      weight * actual,
      item.sku.deliveryWeightUnit,
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

  private async lockOrder(
    manager: EntityManager,
    principal: AuthPrincipal,
    orderId: string,
  ) {
    const order = await manager
      .getRepository(OrderEntity)
      .createQueryBuilder('orders')
      .setLock('pessimistic_write')
      .where('orders.id = :orderId', { orderId })
      .andWhere('orders.tenant_id = :tenantId', {
        tenantId: principal.tenantId,
      })
      .getOne();
    if (!order) {
      throw new BadRequestException({
        code: 'ORDER_NOT_FOUND',
        message: '订单不存在',
      });
    }
    if (principal.roleCode !== 'ADMIN') {
      const user = await manager.getRepository(UserEntity).findOneBy({
        id: principal.userId ?? '',
        tenantId: principal.tenantId,
      });
      if (!user || user.warehouseId !== order.warehouseId) {
        throw new BadRequestException({
          code: 'WAREHOUSE_SCOPE_FORBIDDEN',
          message: '不能处理其他仓库的订单',
        });
      }
    }
    return order;
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
    return new BadRequestException({
      code: 'ORDER_STATUS_INVALID',
      message,
    });
  }
}
