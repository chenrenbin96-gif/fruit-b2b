import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { IdParamDto } from '../products/dto/product.dto';
import {
  AssignDeliveryDto,
  DeliveryListQueryDto,
  UpdateDeliveryStatusDto,
} from './dto/delivery.dto';
import { DeliveriesService } from './deliveries.service';

@Controller('admin/deliveries')
@RequirePrincipalTypes('EMPLOYEE')
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Get()
  @RequirePermissions('delivery.read')
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: DeliveryListQueryDto,
  ) {
    return this.deliveries.list(principal, query);
  }

  @Get('delivery-people')
  @RequirePermissions('delivery.read')
  deliveryPeople(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.deliveries.deliveryPeople(principal.tenantId);
  }

  @Get(':id')
  @RequirePermissions('delivery.read')
  detail(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.deliveries.detail(principal, params.id);
  }

  @Put(':id/assignee')
  @RequirePermissions('delivery.update')
  assign(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: AssignDeliveryDto,
  ) {
    return this.deliveries.assign(
      principal,
      params.id,
      dto.delivery_person_id,
    );
  }

  @Post(':id/status')
  @RequirePermissions('delivery.update')
  status(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: UpdateDeliveryStatusDto,
  ) {
    return this.deliveries.updateStatus(
      principal,
      params.id,
      dto.status,
      dto.signed_by,
      dto.remark,
      dto.reason_code,
      dto.reason,
    );
  }
}
