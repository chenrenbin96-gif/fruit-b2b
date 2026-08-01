import { Injectable } from '@nestjs/common';

import type {
  SmsProvider,
  SmsVerificationMessage,
} from './sms-provider';

@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  async sendVerificationCode(
    _message: SmsVerificationMessage,
  ): Promise<void> {
    // 开发验证码由认证接口按环境显式返回，不写入日志。
  }
}
