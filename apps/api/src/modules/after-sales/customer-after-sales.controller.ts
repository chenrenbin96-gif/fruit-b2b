import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentPrincipal, RequirePrincipalTypes } from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { IdParamDto } from '../products/dto/product.dto';
import { AfterSaleListQueryDto, CreateAfterSaleDto } from './dto/after-sale.dto';
import { AfterSalesService } from './after-sales.service';

@Controller('customer')
@RequirePrincipalTypes('CUSTOMER_ACCOUNT')
export class CustomerAfterSalesController {
  constructor(private readonly service: AfterSalesService) {}
  @Get('after-sale-reasons') reasons(@CurrentPrincipal() p: AuthPrincipal) { return this.service.activeReasons(p.tenantId); }
  @Post('after-sales') create(@CurrentPrincipal() p: AuthPrincipal, @Body() dto: CreateAfterSaleDto) { return this.service.create(p, dto); }
  @Get('after-sales') list(@CurrentPrincipal() p: AuthPrincipal, @Query() query: AfterSaleListQueryDto) { return this.service.customerList(p, query); }
  @Get('after-sales/:id') detail(@CurrentPrincipal() p: AuthPrincipal, @Param() params: IdParamDto) { return this.service.customerDetail(p, params.id); }
}
