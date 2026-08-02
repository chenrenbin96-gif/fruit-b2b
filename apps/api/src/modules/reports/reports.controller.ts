import { Controller,Get,Param,Query,Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentPrincipal,RequirePermissions,RequirePrincipalTypes } from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { ReportQueryDto,ReportTypeDto } from './dto/report.dto';
import { ReportsService } from './reports.service';

@Controller('admin/reports') @RequirePrincipalTypes('EMPLOYEE')
export class ReportsController{
  constructor(private readonly reports:ReportsService){}
  @Get(':type') @RequirePermissions('report.read') get(@CurrentPrincipal() p:AuthPrincipal,@Param() x:ReportTypeDto,@Query() q:ReportQueryDto){return this.reports.report(p.tenantId,x.type,q);}
  @Get(':type/export') @RequirePermissions('report.export') async export(@CurrentPrincipal() p:AuthPrincipal,@Param() x:ReportTypeDto,@Query() q:ReportQueryDto,@Res() res:Response){res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(`报表_${x.type}_${new Date().toISOString().slice(0,10)}.xlsx`)}`);res.send(await this.reports.export(p.tenantId,x.type,q));}
}
