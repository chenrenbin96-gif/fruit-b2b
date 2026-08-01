import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { validateEnvironment } from './config/env.validation';
import { JwtFoundationModule } from './infrastructure/auth/jwt-foundation.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { HealthModule } from './infrastructure/health/health.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { CustomersModule } from './modules/customers/customers.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { DeliveriesModule } from './modules/deliveries/deliveries.module';
import { FinanceModule } from './modules/finance/finance.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ProductsModule } from './modules/products/products.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { SystemModule } from './modules/system/system.module';
import { UsersModule } from './modules/users/users.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { AfterSalesModule } from './modules/after-sales/after-sales.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env', '../../.env'],
      validate: validateEnvironment,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.body.password',
            'req.body.refresh_token',
            'req.body.verification_code',
            'req.body.phone',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
    DatabaseModule,
    RedisModule,
    JwtFoundationModule,
    HealthModule,
    AuditModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    CouponsModule,
    ProductsModule,
    ProcurementModule,
    OrdersModule,
    InventoryModule,
    ShippingModule,
    DeliveriesModule,
    FinanceModule,
    SystemModule,
    UploadsModule,
    AfterSalesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
