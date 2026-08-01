import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeliveryRegionEntity } from '../system/entities/system.entities';
import { CustomerEntity } from '../customers/entities/customer.entities';
import {
  ShippingRecordEntity,
  ShippingRuleEntity,
} from './entities/shipping.entities';
import {
  AdminDeliveryRegionsController,
  AdminShippingController,
  ShippingController,
} from './shipping.controller';
import { ShippingService } from './shipping.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShippingRuleEntity,
      ShippingRecordEntity,
      DeliveryRegionEntity,
      CustomerEntity,
    ]),
  ],
  controllers: [
    ShippingController,
    AdminShippingController,
    AdminDeliveryRegionsController,
  ],
  providers: [ShippingService],
  exports: [ShippingService, TypeOrmModule],
})
export class ShippingModule {}
