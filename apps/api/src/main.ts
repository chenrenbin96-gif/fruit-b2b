import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import express from 'express';
import { join } from 'node:path';

import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  app.useLogger(app.get(Logger));
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.disable('x-powered-by');
  expressApp.use(
    '/uploads',
    express.static(config.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads')), {
      fallthrough: true,
      immutable: true,
      maxAge: '7d',
    }),
  );
  expressApp.use(new RequestIdMiddleware().use);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.enableCors({
    origin: config
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  });
  app.setGlobalPrefix(
    `${config.get<string>('API_PREFIX', 'api')}/${config.get<string>('API_VERSION', 'v1')}`,
  );
  app.enableShutdownHooks();

  await app.listen(config.get<number>('APP_PORT', 3000), '0.0.0.0');
}

void bootstrap();
