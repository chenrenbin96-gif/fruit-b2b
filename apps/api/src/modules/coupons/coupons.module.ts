import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  CustomerEntity,
  CustomerLevelEntity,
} from '../customers/entities/customer.entities';
import { OrderEntity } from '../orders/entities/order.entities';
import {
  CategoryEntity,
  ProductEntity,
} from '../products/entities/product.entities';
import { AdminCouponsController } from './admin-coupons.controller';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import {
  CouponCategoryEntity,
  CouponCustomerLevelEntity,
  CouponEntity,
  CouponProductEntity,
  CouponRecordEntity,
  CustomerCouponEntity,
} from './entities/coupon.entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CouponEntity,
      CouponProductEntity,
      CouponCategoryEntity,
      CouponCustomerLevelEntity,
      CustomerCouponEntity,
      CouponRecordEntity,
      CustomerEntity,
      CustomerLevelEntity,
      ProductEntity,
      CategoryEntity,
      OrderEntity,
    ]),
  ],
  controllers: [CouponsController, AdminCouponsController],
  providers: [CouponsService],
  exports: [CouponsService, TypeOrmModule],
})
export class CouponsModule {}
