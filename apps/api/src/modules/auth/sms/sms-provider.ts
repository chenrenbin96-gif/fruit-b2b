export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

export type SmsVerificationMessage = {
  phone: string;
  code: string;
  expiresMinutes: number;
};

export interface SmsProvider {
  sendVerificationCode(message: SmsVerificationMessage): Promise<void>;
}
