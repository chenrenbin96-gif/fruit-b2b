import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { AuditService } from './audit.service';

class AuditListQueryDto {
  @IsOptional() @IsString() module_code?: string;
  @IsOptional() @IsString() operator_id?: string;
  @IsOptional() @IsString() target_type?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page_size = 20;
}

@Controller('admin/operation-logs')
@RequirePrincipalTypes('EMPLOYEE')
@RequirePermissions('operation_log.read')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: AuditListQueryDto,
  ) {
    return this.audit.list(principal.tenantId, query);
  }
}
