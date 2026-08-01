import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { DataSource } from 'typeorm';

import { Public } from '../../common/decorators/auth.decorators';
import { REDIS_CLIENT } from '../redis/redis.constants';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    const startedAt = Date.now();
    try {
      const dbStarted = Date.now();
      await this.dataSource.query('SELECT 1');
      const databaseLatencyMs = Date.now() - dbStarted;
      const redisStarted = Date.now();
      await this.redis.ping();
      const redisLatencyMs = Date.now() - redisStarted;
      return {
        status: 'ok' as const,
        checks: {
          application: { status: 'ok' },
          database: { status: 'ok', latency_ms: databaseLatencyMs },
          redis: { status: 'ok', latency_ms: redisLatencyMs },
        },
        total_latency_ms: Date.now() - startedAt,
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'SERVICE_NOT_READY',
        message: '数据库或缓存服务尚未就绪',
      });
    }
  }
}
