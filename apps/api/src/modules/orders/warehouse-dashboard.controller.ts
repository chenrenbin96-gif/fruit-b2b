import { Controller, Get } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { WarehouseDashboardService } from './warehouse-dashboard.service';

@Controller('admin/warehouse-dashboard')
@RequirePrincipalTypes('EMPLOYEE')
@RequirePermissions('dashboard.read', 'order.read')
export class WarehouseDashboardController {
  constructor(private readonly dashboard: WarehouseDashboardService) {}

  @Get()
  summary(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.dashboard.summary(principal.tenantId);
  }
}
