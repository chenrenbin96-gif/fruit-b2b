import { randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { AuthSessionService } from './auth-session.service';
import { parseDurationSeconds } from './auth-session.service';
import type {
  AuthPrincipal,
  TokenPayload,
} from './types/auth-principal';

@Injectable()
export class TokenService {
  private readonly accessTtlSeconds: number;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessions: AuthSessionService,
  ) {
    this.accessTtlSeconds = parseDurationSeconds(
      this.config.get<string>('JWT_ACCESS_TTL', '2h'),
    );
    this.issuer = this.config.get<string>('JWT_ISSUER', 'fruit-b2b-api');
    this.audience = this.config.get<string>('JWT_AUDIENCE', 'fruit-b2b-clients');
  }

  async issue(
    principal: Omit<AuthPrincipal, 'sessionId'>,
    sessionId: string = randomUUID(),
  ): Promise<{
    access_token: string;
    refresh_token: string;
    token_type: 'Bearer';
    expires_in: number;
    session_id: string;
  }> {
    const refreshJti = randomUUID();
    const common = {
      sub: principal.subjectId,
      tenant_id: principal.tenantId,
      tenant_code: principal.tenantCode,
      principal_type: principal.principalType,
      user_id: principal.userId,
      customer_account_id: principal.customerAccountId,
      customer_id: principal.customerId,
      role_code: principal.roleCode,
      session_id: sessionId,
    };

    const accessToken = await this.jwt.signAsync(
      { ...common, token_type: 'access' } satisfies TokenPayload,
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '2h') as never,
        algorithm: 'HS256',
        issuer: this.issuer,
        audience: this.audience,
      },
    );
    const refreshToken = await this.jwt.signAsync(
      {
        ...common,
        token_type: 'refresh',
        refresh_jti: refreshJti,
      } satisfies TokenPayload,
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_TTL', '30d') as never,
        algorithm: 'HS256',
        issuer: this.issuer,
        audience: this.audience,
      },
    );

    await this.sessions.save(sessionId, {
      subjectId: principal.subjectId,
      tenantId: principal.tenantId,
      principalType: principal.principalType,
      refreshJti,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.accessTtlSeconds,
      session_id: sessionId,
    };
  }

  async verifyAccess(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<TokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience,
      });
      if (payload.token_type !== 'access') {
        throw new Error('Invalid token type');
      }
      return payload;
    } catch {
      throw new UnauthorizedException({
        code: 'ACCESS_TOKEN_INVALID',
        message: '访问令牌无效或已过期',
      });
    }
  }

  async verifyRefresh(token: string): Promise<TokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<TokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience,
      });
      if (payload.token_type !== 'refresh' || !payload.refresh_jti) {
        throw new Error('Invalid token type');
      }
      return payload;
    } catch {
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_EXPIRED',
        message: '刷新令牌无效或已过期',
      });
    }
  }
}
