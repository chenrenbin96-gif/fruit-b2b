import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

import type { AuthPrincipal, PrincipalType } from '../../modules/auth/types/auth-principal';
import type { AuthenticatedRequest } from '../../modules/auth/types/authenticated-request';

export const IS_PUBLIC_KEY = 'auth:is-public';
export const PERMISSIONS_KEY = 'auth:permissions';
export const PRINCIPAL_TYPES_KEY = 'auth:principal-types';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
export const RequirePrincipalTypes = (...types: PrincipalType[]) =>
  SetMetadata(PRINCIPAL_TYPES_KEY, types);

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().principal,
);
