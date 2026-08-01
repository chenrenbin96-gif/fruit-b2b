import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentPrincipal, RequirePermissions, RequirePrincipalTypes } from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { IdParamDto } from '../products/dto/product.dto';
import { AdjustCustomerCreditDto, CustomerCenterQueryDto, SaveCustomerAgreementDto, SaveCustomerCenterDto, SaveCustomerGroupDto, SaveCustomerTagDto, SaveCustomerTypeDto } from './dto/customer-center.dto';
import { CustomerCenterService } from './customer-center.service';

@Controller('admin')
@RequirePrincipalTypes('EMPLOYEE')
export class CustomerCenterController {
  constructor(private readonly center: CustomerCenterService) {}
  @Get('customers') @RequirePermissions('customer.center.read') list(@CurrentPrincipal() p:AuthPrincipal,@Query() q:CustomerCenterQueryDto){return this.center.list(p,q);}
  @Get('customers/:id') @RequirePermissions('customer.center.read') detail(@CurrentPrincipal() p:AuthPrincipal,@Param() x:IdParamDto){return this.center.detail(p,x.id);}
  @Post('customers') @RequirePermissions('customer.center.manage') create(@CurrentPrincipal() p:AuthPrincipal,@Body() d:SaveCustomerCenterDto){return this.center.save(p,null,d);}
  @Put('customers/:id') @RequirePermissions('customer.center.manage') update(@CurrentPrincipal() p:AuthPrincipal,@Param() x:IdParamDto,@Body() d:SaveCustomerCenterDto){return this.center.save(p,x.id,d);}
  @Get('customers/:id/dashboard') @RequirePermissions('customer.center.read') dashboard(@CurrentPrincipal() p:AuthPrincipal,@Param() x:IdParamDto){return this.center.dashboard(p,x.id);}
  @Get('customers/:id/orders') @RequirePermissions('customer.center.read') orders(@CurrentPrincipal() p:AuthPrincipal,@Param() x:IdParamDto){return this.center.orders(p,x.id);}
  @Get('customers/:id/history') @RequirePermissions('customer.center.read') history(@CurrentPrincipal() p:AuthPrincipal,@Param() x:IdParamDto){return this.center.history(p,x.id);}
  @Get('customers/:id/credit') @RequirePermissions('customer.center.read') credit(@CurrentPrincipal() p:AuthPrincipal,@Param() x:IdParamDto){return this.center.credit(p,x.id);}
  @Put('customers/:id/credit') @RequirePermissions('customer.credit.manage') adjustCredit(@CurrentPrincipal() p:AuthPrincipal,@Param() x:IdParamDto,@Body() d:AdjustCustomerCreditDto){return this.center.adjustCredit(p,x.id,d);}
  @Get('customer-types') @RequirePermissions('customer.center.read') types(@CurrentPrincipal() p:AuthPrincipal){return this.center.types(p.tenantId);}
  @Post('customer-types') @RequirePermissions('customer.config.manage') saveType(@CurrentPrincipal() p:AuthPrincipal,@Body() d:SaveCustomerTypeDto){return this.center.saveType(p.tenantId,d);}
  @Get('customer-groups') @RequirePermissions('customer.center.read') groups(@CurrentPrincipal() p:AuthPrincipal){return this.center.groups(p.tenantId);}
  @Post('customer-groups') @RequirePermissions('customer.config.manage') saveGroup(@CurrentPrincipal() p:AuthPrincipal,@Body() d:SaveCustomerGroupDto){return this.center.saveGroup(p.tenantId,d);}
  @Get('customer-tags') @RequirePermissions('customer.center.read') tags(@CurrentPrincipal() p:AuthPrincipal){return this.center.tags(p.tenantId);}
  @Post('customer-tags') @RequirePermissions('customer.config.manage') saveTag(@CurrentPrincipal() p:AuthPrincipal,@Body() d:SaveCustomerTagDto){return this.center.saveTag(p.tenantId,d);}
  @Get('customer-prices') @RequirePermissions('customer.center.read') agreements(@CurrentPrincipal() p:AuthPrincipal,@Query('customer_id') id?:string){return this.center.agreements(p.tenantId,id);}
  @Post('customer-prices') @RequirePermissions('customer.agreement.manage') saveAgreement(@CurrentPrincipal() p:AuthPrincipal,@Body() d:SaveCustomerAgreementDto){return this.center.saveAgreement(p.tenantId,d);}
}
