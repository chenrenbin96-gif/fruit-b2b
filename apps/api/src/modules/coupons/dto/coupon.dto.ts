import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

const couponTypes = [
  'ORDER_REDUCTION',
  'PRODUCT',
  'CATEGORY',
  'NEW_CUSTOMER',
  'CUSTOMER_EXCLUSIVE',
] as const;

export class SaveCouponDto {
  @IsString()
  @Length(1, 150)
  name!: string;

  @IsIn(couponTypes)
  coupon_type!: (typeof couponTypes)[number];

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  discount_amount!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  min_amount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  total_limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  per_customer_limit?: number;

  @IsDateString()
  start_time!: string;

  @IsDateString()
  end_time!: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'DISABLED'])
  status?: 'DRAFT' | 'ACTIVE' | 'DISABLED';

  @IsOptional()
  @IsArray()
  @IsNumberString({}, { each: true })
  product_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsNumberString({}, { each: true })
  category_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsNumberString({}, { each: true })
  level_ids?: string[];
}

export class IssueCouponDto {
  @IsArray()
  @IsNumberString({}, { each: true })
  customer_ids!: string[];
}

export class CouponListQueryDto {
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'DISABLED'])
  status?: string;

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
