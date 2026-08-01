import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import { AuthSessionService } from '../../modules/auth/auth-session.service';
import { IdentityService } from '../../modules/auth/identity.service';
import { TokenService } from '../../modules/auth/token.service';
import type { AuthenticatedRequest } from '../../modules/auth/types/authenticated-request';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly sessions: AuthSessionService,
    private readonly identities: IdentityService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const authorization = request.header('authorization');
    const [scheme, token] = authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: '请先登录',
      });
    }

    const payload = await this.tokens.verifyAccess(token);
    const session = await this.sessions.require(payload.session_id);
    if (
      session.subjectId !== payload.sub ||
      session.tenantId !== payload.tenant_id ||
      session.principalType !== payload.principal_type
    ) {
      throw new UnauthorizedException({
        code: 'SESSION_REVOKED',
        message: '登录会话已失效',
      });
    }

    request.principal = await this.identities.resolveFromToken(payload);
    return true;
  }
}
