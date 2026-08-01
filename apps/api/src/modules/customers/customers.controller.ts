import { Body, Controller, Get, Patch } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { UpdateCustomerProfileDto } from './dto/customer-profile.dto';
import { CustomersService } from './customers.service';
import { CustomerCenterService } from './customer-center.service';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService, private readonly center: CustomerCenterService) {}

  @Get('me/center')
  @RequirePrincipalTypes('CUSTOMER_ACCOUNT')
  @RequirePermissions('customer.self')
  async centerSummary(@CurrentPrincipal() principal: AuthPrincipal) {
    const id = principal.customerId ?? '';
    const [profile, dashboard, credit, agreements] = await Promise.all([
      this.customers.me(principal), this.center.dashboard(principal, id),
      this.center.credit(principal, id), this.center.agreements(principal.tenantId, id),
    ]);
    return { profile, dashboard, credit, agreements };
  }

  @Get('me')
  @RequirePrincipalTypes('CUSTOMER_ACCOUNT')
  @RequirePermissions('customer.self')
  me(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.customers.me(principal);
  }

  @Patch('me')
  @RequirePrincipalTypes('CUSTOMER_ACCOUNT')
  @RequirePermissions('customer.self')
  updateMe(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: UpdateCustomerProfileDto,
  ) {
    return this.customers.updateMe(principal, dto);
  }
}
