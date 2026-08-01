import { randomInt } from 'node:crypto';

import {
  Inject,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../../infrastructure/redis/redis.constants';
import {
  SMS_PROVIDER,
  type SmsProvider,
} from './sms/sms-provider';

@Injectable()
export class CustomerVerificationService {
  private readonly isProduction: boolean;
  private readonly provider: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    config: ConfigService,
  ) {
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
    this.provider = config.get<string>('CUSTOMER_SMS_PROVIDER', 'console');
  }

  async issue(
    tenantId: string,
    phone: string,
  ): Promise<{ expires_in: number; debug_code?: string }> {
    const rateLimitKey = `auth:customer-code-limit:${tenantId}:${phone}`;
    const allowed = await this.redis.set(rateLimitKey, '1', 'EX', 60, 'NX');
    if (!allowed) {
      throw new HttpException(
        {
          code: 'VERIFICATION_CODE_RATE_LIMITED',
          message: '验证码发送过于频繁，请稍后重试',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.redis.set(
      `auth:customer-code:${tenantId}:${phone}`,
      code,
      'EX',
      300,
    );
    try {
      await this.smsProvider.sendVerificationCode({
        phone,
        code,
        expiresMinutes: 5,
      });
    } catch (error) {
      await this.redis.del(
        `auth:customer-code:${tenantId}:${phone}`,
        rateLimitKey,
      );
      throw error;
    }

    return {
      expires_in: 300,
      ...(!this.isProduction && this.provider === 'console'
        ? { debug_code: code }
        : {}),
    };
  }

  async verify(tenantId: string, phone: string, code: string): Promise<void> {
    const key = `auth:customer-code:${tenantId}:${phone}`;
    const expected = await this.redis.get(key);

    if (!expected || expected !== code) {
      throw new UnauthorizedException({
        code: 'INVALID_VERIFICATION_CODE',
        message: '验证码无效或已过期',
      });
    }

    await this.redis.del(key);
  }
}
