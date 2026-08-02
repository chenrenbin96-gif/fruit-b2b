import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

const statuses = ['ACTIVE', 'DISABLED'] as const;
const productStatuses = ['DRAFT', 'ON_SALE', 'OFF_SALE'] as const;
const saleTypes = ['PIECE', 'WEIGHT'] as const;

export class IdParamDto {
  @IsNumberString()
  id!: string;
}

export class CreateCategoryDto {
  @IsOptional()
  @IsNumberString()
  parent_id?: string;

  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  image?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number];
}

export class UpdateCategoryDto extends CreateCategoryDto {}

export class SortCategoryDto {
  @Type(() => Number)
  @IsInt()
  sort!: number;
}

export class CreateProductDto {
  @IsNumberString()
  category_id!: string;

  @IsString()
  @Length(1, 32)
  product_code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string;

  @IsString()
  @Length(1, 150)
  name!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  main_image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  origin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsIn(['A', 'B', 'C', '特级'])
  grade?: 'A' | 'B' | 'C' | '特级';

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @IsOptional()
  @IsNumberString()
  purchase_manager_id?: string;

  @IsOptional()
  @IsIn(productStatuses)
  status?: (typeof productStatuses)[number];
}

export class UpdateProductDto extends CreateProductDto {}

export class UpdateProductDisplayDto {
  @IsString()
  @Length(1, 150)
  name!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  main_image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  origin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsIn(['A', 'B', 'C', '特级'])
  grade?: 'A' | 'B' | 'C' | '特级';

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;
}

export class ProductBatchDto {
  @IsIn(['ON_SALE', 'OFF_SALE', 'DELETE'])
  action!: 'ON_SALE' | 'OFF_SALE' | 'DELETE';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsNumberString({}, { each: true })
  ids!: string[];
}

export class UpdateProductStatusDto {
  @IsIn(productStatuses)
  status!: (typeof productStatuses)[number];
}

export class CreateProductMediaDto {
  @IsIn(['VIDEO', 'IMAGE'])
  media_type!: 'VIDEO' | 'IMAGE';

  @IsString()
  @Matches(/^(\/uploads\/|https?:\/\/)/)
  @MaxLength(500)
  url!: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\/uploads\/|https?:\/\/)/)
  @MaxLength(500)
  thumbnail_url?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;
}

export class SortProductMediaDto {
  @Type(() => Number)
  @IsInt()
  sort!: number;
}

export class SaveProductDescriptionDto {
  @IsObject()
  content_json!: Record<string, unknown>;

  @Type(() => Number)
  @IsInt()
  sort!: number;
}

export class ProductListQueryDto {
  @IsOptional()
  @IsNumberString()
  category_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @IsIn(productStatuses)
  status?: (typeof productStatuses)[number];

  @IsOptional()
  @IsIn(saleTypes)
  sale_type?: (typeof saleTypes)[number];

  @IsOptional()
  @IsIn(['AVAILABLE', 'LOW', 'OUT'])
  inventory_status?: 'AVAILABLE' | 'LOW' | 'OUT';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size = 20;
}

export class CreateSkuDto {
  @IsNumberString()
  product_id!: string;

  @IsOptional()
  @IsNumberString()
  purchase_manager_id?: string;

  @IsString()
  @Length(1, 50)
  sku_code!: string;

  @IsString()
  @Length(1, 150)
  sku_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  specification?: string;

  @IsIn(saleTypes)
  sale_type!: (typeof saleTypes)[number];

  @ValidateIf(() => true)
  @IsString()
  @Length(1, 20)
  piece_unit?: string;

  @ValidateIf((dto: CreateSkuDto) => dto.sale_type === 'WEIGHT')
  @IsString()
  @Length(1, 20)
  weight_unit?: string;

  @ValidateIf((dto: CreateSkuDto) => dto.sale_type === 'WEIGHT')
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  standard_weight?: number;

  @ValidateIf((dto: CreateSkuDto) => dto.sale_type === 'WEIGHT')
  @IsIn(['ACTUAL_WEIGHT'])
  weight_price_type?: 'ACTUAL_WEIGHT';

  @ValidateIf((dto: CreateSkuDto) => dto.sale_type === 'WEIGHT')
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  gross_weight_unit_price?: number;

  @ValidateIf((dto: CreateSkuDto) => dto.sale_type === 'WEIGHT')
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  net_weight_unit_price?: number;

  @IsString()
  @Length(1, 20)
  stock_unit!: string;

  @IsString()
  @Length(1, 20)
  price_unit!: string;

  @ValidateIf((dto: CreateSkuDto) => dto.sale_type === 'PIECE')
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  delivery_weight_per_piece?: number;

  @ValidateIf((dto: CreateSkuDto) => dto.sale_type === 'PIECE')
  @IsIn(['斤', '公斤'])
  delivery_weight_unit?: '斤' | '公斤';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  cost_price!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  base_price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  market_price?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  stock_warning!: number;

  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number];
}

export class UpdateSkuDto extends CreateSkuDto {}

export class UpdateSkuStatusDto {
  @IsIn(statuses)
  status!: (typeof statuses)[number];
}

export class SkuListQueryDto {
  @IsOptional()
  @IsNumberString()
  product_id?: string;

  @IsOptional()
  @IsIn(saleTypes)
  sale_type?: (typeof saleTypes)[number];

  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number];

  @IsOptional()
  @IsNumberString()
  purchase_manager_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page_size = 20;
}
