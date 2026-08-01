import { Controller, Get } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { SupplyChainAnalyticsService } from './supply-chain-analytics.service';

@Controller('admin/supply-chain')
@RequirePrincipalTypes('EMPLOYEE')
export class SupplyChainAnalyticsController {
  constructor(private readonly analytics: SupplyChainAnalyticsService) {}

  @Get('costs')
  @RequirePermissions('cost.read')
  costs(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.analytics.costs(principal.tenantId);
  }

  @Get('profit-analysis')
  @RequirePermissions('profit.read')
  profitAnalysis(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.analytics.profitAnalysis(principal.tenantId);
  }

  @Get('inventory-alerts')
  @RequirePermissions('inventory.alert.read')
  inventoryAlerts(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.analytics.inventoryAlerts(principal.tenantId);
  }

  @Get('purchase-suggestions')
  @RequirePermissions('purchase.suggestion.read')
  purchaseSuggestions(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.analytics.purchaseSuggestions(principal.tenantId);
  }
}
