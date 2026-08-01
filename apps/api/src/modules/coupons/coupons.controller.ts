import { Controller, Get, Param, Post } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { IdParamDto } from '../products/dto/product.dto';
import { CouponsService } from './coupons.service';

@Controller('coupons')
@RequirePrincipalTypes('CUSTOMER_ACCOUNT')
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  list(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.coupons.customerList(
      principal.tenantId,
      principal.customerId ?? '',
    );
  }

  @Get('claimable')
  claimable(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.coupons.claimable(
      principal.tenantId,
      principal.customerId ?? '',
    );
  }

  @Post(':id/claim')
  claim(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.coupons.claim(
      principal.tenantId,
      principal.customerId ?? '',
      params.id,
    );
  }
}
