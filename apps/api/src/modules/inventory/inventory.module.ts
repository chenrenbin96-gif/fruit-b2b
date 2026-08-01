import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WarehouseEntity } from '../system/entities/system.entities';
import { SkuEntity } from '../products/entities/product.entities';
import {
  InventoryEntity,
  InventoryLogEntity,
} from './entities/inventory.entities';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryEntity,
      InventoryLogEntity,
      SkuEntity,
      WarehouseEntity,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [TypeOrmModule, InventoryService],
})
export class InventoryModule {}
