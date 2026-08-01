import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { IdParamDto } from '../products/dto/product.dto';
import {
  CreateDeliveryRegionDto,
  CreateShippingRuleDto,
  EstimateShippingDto,
  UpdateDeliveryRegionDto,
  UpdateShippingRuleDto,
} from './dto/shipping.dto';
import { ShippingService } from './shipping.service';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get('rules')
  @RequirePrincipalTypes('CUSTOMER_ACCOUNT', 'EMPLOYEE')
  rules(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.shipping.listRules(principal.tenantId, true);
  }

  @Get('regions')
  @RequirePrincipalTypes('CUSTOMER_ACCOUNT', 'EMPLOYEE')
  regions(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.shipping.listRegions(principal.tenantId, true);
  }

  @Post('calculate-estimate')
  @RequirePrincipalTypes('CUSTOMER_ACCOUNT', 'EMPLOYEE')
  estimate(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: EstimateShippingDto,
  ) {
    return this.shipping.estimate(
      principal.tenantId,
      dto.weight,
      dto.weight_unit,
      dto.delivery_region_id,
    );
  }
}

@Controller('admin/shipping/rules')
@RequirePrincipalTypes('EMPLOYEE')
@RequirePermissions('shipping.manage')
export class AdminShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get()
  list(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.shipping.listRules(principal.tenantId);
  }

  @Post()
  create(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CreateShippingRuleDto,
  ) {
    return this.shipping.createRule(principal.tenantId, dto);
  }

  @Put(':id')
  update(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: UpdateShippingRuleDto,
  ) {
    return this.shipping.updateRule(principal.tenantId, params.id, dto);
  }
}

@Controller('admin/shipping/regions')
@RequirePrincipalTypes('EMPLOYEE')
@RequirePermissions('shipping.manage')
export class AdminDeliveryRegionsController {
  constructor(private readonly shipping: ShippingService) {}

  @Get()
  list(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.shipping.listRegions(principal.tenantId);
  }

  @Post()
  create(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CreateDeliveryRegionDto,
  ) {
    return this.shipping.createRegion(principal.tenantId, dto);
  }

  @Put(':id')
  update(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: UpdateDeliveryRegionDto,
  ) {
    return this.shipping.updateRegion(principal.tenantId, params.id, dto);
  }
}
