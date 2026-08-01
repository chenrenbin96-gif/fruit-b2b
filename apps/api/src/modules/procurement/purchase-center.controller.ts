import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { IdParamDto } from '../products/dto/product.dto';
import {
  CreatePurchaseReturnDto,
  SaveSupplierProductDto,
  UpdatePurchaseReturnDto,
} from './dto/procurement.dto';
import { PurchaseCenterService } from './purchase-center.service';

@Controller('admin')
@RequirePrincipalTypes('EMPLOYEE')
export class PurchaseCenterController {
  constructor(private readonly center: PurchaseCenterService) {}

  @Get('suppliers/:id/products')
  @RequirePermissions('purchase.read')
  supplierProducts(@CurrentPrincipal() p: AuthPrincipal, @Param() id: IdParamDto) {
    return this.center.supplierProducts(p.tenantId, id.id);
  }

  @Post('suppliers/:id/products')
  @RequirePermissions('supplier.product.manage')
  saveSupplierProduct(
    @CurrentPrincipal() p: AuthPrincipal,
    @Param() id: IdParamDto,
    @Body() dto: SaveSupplierProductDto,
  ) {
    return this.center.saveSupplierProduct(p.tenantId, id.id, dto);
  }

  @Get('purchase-prices')
  @RequirePermissions('purchase.price.read')
  prices(@CurrentPrincipal() p: AuthPrincipal) {
    return this.center.prices(p.tenantId);
  }

  @Get('purchase-prices/history/:id')
  @RequirePermissions('purchase.price.read')
  priceHistory(@CurrentPrincipal() p: AuthPrincipal, @Param() id: IdParamDto) {
    return this.center.history(p.tenantId, id.id);
  }

  @Get('purchase-history')
  @RequirePermissions('purchase.read')
  history(@CurrentPrincipal() p: AuthPrincipal) {
    return this.center.history(p.tenantId);
  }

  @Get('purchase-returns')
  @RequirePermissions('purchase.read')
  returns(@CurrentPrincipal() p: AuthPrincipal) {
    return this.center.returns(p.tenantId);
  }

  @Post('purchase-returns')
  @RequirePermissions('purchase.return.manage')
  createReturn(@CurrentPrincipal() p: AuthPrincipal, @Body() dto: CreatePurchaseReturnDto) {
    return this.center.createReturn(p, dto);
  }

  @Put('purchase-returns/:id')
  @RequirePermissions('purchase.return.manage')
  updateReturn(
    @CurrentPrincipal() p: AuthPrincipal,
    @Param() id: IdParamDto,
    @Body() dto: UpdatePurchaseReturnDto,
  ) {
    return this.center.updateReturn(p, id.id, dto);
  }

  @Get('purchase-plans')
  @RequirePermissions('purchase.plan.manage')
  plans(@CurrentPrincipal() p: AuthPrincipal) {
    return this.center.plans(p.tenantId);
  }

  @Post('purchase-plans/generate')
  @RequirePermissions('purchase.plan.manage')
  generatePlans(@CurrentPrincipal() p: AuthPrincipal) {
    return this.center.generatePlans(p.tenantId);
  }

  @Get('purchase-analysis')
  @RequirePermissions('purchase.analysis.read')
  analysis(
    @CurrentPrincipal() p: AuthPrincipal,
    @Query('period') period?: 'day' | 'week' | 'month',
  ) {
    return this.center.analysis(p.tenantId, period);
  }

  @Get('purchasers')
  @RequirePermissions('purchase.read')
  purchasers(@CurrentPrincipal() p: AuthPrincipal) {
    return this.center.purchasers(p.tenantId);
  }
}
