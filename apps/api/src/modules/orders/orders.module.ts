import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  CustomerEntity,
  CustomerSettingEntity,
} from '../customers/entities/customer.entities';
import { CouponsModule } from '../coupons/coupons.module';
import { DeliveriesModule } from '../deliveries/deliveries.module';
import { FinanceModule } from '../finance/finance.module';
import {
  InventoryEntity,
  InventoryLogEntity,
} from '../inventory/entities/inventory.entities';
import { ProductsModule } from '../products/products.module';
import { ShippingModule } from '../shipping/shipping.module';
import { SkuEntity } from '../products/entities/product.entities';
import {
  SystemSettingEntity,
  WarehouseEntity,
} from '../system/entities/system.entities';
import { UserEntity } from '../users/entities/user.entities';
import { AdminOrdersController } from './admin-orders.controller';
import { FulfillmentController } from './fulfillment.controller';
import { FulfillmentService } from './fulfillment.service';
import { ManagementDashboardController } from './management-dashboard.controller';
import { ManagementDashboardService } from './management-dashboard.service';
import {
  OrderEntity,
  OrderItemEntity,
  OrderStatusLogEntity,
  PurchaseCartEntity,
  PurchaseCartItemEntity,
} from './entities/order.entities';
import { OrderPolicyService } from './order-policy.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import {
  CartBatchController,
  PurchaseCartController,
} from './purchase-cart.controller';
import { PurchaseCartService } from './purchase-cart.service';
import {
  AdminCustomerPurchasesController,
  CustomerPurchasesController,
} from './customer-purchases.controller';
import { CustomerPurchasesService } from './customer-purchases.service';
import { WarehouseDashboardController } from './warehouse-dashboard.controller';
import { WarehouseDashboardService } from './warehouse-dashboard.service';
import {
  PickingTaskEntity,
  PickingTaskItemEntity,
  ShippingPackageEntity,
} from './entities/warehouse-task.entities';
import { WarehouseTasksController } from './warehouse-tasks.controller';
import { WarehouseTasksService } from './warehouse-tasks.service';

@Module({
  imports: [
    ProductsModule,
    CouponsModule,
    ShippingModule,
    DeliveriesModule,
    FinanceModule,
    TypeOrmModule.forFeature([
      PurchaseCartEntity,
      PurchaseCartItemEntity,
      OrderEntity,
      OrderItemEntity,
      OrderStatusLogEntity,
      CustomerEntity,
      CustomerSettingEntity,
      SystemSettingEntity,
      WarehouseEntity,
      SkuEntity,
      InventoryEntity,
      InventoryLogEntity,
      UserEntity,
      PickingTaskEntity,
      PickingTaskItemEntity,
      ShippingPackageEntity,
    ]),
  ],
  controllers: [
    PurchaseCartController,
    CartBatchController,
    CustomerPurchasesController,
    AdminCustomerPurchasesController,
    OrdersController,
    AdminOrdersController,
    FulfillmentController,
    WarehouseDashboardController,
    ManagementDashboardController,
    WarehouseTasksController,
  ],
  providers: [
    PurchaseCartService,
    CustomerPurchasesService,
    OrderPolicyService,
    OrdersService,
    FulfillmentService,
    WarehouseDashboardService,
    ManagementDashboardService,
    WarehouseTasksService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
