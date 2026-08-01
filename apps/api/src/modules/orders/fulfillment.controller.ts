import { Body, Controller, Param, Post } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { AuditService } from '../audit/audit.service';
import { IdParamDto } from '../products/dto/product.dto';
import { CompleteWeighingDto } from './dto/fulfillment.dto';
import { FulfillmentService } from './fulfillment.service';
import { OrdersService } from './orders.service';

@Controller('admin/orders')
@RequirePrincipalTypes('EMPLOYEE')
@RequirePermissions('order.fulfill')
export class FulfillmentController {
  constructor(
    private readonly fulfillment: FulfillmentService,
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
  ) {}

  @Post(':id/picking/start')
  start(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.fulfillment.startPicking(principal, params.id);
  }

  @Post(':id/weighing')
  async weighing(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: CompleteWeighingDto,
  ) {
    const before = await this.orders.adminDetail(principal, params.id);
    const result = await this.fulfillment.completeWeighing(
      principal,
      params.id,
      dto.items,
    );
    const after = await this.orders.adminDetail(principal, params.id);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'FULFILLMENT',
      actionCode: 'ORDER_WEIGHING_COMPLETE',
      targetType: 'ORDER',
      targetId: params.id,
      before: { order: before },
      after: { order: after },
    }));
    return result;
  }

  @Post(':id/fulfillment/complete')
  async completePiece(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    const before = await this.orders.adminDetail(principal, params.id);
    const result = await this.fulfillment.completePieceOrder(principal, params.id);
    const after = await this.orders.adminDetail(principal, params.id);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'FULFILLMENT',
      actionCode: 'PIECE_FULFILLMENT_COMPLETE',
      targetType: 'ORDER',
      targetId: params.id,
      before: { order: before },
      after: { order: after },
    }));
    return result;
  }
}
