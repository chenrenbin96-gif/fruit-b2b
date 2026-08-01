import { randomInt } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import {
  Brackets,
  DataSource,
  EntityManager,
  In,
  QueryFailedError,
  Repository,
} from 'typeorm';

import type { AuthPrincipal } from '../auth/types/auth-principal';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.constants';
import {
  CouponsService,
  type CouponAmountItem,
} from '../coupons/coupons.service';
import { CustomerEntity } from '../customers/entities/customer.entities';
import { FinanceService } from '../finance/finance.service';
import {
  InventoryEntity,
  InventoryLogEntity,
} from '../inventory/entities/inventory.entities';
import { PriceService } from '../products/price.service';
import { SkuEntity } from '../products/entities/product.entities';
import { ShippingService } from '../shipping/shipping.service';
import { WarehouseEntity } from '../system/entities/system.entities';
import { UserEntity } from '../users/entities/user.entities';
import {
  AdminOrderListQueryDto,
  CustomerOrderListQueryDto,
  SubmitCartDto,
} from './dto/order.dto';
import {
  OrderEntity,
  OrderItemEntity,
  OrderStatusLogEntity,
  PurchaseCartEntity,
  PurchaseCartItemEntity,
  type OrderStatus,
} from './entities/order.entities';
import { centsToAmount, multiplyPriceToCents } from './money';
import { OrderPolicyService } from './order-policy.service';
import { WarehouseTasksService } from './warehouse-tasks.service';

