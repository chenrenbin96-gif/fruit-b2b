import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class EstimateShippingDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  weight!: number;

  @IsIn(['斤', '公斤'])
  weight_unit!: '斤' | '公斤';

  @IsOptional()
  @IsNumberString()
  delivery_region_id?: string;
}

export class UpdateShippingRuleDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsIn(['WEIGHT', 'FIXED'])
  calculation_type!: 'WEIGHT' | 'FIXED';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  price_per_weight?: number;

  @IsOptional()
  @IsIn(['斤', '公斤'])
  weight_unit?: '斤' | '公斤';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fixed_fee?: number;

  @IsIn(['ACTIVE', 'DISABLED'])
  status!: 'ACTIVE' | 'DISABLED';
}

export class CreateShippingRuleDto extends UpdateShippingRuleDto {
  @IsNumberString()
  delivery_region_id!: string;
}

export class CreateDeliveryRegionDto {
  @IsString()
  @Length(1, 32)
  region_code!: string;

  @IsString()
  @Length(1, 100)
  region_name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  address_keywords?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  min_order_amount!: number;

  @IsBoolean()
  is_default!: boolean;

  @Type(() => Number)
  @IsNumber()
  sort!: number;

  @IsIn(['ACTIVE', 'DISABLED'])
  status!: 'ACTIVE' | 'DISABLED';
}

export class UpdateDeliveryRegionDto extends CreateDeliveryRegionDto {}
