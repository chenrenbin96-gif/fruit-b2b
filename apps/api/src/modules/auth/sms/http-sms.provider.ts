import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  SmsProvider,
  SmsVerificationMessage,
} from './sms-provider';

@Injectable()
export class HttpSmsProvider implements SmsProvider {
  constructor(private readonly config: ConfigService) {}

  async sendVerificationCode(
    message: SmsVerificationMessage,
  ): Promise<void> {
    const endpoint = this.config.getOrThrow<string>('SMS_HTTP_ENDPOINT');
    const token = this.config.getOrThrow<string>('SMS_HTTP_TOKEN');
    const templateId = this.config.getOrThrow<string>('SMS_TEMPLATE_ID');
    const timeoutMs = Number(this.config.get('SMS_HTTP_TIMEOUT_MS', '5000'));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: message.phone,
          template_id: templateId,
          params: {
            code: message.code,
            expires_minutes: message.expiresMinutes,
          },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`SMS gateway returned HTTP ${response.status}`);
      }
    } catch {
      throw new ServiceUnavailableException({
        code: 'SMS_PROVIDER_UNAVAILABLE',
        message: '短信服务暂时不可用，请稍后重试',
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
