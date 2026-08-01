import { Controller, Get } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { ManagementDashboardService } from './management-dashboard.service';

@Controller('admin/management-dashboard')
@RequirePrincipalTypes('EMPLOYEE')
@RequirePermissions('dashboard.business.read')
export class ManagementDashboardController {
  constructor(private readonly dashboard: ManagementDashboardService) {}

  @Get()
  summary(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.dashboard.summary(principal.tenantId);
  }
}
