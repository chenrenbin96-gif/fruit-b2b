import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { IdParamDto } from '../products/dto/product.dto';
import {
  AddCartItemDto,
  BatchAddCartDto,
  SubmitCartDto,
  UpdateCartItemDto,
} from './dto/order.dto';
import { OrdersService } from './orders.service';
import { PurchaseCartService } from './purchase-cart.service';

@Controller('purchase-cart')
@RequirePrincipalTypes('CUSTOMER_ACCOUNT')
export class PurchaseCartController {
  constructor(
    private readonly cart: PurchaseCartService,
    private readonly orders: OrdersService,
  ) {}

  @Get()
  current(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.cart.preview(
      principal.tenantId,
      principal.customerId ?? '',
    );
  }

  @Get('preview')
  preview(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.cart.preview(
      principal.tenantId,
      principal.customerId ?? '',
    );
  }

  @Post('items')
  add(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cart.add(
      principal.tenantId,
      principal.customerId ?? '',
      dto,
    );
  }

  @Patch('items/:id')
  update(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cart.update(
      principal.tenantId,
      principal.customerId ?? '',
      params.id,
      dto,
    );
  }

  @Delete('items/:id')
  remove(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.cart.remove(
      principal.tenantId,
      principal.customerId ?? '',
      params.id,
    );
  }

  @Delete('items')
  clear(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.cart.clear(
      principal.tenantId,
      principal.customerId ?? '',
    );
  }

  @Post('submit')
  submit(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: SubmitCartDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.orders.submitCart(principal, dto, idempotencyKey);
  }

  @Post('reorder/:id')
  reorder(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.cart.reorder(
      principal.tenantId,
      principal.customerId ?? '',
      params.id,
    );
  }
}

@Controller('cart')
@RequirePrincipalTypes('CUSTOMER_ACCOUNT')
export class CartBatchController {
  constructor(private readonly cart: PurchaseCartService) {}

  @Post('batch-add')
  batchAdd(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: BatchAddCartDto,
  ) {
    return this.cart.batchAdd(
      principal.tenantId,
      principal.customerId ?? '',
      dto.items,
    );
  }
}
