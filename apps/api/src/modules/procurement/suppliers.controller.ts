import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { AuditService } from '../audit/audit.service';
import { IdParamDto } from '../products/dto/product.dto';
import {
  SaveSupplierDto,
  SupplierListQueryDto,
} from './dto/procurement.dto';
import { SuppliersService } from './suppliers.service';

@Controller('admin/suppliers')
@RequirePrincipalTypes('EMPLOYEE')
@RequirePermissions('supplier.manage')
export class SuppliersController {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: SupplierListQueryDto,
  ) {
    return this.suppliers.list(principal.tenantId, query);
  }

  @Get(':id')
  detail(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.suppliers.detail(principal.tenantId, params.id);
  }

  @Post()
  async create(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: SaveSupplierDto,
  ) {
    const result = await this.suppliers.create(principal.tenantId, dto);
    await this.audit.record(
      this.audit.fromPrincipal(principal, {
        moduleCode: 'SUPPLIER',
        actionCode: 'SUPPLIER_CREATE',
        targetType: 'SUPPLIER',
        targetId: result.id,
        before: null,
        after: { supplier: result },
      }),
    );
    return result;
  }

  @Put(':id')
  async update(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: SaveSupplierDto,
  ) {
    const before = await this.suppliers.detail(principal.tenantId, params.id);
    const result = await this.suppliers.update(
      principal.tenantId,
      params.id,
      dto,
    );
    await this.audit.record(
      this.audit.fromPrincipal(principal, {
        moduleCode: 'SUPPLIER',
        actionCode: 'SUPPLIER_UPDATE',
        targetType: 'SUPPLIER',
        targetId: result.id,
        before: { supplier: before },
        after: { supplier: result },
      }),
    );
    return result;
  }
}
