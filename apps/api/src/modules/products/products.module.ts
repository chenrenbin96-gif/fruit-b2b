import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  CustomerEntity,
  CustomerLevelEntity,
} from '../customers/entities/customer.entities';
import { InventoryEntity } from '../inventory/entities/inventory.entities';
import { AdminPricesController } from './admin-prices.controller';
import { AdminProductsController } from './admin-products.controller';
import { CatalogController } from './catalog.controller';
import { CategoriesService } from './categories.service';
import {
  CustomerPriceEntity,
  PriceLevelEntity,
  QuantityPriceEntity,
} from './entities/price.entities';
import {
  CategoryEntity,
  ProductEntity,
  SkuEntity,
} from './entities/product.entities';
import {
  HomeBannerEntity,
  HomeCategoryEntity,
  HomeProductEntity,
  HomeProductRecommendationEntity,
} from './entities/home-operation.entities';
import {
  AdminHomeOperationsController,
  CatalogHomeController,
  HomeConfigController,
} from './home-operations.controller';
import { HomeOperationsService } from './home-operations.service';
import { PriceService } from './price.service';
import { ProductMediaController } from './product-media.controller';
import { ProductMediaService } from './product-media.service';
import { ProductMediaEntity } from './entities/product-media.entity';
import { ProductDescriptionEntity } from './entities/product-description.entity';
import { ProductDescriptionController } from './product-description.controller';
import { ProductDescriptionService } from './product-description.service';
import { ProductsService } from './products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CategoryEntity,
      ProductEntity,
      SkuEntity,
      InventoryEntity,
      CustomerEntity,
      CustomerLevelEntity,
      PriceLevelEntity,
      CustomerPriceEntity,
      QuantityPriceEntity,
      HomeBannerEntity,
      HomeCategoryEntity,
      HomeProductEntity,
      HomeProductRecommendationEntity,
      ProductMediaEntity,
      ProductDescriptionEntity,
    ]),
  ],
  controllers: [
    CatalogController,
    AdminProductsController,
    AdminPricesController,
    CatalogHomeController,
    HomeConfigController,
    AdminHomeOperationsController,
    ProductMediaController,
    ProductDescriptionController,
  ],
  providers: [
    CategoriesService,
    ProductsService,
    PriceService,
    HomeOperationsService,
    ProductMediaService,
    ProductDescriptionService,
  ],
  exports: [TypeOrmModule, ProductsService, PriceService],
})
export class ProductsModule {}
