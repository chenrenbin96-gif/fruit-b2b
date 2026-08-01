import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

async function bootstrapWorker(): Promise<void> {
  const context = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  context.useLogger(context.get(Logger));
  context.enableShutdownHooks();
}

void bootstrapWorker();
