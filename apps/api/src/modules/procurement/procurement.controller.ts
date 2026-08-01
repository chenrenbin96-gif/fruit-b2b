import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { AuditService } from '../audit/audit.service';
import { IdParamDto } from '../products/dto/product.dto';
import {
  PurchaseOrderListQueryDto,
  ReceivePurchaseOrderDto,
  SavePurchaseOrderDto,
} from './dto/procurement.dto';
import { ProcurementService } from './procurement.service';

@Controller('admin/purchases')
@RequirePrincipalTypes('EMPLOYEE')
export class ProcurementController {
  constructor(
    private readonly procurement: ProcurementService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('purchase.read')
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: PurchaseOrderListQueryDto,
  ) {
    return this.procurement.list(principal.tenantId, query);
  }

  @Get('reference-data')
  @RequirePermissions('purchase.read')
  references(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.procurement.references(principal.tenantId);
  }

  @Get(':id')
  @RequirePermissions('purchase.read')
  detail(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.procurement.detail(principal.tenantId, params.id);
  }

  @Post()
  @RequirePermissions('purchase.write')
  async create(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: SavePurchaseOrderDto,
  ) {
    const result = await this.procurement.create(principal, dto);
    await this.audit.record(
      this.audit.fromPrincipal(principal, {
        moduleCode: 'PURCHASE',
        actionCode: 'PURCHASE_CREATE',
        targetType: 'PURCHASE_ORDER',
        targetId: result.id,
        before: null,
        after: { purchase_order: result },
      }),
    );
    return result;
  }

  @Put(':id')
  @RequirePermissions('purchase.write')
  async update(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: SavePurchaseOrderDto,
  ) {
    const before = await this.procurement.detail(
      principal.tenantId,
      params.id,
    );
    const result = await this.procurement.update(principal, params.id, dto);
    await this.audit.record(
      this.audit.fromPrincipal(principal, {
        moduleCode: 'PURCHASE',
        actionCode: 'PURCHASE_UPDATE',
        targetType: 'PURCHASE_ORDER',
        targetId: result.id,
        before: { purchase_order: before },
        after: { purchase_order: result },
      }),
    );
    return result;
  }

  @Post(':id/submit')
  @RequirePermissions('purchase.write')
  async submit(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    const before = await this.procurement.detail(
      principal.tenantId,
      params.id,
    );
    const result = await this.procurement.submit(principal, params.id);
    await this.audit.record(
      this.audit.fromPrincipal(principal, {
        moduleCode: 'PURCHASE',
        actionCode: 'PURCHASE_SUBMIT',
        targetType: 'PURCHASE_ORDER',
        targetId: result.id,
        before: { purchase_order: before },
        after: { purchase_order: result },
      }),
    );
    return result;
  }

  @Post(':id/receive')
  @RequirePermissions('inventory.receive')
  async receive(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: ReceivePurchaseOrderDto,
  ) {
    const before = await this.procurement.detail(
      principal.tenantId,
      params.id,
    );
    const result = await this.procurement.receive(principal, params.id, dto);
    await this.audit.record(
      this.audit.fromPrincipal(principal, {
        moduleCode: 'PURCHASE',
        actionCode: 'PURCHASE_RECEIVE',
        targetType: 'PURCHASE_ORDER',
        targetId: params.id,
        before: { purchase_order: before },
        after: { purchase_order: result.order },
      }),
    );
    return result;
  }

  @Post(':id/arrive')
  @RequirePermissions('purchase.write')
  async arrive(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    const before = await this.procurement.detail(principal.tenantId, params.id);
    const result = await this.procurement.markArrived(principal, params.id);
    await this.audit.record(
      this.audit.fromPrincipal(principal, {
        moduleCode: 'PURCHASE',
        actionCode: 'PURCHASE_ARRIVE',
        targetType: 'PURCHASE_ORDER',
        targetId: params.id,
        before: { purchase_order: before },
        after: { purchase_order: result },
      }),
    );
    return result;
  }

  @Post(':id/cancel')
  @RequirePermissions('purchase.write')
  async cancel(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    const before = await this.procurement.detail(principal.tenantId, params.id);
    const result = await this.procurement.cancel(principal, params.id);
    await this.audit.record(
      this.audit.fromPrincipal(principal, {
        moduleCode: 'PURCHASE',
        actionCode: 'PURCHASE_CANCEL',
        targetType: 'PURCHASE_ORDER',
        targetId: params.id,
        before: { purchase_order: before },
        after: { purchase_order: result },
      }),
    );
    return result;
  }
}
