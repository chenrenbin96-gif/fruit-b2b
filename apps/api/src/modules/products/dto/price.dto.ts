import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsNumberString,
  IsOptional,
  Min,
} from 'class-validator';

const statuses = ['ACTIVE', 'DISABLED'] as const;

export class CalculatePriceDto {
  @IsNumberString()
  sku_id!: string;

  @IsOptional()
  @IsNumberString()
  customer_id?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  purchase_quantity!: number;
}

export class PriceListQueryDto {
  @IsOptional()
  @IsNumberString()
  sku_id?: string;
}

export class UpsertLevelPriceDto {
  @IsNumberString()
  level_id!: string;

  @IsNumberString()
  sku_id!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  price!: number;

  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number];
}

export class UpsertCustomerPriceDto {
  @IsNumberString()
  customer_id!: string;

  @IsNumberString()
  sku_id!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  price!: number;

  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number];
}

export class CreateQuantityPriceDto {
  @IsNumberString()
  sku_id!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  min_quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  max_quantity?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  price!: number;

  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number];
}

export class UpdateQuantityPriceDto extends CreateQuantityPriceDto {}
