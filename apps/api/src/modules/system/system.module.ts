import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  DeliveryRegionEntity,
  StoreEntity,
  SystemSettingEntity,
  TenantEntity,
  WarehouseEntity,
} from './entities/system.entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TenantEntity,
      StoreEntity,
      WarehouseEntity,
      DeliveryRegionEntity,
      SystemSettingEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class SystemModule {}
