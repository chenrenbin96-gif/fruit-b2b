import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class InventoryListQueryDto {
  @IsOptional()
  @IsNumberString()
  warehouse_id?: string;

  @IsOptional()
  @IsNumberString()
  sku_id?: string;
}

export class AdjustInventoryDto {
  @IsNumberString()
  warehouse_id!: string;

  @IsNumberString()
  sku_id!: string;

  @IsIn(['ADJUST_IN', 'ADJUST_OUT', 'SET'])
  operation_type!: 'ADJUST_IN' | 'ADJUST_OUT' | 'SET';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantity!: number;

  @IsString()
  @MaxLength(500)
  reason!: string;
}
