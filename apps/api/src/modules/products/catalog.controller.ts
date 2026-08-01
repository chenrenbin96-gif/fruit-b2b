import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { CategoriesService } from './categories.service';
import { CalculatePriceDto } from './dto/price.dto';
import {
  IdParamDto,
  ProductListQueryDto,
} from './dto/product.dto';
import { PriceService } from './price.service';
import { ProductsService } from './products.service';

@Controller('catalog')
@RequirePrincipalTypes('EMPLOYEE', 'CUSTOMER_ACCOUNT')
export class CatalogController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly products: ProductsService,
    private readonly prices: PriceService,
  ) {}

  @Get('categories/tree')
  tree(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.categories.tree(principal.tenantId, true);
  }

  @Get('products')
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: ProductListQueryDto,
  ) {
    return this.products.list(principal.tenantId, query, {
      catalogOnly: principal.principalType === 'CUSTOMER_ACCOUNT',
      customerId: principal.customerId,
    });
  }

  @Get('filters')
  filters(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query('category_id') categoryId?: string,
  ) {
    return this.products.catalogFilters(principal.tenantId, categoryId);
  }

  @Get('products/recommendations')
  recommendations(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.products.recommendations(
      principal.tenantId,
      principal.customerId,
    );
  }

  @Get('products/:id')
  detail(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.products.detail(principal.tenantId, params.id, {
      catalogOnly: principal.principalType === 'CUSTOMER_ACCOUNT',
      customerId: principal.customerId,
    });
  }

  @Post('prices/calculate')
  calculate(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CalculatePriceDto,
  ) {
    return this.prices.calculateSkuPrice({
      tenantId: principal.tenantId,
      skuId: dto.sku_id,
      customerId:
        principal.principalType === 'CUSTOMER_ACCOUNT'
          ? principal.customerId
          : dto.customer_id,
      purchaseQuantity: dto.purchase_quantity,
    });
  }
}
