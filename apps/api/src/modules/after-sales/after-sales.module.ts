import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAfterSalesController } from './admin-after-sales.controller';
import { AfterSalesService } from './after-sales.service';
import { CustomerAfterSalesController } from './customer-after-sales.controller';
import { AfterSaleItemEntity, AfterSaleMediaEntity, AfterSaleOrderEntity, AfterSaleReasonEntity, AfterSaleRefundEntity } from './entities/after-sale.entities';

@Module({
  imports: [TypeOrmModule.forFeature([AfterSaleOrderEntity, AfterSaleItemEntity, AfterSaleMediaEntity, AfterSaleReasonEntity, AfterSaleRefundEntity])],
  controllers: [CustomerAfterSalesController, AdminAfterSalesController],
  providers: [AfterSalesService],
})
export class AfterSalesModule {}
