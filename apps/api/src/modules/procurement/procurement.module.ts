import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import {
  InventoryEntity,
  InventoryLogEntity,
} from '../inventory/entities/inventory.entities';
import { SkuEntity } from '../products/entities/product.entities';
import { WarehouseEntity } from '../system/entities/system.entities';
import { UserEntity } from '../users/entities/user.entities';
import {
  PurchaseOrderEntity,
  PurchaseOrderItemEntity,
  PurchaseReceiptEntity,
  PurchaseReceiptItemEntity,
  SupplierEntity,
  SupplierProductEntity,
  PurchasePriceHistoryEntity,
  PurchasePlanEntity,
  PurchaseReturnEntity,
  PurchaseReturnItemEntity,
} from './entities/procurement.entities';
import { PurchaseCenterController } from './purchase-center.controller';
import { PurchaseCenterService } from './purchase-center.service';
import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { SupplyChainAnalyticsController } from './supply-chain-analytics.controller';
import { SupplyChainAnalyticsService } from './supply-chain-analytics.service';

@Module({
  imports: [
    AuditModule,
    TypeOrmModule.forFeature([
      SupplierEntity,
      PurchaseOrderEntity,
      PurchaseOrderItemEntity,
      PurchaseReceiptEntity,
      PurchaseReceiptItemEntity,
      InventoryEntity,
      InventoryLogEntity,
      SkuEntity,
      WarehouseEntity,
      UserEntity,
      SupplierProductEntity,
      PurchasePriceHistoryEntity,
      PurchasePlanEntity,
      PurchaseReturnEntity,
      PurchaseReturnItemEntity,
    ]),
  ],
  controllers: [
    SuppliersController,
    ProcurementController,
    SupplyChainAnalyticsController,
    PurchaseCenterController,
  ],
  providers: [
    SuppliersService,
    ProcurementService,
    SupplyChainAnalyticsService,
    PurchaseCenterService,
  ],
})
export class ProcurementModule {}
