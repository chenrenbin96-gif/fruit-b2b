import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import {
  SaveHomeBannerDto,
  SaveHomeCategoryDto,
  SaveHomeProductDto,
  SaveHomeRecommendationDto,
} from './dto/home-operation.dto';
import { IdParamDto } from './dto/product.dto';
import { HomeOperationsService } from './home-operations.service';

@Controller('catalog/home')
@RequirePrincipalTypes('CUSTOMER_ACCOUNT')
export class CatalogHomeController {
  constructor(private readonly homeOperations: HomeOperationsService) {}

  @Get()
  home(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.homeOperations.home(
      principal.tenantId,
      principal.customerId,
    );
  }
}

@Controller('home')
@RequirePrincipalTypes('CUSTOMER_ACCOUNT')
export class HomeConfigController {
  constructor(private readonly homeOperations: HomeOperationsService) {}

  @Get('config')
  config(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.homeOperations.config(
      principal.tenantId,
      principal.customerId!,
    );
  }
}

@Controller('admin/home-operations')
@RequirePrincipalTypes('EMPLOYEE')
export class AdminHomeOperationsController {
  constructor(private readonly homeOperations: HomeOperationsService) {}

  @Get()
  @RequirePermissions('product.read')
  data(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.homeOperations.adminData(principal.tenantId);
  }

  @Post('banners')
  @RequirePermissions('home.operation.manage')
  createBanner(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: SaveHomeBannerDto,
  ) {
    return this.homeOperations.createBanner(principal.tenantId, dto);
  }

  @Put('banners/:id')
  @RequirePermissions('home.operation.manage')
  updateBanner(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: SaveHomeBannerDto,
  ) {
    return this.homeOperations.updateBanner(
      principal.tenantId,
      params.id,
      dto,
    );
  }

  @Delete('banners/:id')
  @RequirePermissions('home.operation.manage')
  removeBanner(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.homeOperations.removeBanner(principal.tenantId, params.id);
  }

  @Post('categories')
  @RequirePermissions('home.operation.manage')
  createCategory(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: SaveHomeCategoryDto,
  ) {
    return this.homeOperations.createCategory(principal.tenantId, dto);
  }

  @Put('categories/:id')
  @RequirePermissions('home.operation.manage')
  updateCategory(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: SaveHomeCategoryDto,
  ) {
    return this.homeOperations.updateCategory(
      principal.tenantId,
      params.id,
      dto,
    );
  }

  @Delete('categories/:id')
  @RequirePermissions('home.operation.manage')
  removeCategory(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.homeOperations.removeCategory(principal.tenantId, params.id);
  }

  @Post('products')
  @RequirePermissions('home.operation.manage')
  createProduct(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: SaveHomeProductDto,
  ) {
    return this.homeOperations.createProduct(principal.tenantId, dto);
  }

  @Put('products/:id')
  @RequirePermissions('home.operation.manage')
  updateProduct(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: SaveHomeProductDto,
  ) {
    return this.homeOperations.updateProduct(
      principal.tenantId,
      params.id,
      dto,
    );
  }

  @Delete('products/:id')
  @RequirePermissions('home.operation.manage')
  removeProduct(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.homeOperations.removeProduct(principal.tenantId, params.id);
  }

  @Post('recommendations')
  @RequirePermissions('home.operation.manage')
  createRecommendation(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: SaveHomeRecommendationDto,
  ) {
    return this.homeOperations.createRecommendation(principal.tenantId, dto);
  }

  @Put('recommendations/:id')
  @RequirePermissions('home.operation.manage')
  updateRecommendation(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: SaveHomeRecommendationDto,
  ) {
    return this.homeOperations.updateRecommendation(
      principal.tenantId,
      params.id,
      dto,
    );
  }

  @Delete('recommendations/:id')
  @RequirePermissions('home.operation.manage')
  removeRecommendation(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.homeOperations.removeRecommendation(
      principal.tenantId,
      params.id,
    );
  }
}
