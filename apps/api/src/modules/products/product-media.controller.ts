import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import {
  CreateProductMediaDto,
  SortProductMediaDto,
} from './dto/product.dto';
import { ProductMediaService } from './product-media.service';

@Controller('admin/products/:productId/media')
@RequirePrincipalTypes('EMPLOYEE')
export class ProductMediaController {
  constructor(private readonly media: ProductMediaService) {}

  @Get()
  @RequirePermissions('product.media.read')
  list(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('productId') productId: string,
  ) {
    return this.media.list(principal.tenantId, productId);
  }

  @Post()
  @RequirePermissions('product.media.manage')
  create(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('productId') productId: string,
    @Body() dto: CreateProductMediaDto,
  ) {
    return this.media.create(principal.tenantId, productId, dto);
  }

  @Patch(':id/sort')
  @RequirePermissions('product.media.manage')
  sort(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('productId') productId: string,
    @Param('id') id: string,
    @Body() dto: SortProductMediaDto,
  ) {
    return this.media.sort(principal.tenantId, productId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('product.media.manage')
  remove(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('productId') productId: string,
    @Param('id') id: string,
  ) {
    return this.media.remove(principal.tenantId, productId, id);
  }
}
