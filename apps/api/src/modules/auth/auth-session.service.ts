import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import { REDIS_CLIENT } from '../../infrastructure/redis/redis.constants';
import type { SessionRecord } from './types/auth-principal';

function parseDurationSeconds(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!match) {
    throw new Error(`Unsupported duration: ${value}`);
  }

  const amount = Number(match[1]);
  const factors = { s: 1, m: 60, h: 3_600, d: 86_400 } as const;
  const unit = match[2] as keyof typeof factors;
  return amount * factors[unit];
}

@Injectable()
export class AuthSessionService {
  private readonly refreshTtlSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    config: ConfigService,
  ) {
    this.refreshTtlSeconds = parseDurationSeconds(
      config.get<string>('JWT_REFRESH_TTL', '30d'),
    );
  }

  async save(sessionId: string, record: SessionRecord): Promise<void> {
    await this.redis.set(
      this.key(sessionId),
      JSON.stringify(record),
      'EX',
      this.refreshTtlSeconds,
    );
  }

  async require(sessionId: string): Promise<SessionRecord> {
    const raw = await this.redis.get(this.key(sessionId));
    if (!raw) {
      throw new UnauthorizedException({
        code: 'SESSION_REVOKED',
        message: '登录会话已失效',
      });
    }
    return JSON.parse(raw) as SessionRecord;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.redis.del(this.key(sessionId));
  }

  private key(sessionId: string): string {
    return `auth:session:${sessionId}`;
  }
}

export { parseDurationSeconds };
