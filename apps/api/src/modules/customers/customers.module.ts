import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  CustomerAccountEntity,
  CustomerEntity,
  CustomerLevelEntity,
  CustomerSettingEntity,
} from './entities/customer.entities';
import { DeliveryRegionEntity } from '../system/entities/system.entities';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerCenterController } from './customer-center.controller';
import { CustomerCenterService } from './customer-center.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerEntity,
      CustomerAccountEntity,
      CustomerLevelEntity,
      CustomerSettingEntity,
      DeliveryRegionEntity,
    ]),
  ],
  controllers: [CustomersController, CustomerCenterController],
  providers: [CustomersService, CustomerCenterService],
  exports: [TypeOrmModule, CustomersService],
})
export class CustomersModule {}
