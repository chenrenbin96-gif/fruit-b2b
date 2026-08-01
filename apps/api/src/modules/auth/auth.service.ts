import { Injectable, UnauthorizedException } from '@nestjs/common';

import {
  CustomerLoginDto,
  CustomerPasswordLoginDto,
  CustomerVerificationCodeRequestDto,
  EmployeeLoginDto,
} from './dto/auth.dto';
import { AuthSessionService } from './auth-session.service';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { CustomerVerificationService } from './customer-verification.service';
import { IdentityService } from './identity.service';
import { TokenService } from './token.service';
import type { AuthPrincipal } from './types/auth-principal';

@Injectable()
export class AuthService {
  constructor(
    private readonly identities: IdentityService,
    private readonly tokens: TokenService,
    private readonly sessions: AuthSessionService,
    private readonly customerVerification: CustomerVerificationService,
    private readonly rateLimit: AuthRateLimitService,
  ) {}

  async employeeLogin(dto: EmployeeLoginDto) {
    const scope = `employee:${dto.tenant_code}:${dto.username}`;
    await this.rateLimit.assertAllowed(scope);
    let principal;
    try {
      principal = await this.identities.authenticateEmployee(
        dto.tenant_code,
        dto.username,
        dto.password,
      );
    } catch (error) {
      await this.rateLimit.failed(scope);
      throw error;
    }
    await this.rateLimit.succeeded(scope);
    return this.loginResponse(principal);
  }

  async requestCustomerCode(dto: CustomerVerificationCodeRequestDto) {
    const { tenant, account } = await this.identities.findCustomerAccount(
      dto.tenant_code,
      dto.phone,
    );
    return this.customerVerification.issue(tenant.id, account.phone);
  }

  async customerLogin(dto: CustomerLoginDto) {
    const scope = `customer:${dto.tenant_code}:${dto.phone}`;
    await this.rateLimit.assertAllowed(scope);
    const { tenant, account } = await this.identities.findCustomerAccount(
      dto.tenant_code,
      dto.phone,
    );
    try {
      await this.customerVerification.verify(
        tenant.id,
        account.phone,
        dto.verification_code,
      );
    } catch (error) {
      await this.rateLimit.failed(scope);
      throw error;
    }
    await this.rateLimit.succeeded(scope);
    const principal = await this.identities.completeCustomerLogin(
      tenant,
      account,
    );
    return this.loginResponse(principal);
  }

  async customerPasswordLogin(dto: CustomerPasswordLoginDto) {
    const scope = `customer-password:${dto.tenant_code}:${dto.account}`;
    await this.rateLimit.assertAllowed(scope);
    let principal;
    try {
      principal = await this.identities.authenticateCustomerPassword(
        dto.tenant_code,
        dto.account,
        dto.password,
      );
    } catch (error) {
      await this.rateLimit.failed(scope);
      throw error;
    }
    await this.rateLimit.succeeded(scope);
    return this.loginResponse(principal);
  }

  async refresh(refreshToken: string) {
    const payload = await this.tokens.verifyRefresh(refreshToken);
    const session = await this.sessions.require(payload.session_id);

    if (
      session.refreshJti !== payload.refresh_jti ||
      session.subjectId !== payload.sub ||
      session.tenantId !== payload.tenant_id ||
      session.principalType !== payload.principal_type
    ) {
      await this.sessions.revoke(payload.session_id);
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REUSED',
        message: '刷新令牌已失效，请重新登录',
      });
    }

    const principal = await this.identities.resolveFromToken(payload);
    return this.loginResponse(principal, payload.session_id);
  }

  async logout(principal: AuthPrincipal): Promise<{ logged_out: true }> {
    await this.sessions.revoke(principal.sessionId);
    return { logged_out: true };
  }

  me(principal: AuthPrincipal) {
    return this.serializePrincipal(principal);
  }

  private async loginResponse(
    principal: Omit<AuthPrincipal, 'sessionId'>,
    sessionId?: string,
  ) {
    const tokens = await this.tokens.issue(principal, sessionId);
    return {
      ...tokens,
      principal: this.serializePrincipal({
        ...principal,
        sessionId: tokens.session_id,
      }),
    };
  }

  private serializePrincipal(principal: AuthPrincipal) {
    return {
      id: principal.subjectId,
      tenant_id: principal.tenantId,
      tenant_code: principal.tenantCode,
      principal_type: principal.principalType,
      user_id: principal.userId,
      customer_account_id: principal.customerAccountId,
      customer_id: principal.customerId,
      display_name: principal.displayName,
      role_code: principal.roleCode,
      permissions: principal.permissions,
    };
  }
}
