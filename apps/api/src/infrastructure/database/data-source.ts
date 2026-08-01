import 'reflect-metadata';

import { join } from 'node:path';

import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config({ path: join(__dirname, '../../../../../.env'), quiet: true });
config({ path: join(__dirname, '../../../.env'), quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to run migrations');
}

export default new DataSource({
  type: 'mysql',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, '../../modules/**/*entit*.{ts,js}')],
  migrations: [join(__dirname, '../../../migrations/*{.ts,.js}')],
  synchronize: false,
  timezone: 'Z',
  supportBigNumbers: true,
  bigNumberStrings: true,
});
