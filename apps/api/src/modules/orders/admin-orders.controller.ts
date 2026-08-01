import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { AuditService } from '../audit/audit.service';
import { IdParamDto } from '../products/dto/product.dto';
import {
  AdminOrderListQueryDto,
  ReviewOrderDto,
} from './dto/order.dto';
import { OrdersService } from './orders.service';

@Controller('admin/orders')
@RequirePrincipalTypes('EMPLOYEE')
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('order.read')
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: AdminOrderListQueryDto,
  ) {
    return this.orders.adminList(principal, query);
  }

  @Get(':id')
  @RequirePermissions('order.read')
  detail(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.orders.adminDetail(principal, params.id);
  }

  @Post(':id/review')
  @RequirePermissions('order.review')
  async review(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: ReviewOrderDto,
  ) {
    const before = await this.orders.adminDetail(principal, params.id);
    const result = await this.orders.review(
      principal,
      params.id,
      dto.action,
      dto.reason,
    );
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'ORDER',
      actionCode: dto.action === 'APPROVE' ? 'ORDER_APPROVE' : 'ORDER_REJECT',
      targetType: 'ORDER',
      targetId: params.id,
      before: { order: before },
      after: { order: result },
    }));
    return result;
  }
}
