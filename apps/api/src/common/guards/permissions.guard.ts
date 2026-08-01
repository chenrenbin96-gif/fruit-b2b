import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  PERMISSIONS_KEY,
  PRINCIPAL_TYPES_KEY,
} from '../decorators/auth.decorators';
import type { PrincipalType } from '../../modules/auth/types/auth-principal';
import type { AuthenticatedRequest } from '../../modules/auth/types/authenticated-request';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();
    const principal = request.principal;
    if (!principal) {
      return true;
    }

    const allowedTypes =
      this.reflector.getAllAndOverride<PrincipalType[]>(PRINCIPAL_TYPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (
      allowedTypes.length > 0 &&
      !allowedTypes.includes(principal.principalType)
    ) {
      throw this.forbidden();
    }

    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (
      required.length > 0 &&
      !principal.permissions.includes('*') &&
      !required.every((permission) =>
        principal.permissions.includes(permission),
      )
    ) {
      throw this.forbidden();
    }

    return true;
  }

  private forbidden(): ForbiddenException {
    return new ForbiddenException({
      code: 'FORBIDDEN',
      message: '无权执行当前操作',
    });
  }
}
