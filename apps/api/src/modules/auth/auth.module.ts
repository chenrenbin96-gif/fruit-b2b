import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CustomersModule } from '../customers/customers.module';
import { SystemModule } from '../system/system.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSessionService } from './auth-session.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { CustomerVerificationService } from './customer-verification.service';
import { IdentityService } from './identity.service';
import { TokenService } from './token.service';
import { ConsoleSmsProvider } from './sms/console-sms.provider';
import { HttpSmsProvider } from './sms/http-sms.provider';
import { SMS_PROVIDER } from './sms/sms-provider';

@Module({
  imports: [SystemModule, UsersModule, CustomersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionService,
    AuthRateLimitService,
    CustomerVerificationService,
    IdentityService,
    TokenService,
    ConsoleSmsProvider,
    HttpSmsProvider,
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService, ConsoleSmsProvider, HttpSmsProvider],
      useFactory: (
        config: ConfigService,
        consoleProvider: ConsoleSmsProvider,
        httpProvider: HttpSmsProvider,
      ) =>
        config.get<string>('CUSTOMER_SMS_PROVIDER', 'console') === 'http'
          ? httpProvider
          : consoleProvider,
    },
  ],
  exports: [
    AuthService,
    AuthSessionService,
    IdentityService,
    TokenService,
  ],
})
export class AuthModule {}