type PreparedItem = {
  cartItem: PurchaseCartItemEntity;
  sku: SkuEntity;
  requested: string;
  stockRequested: string;
  unitPrice: string;
  estimatedAmount: string;
  inventory: InventoryEntity;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    private readonly prices: PriceService,
    private readonly policy: OrderPolicyService,
    private readonly coupons: CouponsService,
    private readonly finance: FinanceService,
    private readonly shipping: ShippingService,
    private readonly warehouseTasks: WarehouseTasksService,
  ) {}

  async submitCart(
    principal: AuthPrincipal,
    dto: SubmitCartDto,
    idempotencyKey?: string,
  ) {
    const idempotency = await this.beginIdempotentSubmission(
      principal,
      idempotencyKey,
    );
    if (idempotency.cachedOrderId) {
      return this.customerDetail(
        principal.tenantId,
        principal.customerId ?? '',
        idempotency.cachedOrderId,
      );
    }

    try {
      const result = await this.submitCartOnce(principal, dto);
      if (idempotency.resultKey) {
        try {
          await this.redis.set(
            idempotency.resultKey,
            result.id,
            'EX',
            24 * 60 * 60,
          );
        } catch {
          // The committed database transaction remains authoritative.
        }
      }
      return result;
    } finally {
      if (idempotency.lockKey) {
        try {
          await this.redis.del(idempotency.lockKey);
        } catch {
          // The lock has a short TTL and will expire without manual cleanup.
        }
      }
    }
  }

  private async submitCartOnce(
    principal: AuthPrincipal,
    dto: SubmitCartDto,
  ) {
    const orderId = await this.withTransactionRetry(async (manager) => {
      const customer = await manager
        .getRepository(CustomerEntity)
        .createQueryBuilder('customer')
        .setLock('pessimistic_write')
        .where('customer.id = :id', { id: principal.customerId })
        .andWhere('customer.tenant_id = :tenantId', {
          tenantId: principal.tenantId,
        })
        .andWhere("customer.status = 'ACTIVE'")
        .getOne();
      if (!customer) {
        throw new BadRequestException({
          code: 'CUSTOMER_NOT_AVAILABLE',
          message: '客户不存在或已停用',
        });
      }

      const cart = await manager
        .getRepository(PurchaseCartEntity)
        .createQueryBuilder('cart')
        .setLock('pessimistic_write')
        .where('cart.tenant_id = :tenantId', {
          tenantId: principal.tenantId,
        })
        .andWhere('cart.customer_id = :customerId', {
          customerId: customer.id,
        })
        .andWhere("cart.status = 'ACTIVE'")
        .getOne();
      if (!cart) {
        throw new BadRequestException({
          code: 'PURCHASE_CART_NOT_FOUND',
          message: '采购单不存在或已经提交',
        });
      }

      const cartItems = await manager
        .getRepository(PurchaseCartItemEntity)
        .createQueryBuilder('item')
        .innerJoinAndSelect('item.sku', 'sku')
        .innerJoinAndSelect('sku.product', 'product')
        .setLock('pessimistic_write')
        .where('item.cart_id = :cartId', { cartId: cart.id })
        .orderBy('item.sku_id', 'ASC')
        .getMany();
      if (cartItems.length === 0) {
        throw new BadRequestException({
          code: 'PURCHASE_CART_EMPTY',
          message: '采购单为空，不能提交',
        });
      }

      const warehouse = await manager.getRepository(WarehouseEntity).findOne({
        where: { tenantId: principal.tenantId, status: 'ACTIVE' },
        order: { id: 'ASC' },
      });
      if (!warehouse) {
        throw new BadRequestException({
          code: 'WAREHOUSE_NOT_CONFIGURED',
          message: '当前租户未配置可用仓库',
        });
      }

      let totalCents = 0n;
      let estimatedKilograms = 0;
      const prepared: PreparedItem[] = [];
      for (const cartItem of cartItems) {
        const sku = cartItem.sku;
        if (sku.status !== 'ACTIVE' || sku.product.status !== 'ON_SALE') {
          throw new BadRequestException({
            code: 'SKU_NOT_PURCHASABLE',
            message: `${sku.product.name} ${sku.skuName} 已下架`,
          });
        }
        const requested = cartItem.quantity;
        if (!requested || Number(requested) <= 0) {
          throw new BadRequestException({
            code: 'PURCHASE_CART_QUANTITY_INVALID',
            message: `${sku.skuName} 的采购数量无效`,
          });
        }
        const price = await this.prices.calculateSkuPrice({
          tenantId: principal.tenantId,
          customerId: customer.id,
          skuId: sku.id,
          purchaseQuantity: Number(requested),
          manager,
        });
        const lineCents = multiplyPriceToCents(
          price.final_unit_price,
          requested,
        );
        totalCents += lineCents;
        estimatedKilograms += this.deliveryKilograms(
          sku,
          Number(requested),
        );
        const stockRequested =
          sku.saleType === 'WEIGHT'
            ? (Number(sku.standardWeight) * Number(requested)).toFixed(3)
            : Number(requested).toFixed(3);

        const inventory = await manager
          .getRepository(InventoryEntity)
          .createQueryBuilder('inventory')
          .setLock('pessimistic_write')
          .where('inventory.tenant_id = :tenantId', {
            tenantId: principal.tenantId,
          })
          .andWhere('inventory.warehouse_id = :warehouseId', {
            warehouseId: warehouse.id,
          })
          .andWhere('inventory.sku_id = :skuId', { skuId: sku.id })
          .getOne();
        if (
          !inventory ||
          Number(inventory.availableQuantity) < Number(stockRequested)
        ) {
          throw new BadRequestException({
            code: 'INSUFFICIENT_AVAILABLE_STOCK',
            message: `${sku.product.name} ${sku.skuName} 可售库存不足`,
            details: {
              sku_id: sku.id,
              requested: stockRequested,
              available: inventory?.availableQuantity ?? '0.000',
              stock_unit: sku.stockUnit,
            },
          });
        }
        prepared.push({
          cartItem,
          sku,
          requested,
          stockRequested,
          unitPrice: price.final_unit_price,
          estimatedAmount: centsToAmount(lineCents),
          inventory,
        });
      }

      const estimatedAmount = centsToAmount(totalCents);
      const firstOrderCheck = await this.policy.firstOrderCheck({
        tenantId: principal.tenantId,
        customerId: customer.id,
        estimatedAmount,
        manager,
      });
      if (!firstOrderCheck.passed) {
        throw new BadRequestException({
          code: 'FIRST_ORDER_AMOUNT_NOT_REACHED',
          message: '首单最低采购金额不足',
          details: firstOrderCheck,
        });
      }
      const deliveryMinimumCheck =
        await this.shipping.deliveryMinimumCheck({
          tenantId: principal.tenantId,
          customerId: customer.id,
          productAmount: estimatedAmount,
          manager,
        });
      if (!deliveryMinimumCheck.passed) {
        throw new BadRequestException({
          code: 'DELIVERY_MIN_AMOUNT_NOT_REACHED',
          message: `本订单未达到${Number(deliveryMinimumCheck.required_min_amount)}元起送金额，还差${Number(deliveryMinimumCheck.shortfall_amount)}元`,
          details: deliveryMinimumCheck,
        });
      }

      const orderRepository = manager.getRepository(OrderEntity);
      const order = await orderRepository.save(orderRepository.create({
        tenantId: principal.tenantId,
        orderNo: this.generateOrderNo(),
        sourceCartId: cart.id,
        customerId: customer.id,
        warehouseId: warehouse.id,
        estimatedProductAmount: estimatedAmount,
        estimatedDiscountAmount: '0.00',
        estimatedAmount,
        finalProductAmount: null,
        finalAmount: null,
        amountAdjustmentType: 'NONE',
        amountAdjustment: '0.00',
        discountAmount: '0.00',
        shippingFee: '0.00',
        estimatedWeight:
          estimatedKilograms > 0 ? estimatedKilograms.toFixed(3) : null,
        actualWeight: null,
        weightUnit: '公斤',
        shippingStatus: 'WAITING',
        couponId: null,
        customerCouponId: null,
        deliveryRegionId: deliveryMinimumCheck.delivery_region_id,
        status: 'WAITING_REVIEW',
        remark: dto.remark?.trim() ?? null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      }));

      for (const item of prepared) {
        await manager.getRepository(OrderItemEntity).save({
          tenantId: principal.tenantId,
          orderId: order.id,
          skuId: item.sku.id,
          productName: item.sku.product.name,
          skuName: item.sku.skuName,
          specification: item.sku.specification,
          saleType: item.sku.saleType,
          plannedQuantity:
            item.requested,
          plannedWeight:
            item.sku.saleType === 'WEIGHT' ? item.stockRequested : null,
          actualQuantity: null,
          actualWeight: null,
          actualGrossWeight: null,
          actualNetWeight: null,
          pieceUnit: item.sku.pieceUnit,
          weightUnit: item.sku.weightUnit,
          stockUnit: item.sku.stockUnit,
          priceUnit: item.sku.priceUnit,
          unitPrice: item.unitPrice,
          finalUnitPrice: null,
          grossWeightUnitPrice: item.sku.grossWeightUnitPrice,
          netWeightUnitPrice: item.sku.netWeightUnitPrice,
          estimatedAmount: item.estimatedAmount,
          finalAmount: null,
        });
        await this.changeLockedInventory({
          manager,
          inventory: item.inventory,
          quantity: Number(item.stockRequested),
          direction: 'LOCK',
          orderId: order.id,
          operatorType: 'CUSTOMER_ACCOUNT',
          operatorId: principal.customerAccountId,
          reason: `订单${order.orderNo}提交锁定库存`,
        });
      }

      if (dto.customer_coupon_id) {
        const couponItems: CouponAmountItem[] = prepared.map((item) => ({
          productId: item.sku.productId,
          categoryId: item.sku.product.categoryId,
          amount: item.estimatedAmount,
        }));
        const lockedCoupon = await this.coupons.lockForOrder({
          manager,
          tenantId: principal.tenantId,
          customerId: customer.id,
          customerCouponId: dto.customer_coupon_id,
          orderId: order.id,
          isFirstOrder: firstOrderCheck.is_first_order,
          items: couponItems,
        });
        order.couponId = lockedCoupon.couponId;
        order.customerCouponId = dto.customer_coupon_id;
        order.estimatedDiscountAmount = lockedCoupon.discountAmount;
        order.discountAmount = lockedCoupon.discountAmount;
      }

      const estimatedShipping = await this.shipping.calculateEstimateAndRecord({
        manager,
        order,
        estimatedKilograms,
      });
      order.shippingFee = estimatedShipping.shippingFee;
      order.shippingStatus = 'PENDING_CALCULATION';
      order.estimatedAmount = Math.max(
        0,
        Number(estimatedAmount) +
          Number(estimatedShipping.shippingFee) -
          Number(order.estimatedDiscountAmount),
      ).toFixed(2);
      await manager.getRepository(OrderEntity).save(order);

      await this.finance.assertCreditAvailable(
        manager,
        customer,
        order.estimatedAmount,
      );

      await manager.getRepository(OrderStatusLogEntity).save({
        tenantId: principal.tenantId,
        orderId: order.id,
        fromStatus: 'CREATED',
        toStatus: 'WAITING_REVIEW',
        action: 'SUBMIT',
        operatorType: 'CUSTOMER_ACCOUNT',
        operatorId: principal.customerAccountId,
        remark: '客户提交采购单',
      });
      cart.status = 'SUBMITTED';
      cart.submittedAt = new Date();
      cart.remark = dto.remark?.trim() ?? null;
      await manager.getRepository(PurchaseCartEntity).save(cart);
      return order.id;
    });

    return this.customerDetail(
      principal.tenantId,
      principal.customerId ?? '',
      orderId,
    );
  }

  private async beginIdempotentSubmission(
    principal: AuthPrincipal,
    key?: string,
  ): Promise<{
    cachedOrderId?: string;
    lockKey?: string;
    resultKey?: string;
  }> {
    if (!key) return {};
    const normalized = key.trim();
    if (!/^[A-Za-z0-9:_-]{8,128}$/.test(normalized)) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_INVALID',
        message: 'Idempotency-Key 格式无效',
      });
    }
    const scope = `${principal.tenantId}:${principal.customerId ?? ''}:${normalized}`;
    const resultKey = `idempotency:order-submit:result:${scope}`;
    const lockKey = `idempotency:order-submit:lock:${scope}`;
    try {
      const cachedOrderId = await this.redis.get(resultKey);
      if (cachedOrderId) return { cachedOrderId };
      const acquired = await this.redis.set(lockKey, '1', 'EX', 60, 'NX');
      if (!acquired) {
        const completedOrderId = await this.redis.get(resultKey);
        if (completedOrderId) return { cachedOrderId: completedOrderId };
        throw new ConflictException({
          code: 'REQUEST_IN_PROGRESS',
          message: '订单正在提交，请勿重复操作',
        });
      }
      return { lockKey, resultKey };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      // Redis outage must not stop a transaction-protected order submission.
      return {};
    }
  }

  private async withTransactionRetry<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const maximumAttempts = 5;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
        return await this.dataSource.transaction(work);
      } catch (error) {
        if (!this.isRetryableLockError(error) || attempt === maximumAttempts) {
          throw error;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, 20 * attempt + randomInt(0, 30)),
        );
      }
    }
    throw new Error('Transaction retry loop exhausted');
  }

  private isRetryableLockError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = error.driverError as {
      code?: string;
      errno?: number;
    };
    return (
      driverError.code === 'ER_LOCK_DEADLOCK' ||
      driverError.code === 'ER_LOCK_WAIT_TIMEOUT' ||
      driverError.errno === 1213 ||
      driverError.errno === 1205
    );
  }

  async customerList(
    principal: AuthPrincipal,
    query: CustomerOrderListQueryDto,
  ) {
    const statuses = this.customerGroupStatuses(query.group);
    const [items, total] = await this.orders.findAndCount({
      where: {
        tenantId: principal.tenantId,
        customerId: principal.customerId ?? '',
        ...(statuses ? { status: In(statuses) } : {}),
      },
      relations: { items: true, delivery: true },
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    });
    return this.page(
      items.map((order) => this.orderView(order, false)),
      total,
      query.page,
      query.page_size,
    );
  }

  async customerDetail(
    tenantId: string,
    customerId: string,
    orderId: string,
  ) {
    const order = await this.orders.findOne({
      where: { id: orderId, tenantId, customerId },
      relations: {
        items: true,
        statusLogs: true,
        warehouse: true,
        delivery: { logs: true },
        pickingTask: true,
        shippingPackage: true,
      },
    });
    if (!order) throw this.notFound();
    return this.orderView(order, true);
  }

  async adminList(
    principal: AuthPrincipal,
    query: AdminOrderListQueryDto,
  ) {
    const builder = this.orders
      .createQueryBuilder('orders')
      .leftJoinAndSelect('orders.customer', 'customer')
      .leftJoinAndSelect('orders.warehouse', 'warehouse')
      .leftJoinAndSelect('orders.delivery', 'delivery')
      .where('orders.tenant_id = :tenantId', {
        tenantId: principal.tenantId,
      });
    if (query.status) {
      builder.andWhere('orders.status = :status', { status: query.status });
    }
    if (query.keyword) {
      builder.andWhere(
        new Brackets((where) => {
          where
            .where('orders.order_no LIKE :keyword', {
              keyword: `%${query.keyword}%`,
            })
            .orWhere('customer.customer_name LIKE :keyword', {
              keyword: `%${query.keyword}%`,
            });
        }),
      );
    }
    const [items, total] = await builder
      .orderBy('orders.id', 'DESC')
      .skip((query.page - 1) * query.page_size)
      .take(query.page_size)
      .getManyAndCount();
    return this.page(
      items.map((order) => this.orderView(order, false)),
      total,
      query.page,
      query.page_size,
    );
  }

  async adminDetail(principal: AuthPrincipal, orderId: string) {
    const order = await this.orders.findOne({
      where: { id: orderId, tenantId: principal.tenantId },
      relations: {
        items: true,
        statusLogs: true,
        customer: true,
        warehouse: true,
        delivery: { logs: true },
        pickingTask: true,
        shippingPackage: true,
      },
    });
    if (!order) throw this.notFound();
    return this.orderView(order, true);
  }

  async cancelByCustomer(
    principal: AuthPrincipal,
    orderId: string,
    reason: string,
  ) {
    await this.cancel({
      tenantId: principal.tenantId,
      orderId,
      expectedCustomerId: principal.customerId ?? '',
      operatorType: 'CUSTOMER_ACCOUNT',
      operatorId: principal.customerAccountId,
      reason,
      action: 'CUSTOMER_CANCEL',
    });
    return this.customerDetail(
      principal.tenantId,
      principal.customerId ?? '',
      orderId,
    );
  }

  async review(
    principal: AuthPrincipal,
    orderId: string,
    action: 'APPROVE' | 'REJECT',
    reason?: string,
  ) {
    if (action === 'REJECT') {
      await this.cancel({
        tenantId: principal.tenantId,
        orderId,
        operatorType: 'EMPLOYEE',
        operatorId: principal.userId,
        reason: reason ?? '仓库拒绝订单',
        action: 'WAREHOUSE_REJECT',
        reviewerId: principal.userId,
        reviewerRole: principal.roleCode,
      });
      return this.adminDetail(principal, orderId);
    }

    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, principal.tenantId, orderId);
      await this.assertWarehouseScope(
        manager,
        principal,
        order.warehouseId,
      );
      if (order.status !== 'WAITING_REVIEW') {
        throw new BadRequestException({
          code: 'ORDER_STATUS_INVALID',
          message: '只有待审核订单可以审核',
        });
      }
      order.status = 'APPROVED';
      order.reviewedBy = principal.userId;
      order.reviewedAt = new Date();
      order.rejectionReason = null;
      await manager.getRepository(OrderEntity).save(order);
      await this.warehouseTasks.createForApprovedOrder(manager, order);
      await manager.getRepository(OrderStatusLogEntity).save({
        tenantId: principal.tenantId,
        orderId: order.id,
        fromStatus: 'WAITING_REVIEW',
        toStatus: 'APPROVED',
        action: 'WAREHOUSE_APPROVE',
        operatorType: 'EMPLOYEE',
        operatorId: principal.userId,
        remark: reason?.trim() ?? '仓库审核通过',
      });
    });
    return this.adminDetail(principal, orderId);
  }

  private async cancel(input: {
    tenantId: string;
    orderId: string;
    expectedCustomerId?: string;
    operatorType: 'CUSTOMER_ACCOUNT' | 'EMPLOYEE' | 'SYSTEM';
    operatorId: string | null;
    reason: string;
    action: string;
    reviewerId?: string | null;
    reviewerRole?: string;
  }): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(
        manager,
        input.tenantId,
        input.orderId,
      );
      if (
        input.expectedCustomerId &&
        order.customerId !== input.expectedCustomerId
      ) {
        throw this.notFound();
      }
      if (input.reviewerId) {
        await this.assertWarehouseScope(
          manager,
          {
            tenantId: input.tenantId,
            userId: input.reviewerId,
            roleCode: input.reviewerRole ?? '',
          } as AuthPrincipal,
          order.warehouseId,
        );
      }
      if (order.status !== 'WAITING_REVIEW') {
        throw new BadRequestException({
          code: 'ORDER_CANNOT_CANCEL',
          message: '只有待审核订单可以取消或拒绝',
        });
      }

      const items = await manager.getRepository(OrderItemEntity).find({
        where: { tenantId: input.tenantId, orderId: order.id },
        order: { skuId: 'ASC' },
      });
      for (const item of items) {
        const quantity =
          item.saleType === 'PIECE'
            ? Number(item.plannedQuantity)
            : Number(item.plannedWeight);
        const inventory = await manager
          .getRepository(InventoryEntity)
          .createQueryBuilder('inventory')
          .setLock('pessimistic_write')
          .where('inventory.tenant_id = :tenantId', {
            tenantId: input.tenantId,
          })
          .andWhere('inventory.warehouse_id = :warehouseId', {
            warehouseId: order.warehouseId,
          })
          .andWhere('inventory.sku_id = :skuId', { skuId: item.skuId })
          .getOne();
        if (!inventory || Number(inventory.lockedQuantity) < quantity) {
          throw new BadRequestException({
            code: 'INVENTORY_LOCK_INCONSISTENT',
            message: '订单锁定库存数据异常，无法自动释放',
          });
        }
        await this.changeLockedInventory({
          manager,
          inventory,
          quantity,
          direction: 'RELEASE',
          orderId: order.id,
          operatorType: input.operatorType,
          operatorId: input.operatorId,
          reason: input.reason,
        });
      }
      await this.coupons.releaseForOrder(manager, order.id);
      order.status = 'CANCELLED';
      order.cancelledByType = input.operatorType;
      order.cancelledById = input.operatorId;
      order.cancellationReason = input.reason;
      order.cancelledAt = new Date();
      if (input.reviewerId) {
        order.reviewedBy = input.reviewerId;
        order.reviewedAt = new Date();
        order.rejectionReason = input.reason;
      }
      await manager.getRepository(OrderEntity).save(order);
      await manager.getRepository(OrderStatusLogEntity).save({
        tenantId: input.tenantId,
        orderId: order.id,
        fromStatus: 'WAITING_REVIEW',
        toStatus: 'CANCELLED',
        action: input.action,
        operatorType: input.operatorType,
        operatorId: input.operatorId,
        remark: input.reason,
      });
    });
  }

  private async changeLockedInventory(input: {
    manager: EntityManager;
    inventory: InventoryEntity;
    quantity: number;
    direction: 'LOCK' | 'RELEASE';
    orderId: string;
    operatorType: 'CUSTOMER_ACCOUNT' | 'EMPLOYEE' | 'SYSTEM';
    operatorId: string | null;
    reason: string;
  }) {
    const before = Number(input.inventory.lockedQuantity);
    const change = input.direction === 'LOCK' ? input.quantity : -input.quantity;
    const after = before + change;
    input.inventory.lockedQuantity = after.toFixed(3);
    input.inventory.version += 1;
    await input.manager.getRepository(InventoryEntity).save(input.inventory);
    await input.manager.getRepository(InventoryLogEntity).save({
      tenantId: input.inventory.tenantId,
      inventoryId: input.inventory.id,
      warehouseId: input.inventory.warehouseId,
      skuId: input.inventory.skuId,
      operationType:
        input.direction === 'LOCK' ? 'ORDER_LOCK' : 'ORDER_RELEASE',
      changeQuantity: '0.000',
      lockedChangeQuantity: change.toFixed(3),
      beforeQuantity: input.inventory.stockQuantity,
      afterQuantity: input.inventory.stockQuantity,
      beforeLockedQuantity: before.toFixed(3),
      afterLockedQuantity: after.toFixed(3),
      stockUnit: input.inventory.stockUnit,
      reason: input.reason,
      referenceType: 'ORDER',
      referenceId: input.orderId,
      operatorType: input.operatorType,
      operatorId: input.operatorId,
    });
  }

  private async lockOrder(
    manager: EntityManager,
    tenantId: string,
    orderId: string,
  ): Promise<OrderEntity> {
    const order = await manager
      .getRepository(OrderEntity)
      .createQueryBuilder('orders')
      .setLock('pessimistic_write')
      .where('orders.id = :orderId', { orderId })
      .andWhere('orders.tenant_id = :tenantId', { tenantId })
      .getOne();
    if (!order) throw this.notFound();
    return order;
  }

  private async assertWarehouseScope(
    manager: EntityManager,
    principal: AuthPrincipal,
    warehouseId: string,
  ): Promise<void> {
    if (principal.roleCode === 'ADMIN') return;
    const user = await manager.getRepository(UserEntity).findOneBy({
      id: principal.userId ?? '',
      tenantId: principal.tenantId,
      status: 'ACTIVE',
    });
    if (!user || user.warehouseId !== warehouseId) {
      throw new ForbiddenException({
        code: 'WAREHOUSE_SCOPE_FORBIDDEN',
        message: '不能审核其他仓库的订单',
      });
    }
  }

  private orderView(order: OrderEntity, detailed: boolean) {
    const deliveryProgress = this.fulfillmentProgress(order);
    const trackingLogs = (order.delivery?.logs ?? []).map((log) => ({
      status: log.status,
      reason_code: log.reasonCode,
      reason: log.reason,
      created_at: log.createdAt,
    }));
    return {
      id: order.id,
      order_no: order.orderNo,
      customer_id: order.customerId,
      customer_name: order.customer?.customerName,
      warehouse_id: order.warehouseId,
      warehouse_name: order.warehouse?.warehouseName,
      estimated_product_amount: order.estimatedProductAmount,
      estimated_discount_amount: order.estimatedDiscountAmount,
      estimated_amount: order.estimatedAmount,
      final_product_amount: order.finalProductAmount,
      final_amount: order.finalAmount,
      amount_adjustment_type: order.amountAdjustmentType,
      amount_adjustment: order.amountAdjustment,
      discount_amount: order.discountAmount,
      shipping_fee: order.shippingFee,
      shipping_status: order.shippingStatus,
      coupon_id: order.couponId,
      customer_coupon_id: order.customerCouponId,
      estimated_weight: order.estimatedWeight,
      actual_weight: order.actualWeight,
      weight_unit: order.weightUnit,
      status: order.status,
      remark: order.remark,
      reviewed_at: order.reviewedAt,
      rejection_reason: order.rejectionReason,
      cancellation_reason: order.cancellationReason,
      expires_at: order.expiresAt,
      created_at: order.createdAt,
      delivery: order.delivery
        ? {
            id: order.delivery.id,
            delivery_no: order.delivery.deliveryNo,
            status: order.delivery.status,
            delivery_person_id: order.delivery.deliveryPersonId,
            started_at: order.delivery.startedAt,
            delivered_at: order.delivery.deliveredAt,
            signed_by: order.delivery.signedBy,
            ...(detailed
              ? {
                  logs: trackingLogs,
                }
              : {}),
          }
        : null,
      shipping_package: order.shippingPackage
        ? {
            package_no: order.shippingPackage.packageNo,
            status: order.shippingPackage.status,
            completed_at: order.shippingPackage.completedAt,
            outbound_at: order.shippingPackage.outboundAt,
          }
        : null,
      fulfillment_progress: deliveryProgress,
      delivery_progress: deliveryProgress,
      delivery_status: order.delivery?.status ?? null,
      tracking_logs: trackingLogs,
      ...(detailed || order.items
        ? {
            items: (order.items ?? []).map((item) => ({
              id: item.id,
              sku_id: item.skuId,
              product_name: item.productName,
              sku_name: item.skuName,
              specification: item.specification,
              sale_type: item.saleType,
              planned_quantity: item.plannedQuantity,
              planned_weight: item.plannedWeight,
              actual_quantity: item.actualQuantity,
              actual_weight: item.actualWeight,
              actual_gross_weight: item.actualGrossWeight,
              actual_net_weight: item.actualNetWeight,
              unit: item.pieceUnit,
              weight_unit: item.weightUnit,
              stock_unit: item.stockUnit,
              price_unit: item.priceUnit,
              unit_price: item.unitPrice,
              final_unit_price: item.finalUnitPrice,
              gross_weight_unit_price: item.grossWeightUnitPrice,
              net_weight_unit_price: item.netWeightUnitPrice,
              estimated_amount: item.estimatedAmount,
              final_amount: item.finalAmount,
            })),
          }
        : {}),
      ...(detailed
        ? {
            status_logs: (order.statusLogs ?? [])
              .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
              .map((log) => ({
                id: log.id,
                from_status: log.fromStatus,
                to_status: log.toStatus,
                action: log.action,
                operator_type: log.operatorType,
                remark: log.remark,
                created_at: log.createdAt,
              })),
          }
        : {}),
    };
  }

  private fulfillmentProgress(order: OrderEntity) {
    const logs = new Map(
      (order.statusLogs ?? []).map((log) => [log.action, log.createdAt]),
    );
    const steps = [
      {
        code: 'REVIEW',
        label: '订单审核',
        completed: Boolean(order.reviewedAt),
        time: order.reviewedAt,
      },
      {
        code: 'PICKING',
        label: '仓库拣货',
        completed: order.pickingTask?.status === 'DONE',
        time: order.pickingTask?.completedAt ?? logs.get('PICKING_COMPLETE'),
      },
      {
        code: 'WEIGHING',
        label: '称重完成',
        completed: Boolean(order.finalAmount),
        time:
          logs.get('WEIGHING_COMPLETE') ??
          logs.get('PIECE_FULFILLMENT_COMPLETE'),
      },
      {
        code: 'OUTBOUND',
        label: '打包出库',
        completed: Boolean(order.shippingPackage?.outboundAt),
        time: order.shippingPackage?.outboundAt,
      },
      {
        code: 'DELIVERING',
        label: '配送中',
        completed: Boolean(order.delivery?.startedAt),
        time: order.delivery?.startedAt,
      },
      {
        code: 'DELIVERED',
        label: '已送达',
        completed: order.delivery?.status === 'DELIVERED',
        time: order.delivery?.deliveredAt,
      },
    ];
    const firstPending = steps.findIndex((step) => !step.completed);
    return steps.map((step, index) => ({
      ...step,
      current: firstPending === index,
    }));
  }

  private customerGroupStatuses(
    group?: CustomerOrderListQueryDto['group'],
  ): OrderStatus[] | undefined {
    if (group === 'PENDING') return ['CREATED', 'WAITING_REVIEW'];
    if (group === 'PROCESSING') {
      return [
        'APPROVED',
        'PICKING',
        'WEIGHING',
        'WAITING_DELIVERY',
        'DELIVERING',
      ];
    }
    if (group === 'COMPLETED') return ['COMPLETED'];
    if (group === 'CANCELLED') return ['CANCELLED'];
    return undefined;
  }

  private toKilograms(quantity: number, unit: string): number {
    if (unit === '斤') return quantity * 0.5;
    if (['公斤', '千克', 'kg', 'KG'].includes(unit)) return quantity;
    throw new BadRequestException({
      code: 'WEIGHT_UNIT_UNSUPPORTED',
      message: `暂不支持重量单位“${unit}”`,
    });
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

  private generateOrderNo(): string {
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    return `FB${date}${Date.now().toString().slice(-9)}${randomInt(1000, 10_000)}`;
  }

  private page<T>(items: T[], total: number, page: number, pageSize: number) {
    return {
      items,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
      },
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'ORDER_NOT_FOUND',
      message: '订单不存在',
    });
  }
}
