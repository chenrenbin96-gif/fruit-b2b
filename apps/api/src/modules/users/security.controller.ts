import { Controller, Get } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { SecurityService } from './security.service';

@Controller('admin/security')
@RequirePrincipalTypes('EMPLOYEE')
@RequirePermissions('system.security.read')
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @Get('roles')
  roles(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.security.listRoles(principal);
  }

  @Get('permissions')
  permissions() {
    return this.security.listPermissions();
  }
}
