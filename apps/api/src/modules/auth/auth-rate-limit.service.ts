import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../../infrastructure/redis/redis.constants';

@Injectable()
export class AuthRateLimitService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async assertAllowed(scope: string): Promise<void> {
    const attempts = Number((await this.redis.get(this.key(scope))) ?? 0);
    if (attempts >= 5) {
      throw new HttpException(
        {
          code: 'AUTH_ATTEMPTS_LIMITED',
          message: '登录失败次数过多，请15分钟后重试',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async failed(scope: string): Promise<void> {
    const key = this.key(scope);
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 15 * 60);
  }

  async succeeded(scope: string): Promise<void> {
    await this.redis.del(this.key(scope));
  }

  private key(scope: string): string {
    return `auth:failed:${scope.toLowerCase()}`;
  }
}
