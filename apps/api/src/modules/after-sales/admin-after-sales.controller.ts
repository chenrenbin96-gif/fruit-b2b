import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentPrincipal, RequirePermissions, RequirePrincipalTypes } from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { IdParamDto } from '../products/dto/product.dto';
import { AdminAfterSaleListQueryDto, ApproveAfterSaleDto, ReasonDto, RejectAfterSaleDto, UpdateAfterSaleDto } from './dto/after-sale.dto';
import { AfterSalesService } from './after-sales.service';

@Controller('admin')
@RequirePrincipalTypes('EMPLOYEE')
export class AdminAfterSalesController {
  constructor(private readonly service: AfterSalesService) {}
  @Get('after-sales') @RequirePermissions('after.sale.read') list(@CurrentPrincipal() p: AuthPrincipal, @Query() q: AdminAfterSaleListQueryDto) { return this.service.adminList(p, q); }
  @Get('after-sales/:id') @RequirePermissions('after.sale.read') detail(@CurrentPrincipal() p: AuthPrincipal, @Param() params: IdParamDto) { return this.service.adminDetail(p, params.id); }
  @Post('after-sales/:id/approve') @RequirePermissions('after.sale.manage') approve(@CurrentPrincipal() p: AuthPrincipal, @Param() params: IdParamDto, @Body() dto: ApproveAfterSaleDto) { return this.service.approve(p, params.id, dto); }
  @Post('after-sales/:id/reject') @RequirePermissions('after.sale.manage') reject(@CurrentPrincipal() p: AuthPrincipal, @Param() params: IdParamDto, @Body() dto: RejectAfterSaleDto) { return this.service.reject(p, params.id, dto.reason); }
  @Put('after-sales/:id') @RequirePermissions('after.sale.manage') update(@CurrentPrincipal() p: AuthPrincipal, @Param() params: IdParamDto, @Body() dto: UpdateAfterSaleDto) { return this.service.update(p, params.id, dto); }
  @Post('after-sales/:id/complete') @RequirePermissions('after.sale.refund.manage') complete(@CurrentPrincipal() p: AuthPrincipal, @Param() params: IdParamDto) { return this.service.complete(p, params.id); }
  @Get('after-sale-reasons') @RequirePermissions('after.sale.read') reasons(@CurrentPrincipal() p: AuthPrincipal) { return this.service.reasonList(p); }
  @Post('after-sale-reasons') @RequirePermissions('after.sale.reason.manage') createReason(@CurrentPrincipal() p: AuthPrincipal, @Body() dto: ReasonDto) { return this.service.createReason(p, dto); }
  @Put('after-sale-reasons/:id') @RequirePermissions('after.sale.reason.manage') updateReason(@CurrentPrincipal() p: AuthPrincipal, @Param() params: IdParamDto, @Body() dto: ReasonDto) { return this.service.updateReason(p, params.id, dto); }
  @Delete('after-sale-reasons/:id') @RequirePermissions('after.sale.reason.manage') deleteReason(@CurrentPrincipal() p: AuthPrincipal, @Param() params: IdParamDto) { return this.service.deleteReason(p, params.id); }
}
