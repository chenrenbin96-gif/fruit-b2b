import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class AddCartItemDto {
  @IsNumberString()
  sku_id!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  estimated_weight?: number;
}

export class UpdateCartItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  estimated_weight?: number;
}

export class BatchAddCartDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AddCartItemDto)
  items!: AddCartItemDto[];
}

export class SubmitCartDto {
  @IsOptional()
  @IsNumberString()
  customer_coupon_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class CancelOrderDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class ReviewOrderDto {
  @IsIn(['APPROVE', 'REJECT'])
  action!: 'APPROVE' | 'REJECT';

  @ValidateIf((dto: ReviewOrderDto) => dto.action === 'REJECT')
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CustomerOrderListQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'])
  group?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

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

export class AdminOrderListQueryDto {
  @IsOptional()
  @IsIn([
    'CREATED',
    'WAITING_REVIEW',
    'APPROVED',
    'PICKING',
    'WEIGHING',
    'WAITING_DELIVERY',
    'DELIVERING',
    'COMPLETED',
    'CANCELLED',
  ])
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

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
