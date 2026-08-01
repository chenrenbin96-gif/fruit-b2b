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
import { IdParamDto } from '../products/dto/product.dto';
import {
  CouponListQueryDto,
  IssueCouponDto,
  SaveCouponDto,
} from './dto/coupon.dto';
import { CouponsService } from './coupons.service';

@Controller('admin/coupons')
@RequirePrincipalTypes('EMPLOYEE')
@RequirePermissions('coupon.manage')
export class AdminCouponsController {
  constructor(
    private readonly coupons: CouponsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: CouponListQueryDto,
  ) {
    return this.coupons.adminList(principal.tenantId, query);
  }

  @Post()
  async create(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: SaveCouponDto,
  ) {
    const result = await this.coupons.create(
      principal.tenantId,
      principal.userId ?? '',
      dto,
    );
    await this.couponAudit(principal, 'COUPON_CREATE', result.id, null, result);
    return result;
  }

  @Put(':id')
  async update(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: SaveCouponDto,
  ) {
    const before = await this.couponSnapshot(principal.tenantId, params.id);
    const result = await this.coupons.update(principal.tenantId, params.id, dto);
    await this.couponAudit(principal, 'COUPON_UPDATE', params.id, before, result);
    return result;
  }

  @Delete(':id')
  async disable(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    const before = await this.couponSnapshot(principal.tenantId, params.id);
    const result = await this.coupons.disable(principal.tenantId, params.id);
    await this.couponAudit(principal, 'COUPON_DISABLE', params.id, before, result);
    return result;
  }

  @Post(':id/issue')
  async issue(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: IssueCouponDto,
  ) {
    const result = await this.coupons.issue(
      principal.tenantId,
      params.id,
      dto.customer_ids,
    );
    await this.couponAudit(
      principal,
      'COUPON_ISSUE',
      params.id,
      null,
      { ...result, customer_ids: dto.customer_ids },
    );
    return result;
  }

  @Get(':id/customer-coupons')
  issuedCustomers(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.coupons.issuedCustomers(principal.tenantId, params.id);
  }

  @Get(':id/records')
  records(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.coupons.usageRecords(principal.tenantId, params.id);
  }

  private async couponSnapshot(tenantId: string, id: string) {
    const page = await this.coupons.adminList(tenantId, {
      page: 1,
      page_size: 100,
    });
    return page.items.find((item) => item.id === id) ?? null;
  }

  private couponAudit(
    principal: AuthPrincipal,
    actionCode: string,
    targetId: string,
    before: unknown,
    after: unknown,
  ) {
    return this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'COUPON',
      actionCode,
      targetType: 'COUPON',
      targetId,
      before: { snapshot: before as object | null },
      after: { snapshot: after as object },
    }));
  }
}
