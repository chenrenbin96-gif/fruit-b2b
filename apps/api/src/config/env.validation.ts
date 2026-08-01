import { parseDurationSeconds } from '../modules/auth/auth-session.service';

type Environment = Record<string, string | undefined>;

const requiredVariables = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CORS_ORIGINS',
] as const;

export function validateEnvironment(config: Environment): Environment {
  const missing = requiredVariables.filter((key) => !config[key]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  const port = Number(config.APP_PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error('APP_PORT must be a valid TCP port');
  }

  if (
    (config.JWT_ACCESS_SECRET?.length ?? 0) < 32 ||
    (config.JWT_REFRESH_SECRET?.length ?? 0) < 32
  ) {
    throw new Error('JWT access and refresh secrets must each be at least 32 characters');
  }
  const storageProvider = config.STORAGE_PROVIDER ?? 'LOCAL';
  if (!['LOCAL', 'S3'].includes(storageProvider)) {
    throw new Error('STORAGE_PROVIDER must be LOCAL or S3');
  }
  if (
    storageProvider === 'S3' &&
    [
      'STORAGE_ENDPOINT',
      'STORAGE_BUCKET',
      'STORAGE_ACCESS_KEY',
      'STORAGE_SECRET_KEY',
      'STORAGE_PUBLIC_URL',
    ].some((key) => !config[key]?.trim())
  ) {
    throw new Error('S3 storage requires endpoint, bucket, credentials and public URL');
  }
  if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
    throw new Error('JWT access and refresh secrets must be different');
  }
  const accessTtl = parseDurationSeconds(config.JWT_ACCESS_TTL ?? '2h');
  const refreshTtl = parseDurationSeconds(config.JWT_REFRESH_TTL ?? '30d');
  if (accessTtl > 24 * 60 * 60 || refreshTtl > 90 * 24 * 60 * 60) {
    throw new Error('JWT TTL exceeds the production safety limit');
  }
  if (
    config.NODE_ENV === 'production' &&
    config.CORS_ORIGINS?.split(',').some((origin) => origin.trim() === '*')
  ) {
    throw new Error('Wildcard CORS origin is forbidden in production');
  }
  const smsProvider = config.CUSTOMER_SMS_PROVIDER ?? 'console';
  if (!['console', 'http'].includes(smsProvider)) {
    throw new Error('CUSTOMER_SMS_PROVIDER must be console or http');
  }
  if (
    config.NODE_ENV === 'production' &&
    smsProvider !== 'http' &&
    config.ALLOW_INSECURE_DEV_SMS !== 'true'
  ) {
    throw new Error('Production requires CUSTOMER_SMS_PROVIDER=http');
  }
  if (
    smsProvider === 'http' &&
    ['SMS_HTTP_ENDPOINT', 'SMS_HTTP_TOKEN', 'SMS_TEMPLATE_ID'].some(
      (key) => !config[key]?.trim(),
    )
  ) {
    throw new Error(
      'HTTP SMS provider requires SMS_HTTP_ENDPOINT, SMS_HTTP_TOKEN and SMS_TEMPLATE_ID',
    );
  }
  if (
    config.NODE_ENV === 'production' &&
    smsProvider === 'http' &&
    !config.SMS_HTTP_ENDPOINT?.startsWith('https://')
  ) {
    throw new Error('Production SMS_HTTP_ENDPOINT must use HTTPS');
  }

  return {
    ...config,
    APP_PORT: String(port),
    API_PREFIX: config.API_PREFIX ?? 'api',
    API_VERSION: config.API_VERSION ?? 'v1',
    LOG_LEVEL: config.LOG_LEVEL ?? 'info',
    JWT_ISSUER: config.JWT_ISSUER ?? 'fruit-b2b-api',
    JWT_AUDIENCE: config.JWT_AUDIENCE ?? 'fruit-b2b-clients',
    STORAGE_PROVIDER: storageProvider,
    UPLOAD_DIR: config.UPLOAD_DIR ?? 'uploads',
  };
}
