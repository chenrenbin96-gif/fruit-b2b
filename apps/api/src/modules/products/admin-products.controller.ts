import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { CategoriesService } from './categories.service';
import {
  CreateCategoryDto,
  CreateProductDto,
  CreateSkuDto,
  IdParamDto,
  ProductBatchDto,
  ProductListQueryDto,
  SkuListQueryDto,
  SortCategoryDto,
  UpdateCategoryDto,
  UpdateProductDto,
  UpdateProductDisplayDto,
  UpdateProductStatusDto,
  UpdateSkuDto,
  UpdateSkuStatusDto,
} from './dto/product.dto';
import { ProductsService } from './products.service';

@Controller('admin')
@RequirePrincipalTypes('EMPLOYEE')
export class AdminProductsController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly products: ProductsService,
    private readonly audit: AuditService,
  ) {}

  @Get('categories/tree')
  @RequirePermissions('product.read')
  categoryTree(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.categories.tree(principal.tenantId);
  }

  @Post('categories')
  @RequirePermissions('product.write')
  createCategory(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categories.create(principal.tenantId, dto);
  }

  @Put('categories/:id')
  @RequirePermissions('product.write')
  updateCategory(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(principal.tenantId, params.id, dto);
  }

  @Patch('categories/:id/sort')
  @RequirePermissions('product.write')
  sortCategory(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: SortCategoryDto,
  ) {
    return this.categories.updateSort(principal.tenantId, params.id, dto.sort);
  }

  @Delete('categories/:id')
  @RequirePermissions('product.write')
  removeCategory(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.categories.remove(principal.tenantId, params.id);
  }

  @Get('products')
  @RequirePermissions('product.read')
  listProducts(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: ProductListQueryDto,
  ) {
    return this.products.list(principal.tenantId, query);
  }

  @Get('products/purchase-managers')
  @RequirePermissions('product.read')
  purchaseManagers(@CurrentPrincipal() principal:AuthPrincipal){return this.products.purchaseManagers(principal.tenantId);}

  @Post('products/batch')
  @RequirePermissions('product.manage')
  async batchProducts(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: ProductBatchDto,
  ) {
    const result = await this.products.batch(principal.tenantId, dto);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRODUCT',
      actionCode: `PRODUCT_BATCH_${dto.action}`,
      targetType: 'PRODUCT_BATCH',
      before: null,
      after: { ids: dto.ids, result },
    }));
    return result;
  }

  @Get('products/:id/workbench')
  @RequirePermissions('product.read')
  productWorkbench(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.products.workbench(principal.tenantId, params.id);
  }

  @Get('products/:id')
  @RequirePermissions('product.read')
  productDetail(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    return this.products.detail(principal.tenantId, params.id);
  }

  @Post('products')
  @RequirePermissions('product.write')
  async createProduct(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CreateProductDto,
  ) {
    const result = await this.products.create(principal.tenantId, dto);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRODUCT',
      actionCode: 'PRODUCT_CREATE',
      targetType: 'PRODUCT',
      targetId: result.id,
      before: null,
      after: { product: result },
    }));
    return result;
  }

  @Put('products/:id')
  @RequirePermissions('product.write')
  async updateProduct(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: UpdateProductDto,
  ) {
    const before = await this.products.detail(principal.tenantId, params.id);
    const result = await this.products.update(principal.tenantId, params.id, dto);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRODUCT',
      actionCode: 'PRODUCT_UPDATE',
      targetType: 'PRODUCT',
      targetId: params.id,
      before: { product: before },
      after: { product: result },
    }));
    return result;
  }

  @Patch('products/:id/display')
  @RequirePermissions('product.display.write')
  async updateProductDisplay(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: UpdateProductDisplayDto,
  ) {
    const before = await this.products.detail(principal.tenantId, params.id);
    const result = await this.products.updateDisplay(
      principal.tenantId,
      params.id,
      dto,
    );
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRODUCT',
      actionCode: 'PRODUCT_DISPLAY_UPDATE',
      targetType: 'PRODUCT',
      targetId: params.id,
      before: { product: before },
      after: { product: result },
    }));
    return result;
  }

  @Patch('products/:id/status')
  @RequirePermissions('product.write')
  async productStatus(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: UpdateProductStatusDto,
  ) {
    const before = await this.products.detail(principal.tenantId, params.id);
    const result = await this.products.updateStatus(
      principal.tenantId,
      params.id,
      dto.status,
    );
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRODUCT',
      actionCode: 'PRODUCT_STATUS_UPDATE',
      targetType: 'PRODUCT',
      targetId: params.id,
      before: { status: before.status },
      after: { status: result.status },
    }));
    return result;
  }

  @Post('products/:id/duplicate')
  @RequirePermissions('product.manage')
  async duplicateProduct(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    const result = await this.products.duplicate(principal.tenantId, params.id);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRODUCT',
      actionCode: 'PRODUCT_DUPLICATE',
      targetType: 'PRODUCT',
      targetId: result.id,
      before: { source_product_id: params.id },
      after: { product: result },
    }));
    return result;
  }

  @Delete('products/:id')
  @RequirePermissions('product.manage')
  async removeProduct(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    const before = await this.products.detail(principal.tenantId, params.id);
    const result = await this.products.remove(principal.tenantId, params.id);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRODUCT',
      actionCode: 'PRODUCT_DELETE',
      targetType: 'PRODUCT',
      targetId: params.id,
      before: { product: before },
      after: { deleted: true },
    }));
    return result;
  }

  @Get('skus')
  @RequirePermissions('product.read')
  listSkus(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: SkuListQueryDto,
  ) {
    return this.products.listSkus(principal.tenantId, query);
  }

  @Post('skus')
  @RequirePermissions('product.sku.write')
  async createSku(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CreateSkuDto,
  ) {
    const result = await this.products.createSku(principal.tenantId, dto);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRODUCT',
      actionCode: 'SKU_CREATE',
      targetType: 'SKU',
      targetId: result.id,
      before: null,
      after: { sku: result },
    }));
    return result;
  }

  @Put('skus/:id')
  @RequirePermissions('product.sku.write')
  async updateSku(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: UpdateSkuDto,
  ) {
    const before = await this.products.listSkus(principal.tenantId, {
      product_id: dto.product_id,
      page: 1,
      page_size: 100,
    });
    const result = await this.products.updateSku(principal.tenantId, params.id, dto);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRODUCT',
      actionCode: 'SKU_UPDATE',
      targetType: 'SKU',
      targetId: params.id,
      before: { sku: before.items.find((item) => item.id === params.id) ?? null },
      after: { sku: result },
    }));
    return result;
  }

  @Patch('skus/:id/status')
  @RequirePermissions('product.sku.write')
  async skuStatus(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: UpdateSkuStatusDto,
  ) {
    const result = await this.products.updateSkuStatus(
      principal.tenantId,
      params.id,
      dto.status,
    );
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRODUCT',
      actionCode: 'SKU_STATUS_UPDATE',
      targetType: 'SKU',
      targetId: params.id,
      before: null,
      after: { status: result.status },
    }));
    return result;
  }

  @Delete('skus/:id')
  @RequirePermissions('product.sku.write')
  async removeSku(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
  ) {
    const result = await this.products.removeSku(principal.tenantId, params.id);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'PRODUCT',
      actionCode: 'SKU_DELETE',
      targetType: 'SKU',
      targetId: params.id,
      before: null,
      after: { deleted: true },
    }));
    return result;
  }
}
