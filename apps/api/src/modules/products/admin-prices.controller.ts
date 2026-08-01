import {
  Body,
  Controller,
  Delete,
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
import {
  CalculatePriceDto,
  CreateQuantityPriceDto,
  PriceListQueryDto,
  UpdateQuantityPriceDto,
  UpsertCustomerPriceDto,
  UpsertLevelPriceDto,
} from './dto/price.dto';
import { IdParamDto } from './dto/product.dto';
import { PriceService } from './price.service';

@Controller('admin/prices')
@RequirePrincipalTypes('EMPLOYEE')
export class AdminPricesController {
  constructor(
    private readonly prices: PriceService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('price.read')
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: PriceListQueryDto,
  ) {
    return this.prices.list(principal.tenantId, query.sku_id);
  }

  @Get('reference-data')
  @RequirePermissions('price.read')
  references(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.prices.referenceData(principal.tenantId);
  }

  @Post('calculate')
  @RequirePermissions('price.read')
  calculate(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CalculatePriceDto,
  ) {
    return this.prices.calculateSkuPrice({
      tenantId: principal.tenantId,
      skuId: dto.sku_id,
      customerId: dto.customer_id,
      purchaseQuantity: dto.purchase_quantity,
    });
  }

  @Put('levels')
  @RequirePermissions('price.write')
  async level(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: UpsertLevelPriceDto,
  ) {
    const before = await this.prices.list(principal.tenantId, dto.sku_id);
    const result = await this.prices.upsertLevel(principal.tenantId, dto);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRICE',
      actionCode: 'LEVEL_PRICE_UPSERT',
      targetType: 'SKU',
      targetId: dto.sku_id,
      before: { rules: before },
      after: { rule: result },
    }));
    return result;
  }

  @Put('customers')
  @RequirePermissions('price.write')
  async customer(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: UpsertCustomerPriceDto,
  ) {
    const before = await this.prices.list(principal.tenantId, dto.sku_id);
    const result = await this.prices.upsertCustomer(principal.tenantId, dto);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRICE',
      actionCode: 'CUSTOMER_PRICE_UPSERT',
      targetType: 'SKU',
      targetId: dto.sku_id,
      before: { rules: before },
      after: { rule: result },
    }));
    return result;
  }

  @Post('quantities')
  @RequirePermissions('price.write')
  async quantity(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CreateQuantityPriceDto,
  ) {
    const before = await this.prices.list(principal.tenantId, dto.sku_id);
    const result = await this.prices.createQuantity(principal.tenantId, dto);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRICE',
      actionCode: 'QUANTITY_PRICE_CREATE',
      targetType: 'SKU',
      targetId: dto.sku_id,
      before: { rules: before },
      after: { rule: result },
    }));
    return result;
  }

  @Put('quantities/:id')
  @RequirePermissions('price.write')
  async updateQuantity(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: UpdateQuantityPriceDto,
  ) {
    const before = await this.prices.list(principal.tenantId, dto.sku_id);
    const result = await this.prices.updateQuantity(principal.tenantId, params.id, dto);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRICE',
      actionCode: 'QUANTITY_PRICE_UPDATE',
      targetType: 'QUANTITY_PRICE',
      targetId: params.id,
      before: { rules: before },
      after: { rule: result },
    }));
    return result;
  }

  @Delete(':type/:id')
  @RequirePermissions('price.write')
  async remove(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    if (!['levels', 'customers', 'quantities'].includes(type)) {
      return { deleted: false };
    }
    const result = await this.prices.remove(
      principal.tenantId,
      type as 'levels' | 'customers' | 'quantities',
      id,
    );
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRICE',
      actionCode: 'PRICE_RULE_DELETE',
      targetType: type.toUpperCase(),
      targetId: id,
      before: { id, type },
      after: { deleted: true },
    }));
    return result;
  }
}
