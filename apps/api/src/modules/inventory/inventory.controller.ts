import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { AuditService } from '../audit/audit.service';
import {
  AdjustInventoryDto,
  InventoryListQueryDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@Controller('admin/inventory')
@RequirePrincipalTypes('EMPLOYEE')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('inventory.read')
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: InventoryListQueryDto,
  ) {
    return this.inventory.list(principal.tenantId, query);
  }

  @Get('logs')
  @RequirePermissions('inventory.read')
  logs(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: InventoryListQueryDto,
  ) {
    return this.inventory.listLogs(principal.tenantId, query);
  }

  @Get('reference-data')
  @RequirePermissions('inventory.read')
  references(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.inventory.references(principal.tenantId);
  }

  @Post('adjustments')
  @RequirePermissions('inventory.adjust')
  async adjust(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: AdjustInventoryDto,
  ) {
    const before = await this.inventory.list(principal.tenantId, {
      warehouse_id: dto.warehouse_id,
      sku_id: dto.sku_id,
    });
    const result = await this.inventory.adjust(
      principal.tenantId,
      principal.userId ?? '',
      dto,
    );
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'INVENTORY',
      actionCode: 'INVENTORY_ADJUST',
      targetType: 'INVENTORY',
      targetId: result.id,
      before: { inventory: before[0] ?? null },
      after: { inventory: result, reason: dto.reason },
    }));
    return result;
  }
}
