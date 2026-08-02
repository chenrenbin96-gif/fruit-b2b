import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import { CurrentPrincipal, RequirePermissions, RequirePrincipalTypes } from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { BiService } from './bi.service';
import { BiExportQueryDto, BiReportTypeDto, ReportQueryDto } from './dto/report.dto';

@Controller('admin/bi')
@RequirePrincipalTypes('EMPLOYEE')
export class BiController {
  constructor(private readonly bi: BiService) {}

  @Get('dashboard') @RequirePermissions('dashboard.read') dashboard(@CurrentPrincipal() p:AuthPrincipal){return this.bi.dashboard(p);}
  @Get('screen') @RequirePermissions('bi.screen.read') screen(@CurrentPrincipal() p:AuthPrincipal){return this.bi.screen(p);}
  @Get('reports/:type') @RequirePermissions('bi.report.read') report(@CurrentPrincipal() p:AuthPrincipal,@Param() x:BiReportTypeDto,@Query() q:ReportQueryDto){return this.bi.report(p,x.type,q);}
  @Get('reports/:type/export') @RequirePermissions('bi.report.export') async export(@CurrentPrincipal() p:AuthPrincipal,@Param() x:BiReportTypeDto,@Query() q:BiExportQueryDto,@Res() res:Response){
    const file=await this.bi.export(p,x.type,q);const name=`BI_${x.type}_${new Date().toISOString().slice(0,10)}.${file.extension}`;
    res.setHeader('Content-Type',file.contentType);res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(name)}`);res.send(file.buffer);
  }
}
