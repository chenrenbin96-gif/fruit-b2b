import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  OrderEntity,
  OrderItemEntity,
  OrderStatusLogEntity,
} from '../orders/entities/order.entities';
import { UserEntity } from '../users/entities/user.entities';
import { FinanceModule } from '../finance/finance.module';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import { DeliveryEntity, DeliveryLogEntity } from './entities/delivery.entity';
import { ShippingPackageEntity } from '../orders/entities/warehouse-task.entities';

@Module({
  imports: [
    FinanceModule,
    TypeOrmModule.forFeature([
      DeliveryEntity,
      OrderEntity,
      OrderItemEntity,
      OrderStatusLogEntity,
      UserEntity,
      DeliveryLogEntity,
      ShippingPackageEntity,
    ]),
  ],
  controllers: [DeliveriesController],
  providers: [DeliveriesService],
  exports: [DeliveriesService, TypeOrmModule],
})
export class DeliveriesModule {}
