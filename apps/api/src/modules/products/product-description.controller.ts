import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { SaveProductDescriptionDto } from './dto/product.dto';
import { ProductDescriptionService } from './product-description.service';

@Controller('admin/products/:productId/descriptions')
@RequirePrincipalTypes('EMPLOYEE')
export class ProductDescriptionController {
  constructor(private readonly descriptions: ProductDescriptionService) {}

  @Get()
  @RequirePermissions('product.media.read')
  list(@CurrentPrincipal() principal: AuthPrincipal, @Param('productId') productId: string) {
    return this.descriptions.list(principal.tenantId, productId);
  }

  @Post()
  @RequirePermissions('product.media.manage')
  create(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('productId') productId: string,
    @Body() dto: SaveProductDescriptionDto,
  ) {
    return this.descriptions.create(principal.tenantId, productId, dto);
  }

  @Put(':id')
  @RequirePermissions('product.media.manage')
  update(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('productId') productId: string,
    @Param('id') id: string,
    @Body() dto: SaveProductDescriptionDto,
  ) {
    return this.descriptions.update(principal.tenantId, productId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('product.media.manage')
  remove(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('productId') productId: string,
    @Param('id') id: string,
  ) {
    return this.descriptions.remove(principal.tenantId, productId, id);
  }
}
