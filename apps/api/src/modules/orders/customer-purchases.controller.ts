import { Controller, Get } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { CustomerPurchasesService } from './customer-purchases.service';

@Controller('customer')
@RequirePrincipalTypes('CUSTOMER_ACCOUNT')
export class CustomerPurchasesController {
  constructor(private readonly purchases: CustomerPurchasesService) {}

  @Get('purchased-products')
  purchased(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.purchases.purchasedProducts(
      principal.tenantId,
      principal.customerId ?? '',
    );
  }

  @Get('frequent-products')
  frequent(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.purchases.purchasedProducts(
      principal.tenantId,
      principal.customerId ?? '',
      true,
    );
  }

  @Get('purchase-summary')
  summary(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.purchases.summary(
      principal.tenantId,
      principal.customerId ?? '',
    );
  }
}

@Controller('admin/customer-purchase-analysis')
@RequirePrincipalTypes('EMPLOYEE')
@RequirePermissions('customer.read')
export class AdminCustomerPurchasesController {
  constructor(private readonly purchases: CustomerPurchasesService) {}

  @Get()
  list(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.purchases.adminAnalysis(principal.tenantId);
  }
}
