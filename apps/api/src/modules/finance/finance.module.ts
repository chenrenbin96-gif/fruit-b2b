import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CustomerEntity } from '../customers/entities/customer.entities';
import { OrderEntity } from '../orders/entities/order.entities';
import { UserEntity } from '../users/entities/user.entities';
import {
  PaymentAllocationEntity,
  PaymentEntity,
  ReceivableEntity,
} from './entities/finance.entities';
import {
  AdminFinanceController,
  CustomerFinanceController,
} from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReceivableEntity,
      PaymentEntity,
      PaymentAllocationEntity,
      CustomerEntity,
      OrderEntity,
      UserEntity,
    ]),
  ],
  controllers: [CustomerFinanceController, AdminFinanceController],
  providers: [FinanceService],
  exports: [FinanceService, TypeOrmModule],
})
export class FinanceModule {}
