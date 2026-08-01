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
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { AuditService } from '../audit/audit.service';
import { IdParamDto } from '../products/dto/product.dto';
import {
  CancelOrderDto,
  CustomerOrderListQueryDto,
} from './dto/order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@RequirePrincipalTypes('CUSTOMER_ACCOUNT')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: CustomerOrderListQueryDto,
  ) {
    return this.orders.customerList(principal, query);
  }

  @Get(':id')
  detail(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.orders.customerDetail(
      principal.tenantId,
      principal.customerId ?? '',
      params.id,
    );
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: CancelOrderDto,
  ) {
    const before = await this.orders.customerDetail(
      principal.tenantId,
      principal.customerId ?? '',
      params.id,
    );
    const result = await this.orders.cancelByCustomer(principal, params.id, dto.reason);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'ORDER',
      actionCode: 'ORDER_CUSTOMER_CANCEL',
      targetType: 'ORDER',
      targetId: params.id,
      before: { order: before },
      after: { order: result },
    }));
    return result;
  }
}
