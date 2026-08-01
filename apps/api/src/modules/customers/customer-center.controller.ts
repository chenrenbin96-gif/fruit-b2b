import { Body, Controller, Get, Param, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { CurrentPrincipal, RequirePermissions, RequirePrincipalTypes } from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { IdParamDto } from '../products/dto/product.dto';
import { AdjustCustomerCreditDto, CustomerCenterQueryDto, CustomerExportQueryDto, SaveCustomerAgreementDto, SaveCustomerCenterDto, SaveCustomerGroupDto, SaveCustomerTagDto, SaveCustomerTypeDto } from './dto/customer-center.dto';
import { CustomerCenterService } from './customer-center.service';
import { CustomerExcelService } from './customer-excel.service';

@Controller('admin')
@RequirePrincipalTypes('EMPLOYEE')
export class CustomerCenterController {
  constructor(private readonly center: CustomerCenterService, private readonly excel: CustomerExcelService) {}
  @Get('customers') @RequirePermissions('customer.center.read') list(@CurrentPrincipal() p:AuthPrincipal,@Query() q:CustomerCenterQueryDto){return this.center.list(p,q);}
  @Get('customers/filter-options') @RequirePermissions('customer.center.read') filterOptions(@CurrentPrincipal() p:AuthPrincipal){return this.center.filterOptions(p.tenantId);}
  @Get('customers/export')
  @RequirePermissions('customer.export')
  async exportCustomers(@CurrentPrincipal() p:AuthPrincipal,@Query() q:CustomerExportQueryDto,@Req() request:Request,@Res() response:Response){
    const result=await this.excel.export(p,q,this.clientIp(request));
    const date=new Date().toISOString().slice(0,10).replaceAll('-','');
    response.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(`客户档案_${date}.xlsx`)}`);
    response.setHeader('X-Export-Count',String(result.count));
    response.send(result.buffer);
  }
  @Get('customers/import-template')
  @RequirePermissions('customer.import')
  async importTemplate(@Res() response:Response){
    response.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent('客户档案导入模板.xlsx')}`);
    response.send(await this.excel.template());
  }
  @Post('customers/import')
  @RequirePermissions('customer.import')
  @UseInterceptors(FileInterceptor('file',{limits:{fileSize:20*1024*1024,files:1}}))
  importCustomers(@CurrentPrincipal() p:AuthPrincipal,@UploadedFile() file?:Express.Multer.File){return this.excel.import(p,file);}
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
  private clientIp(request:Request){const forwarded=request.headers['x-forwarded-for'];return String(Array.isArray(forwarded)?forwarded[0]:forwarded?.split(',')[0]??request.ip??request.socket.remoteAddress??'').trim().slice(0,64);}
}
