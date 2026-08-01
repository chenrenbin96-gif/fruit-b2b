import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNumber,
  IsNumberString,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export class WeightItemDto {
  @IsNumberString()
  order_item_id!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  actual_weight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  actual_gross_weight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  actual_net_weight?: number;
}

export class CompleteWeighingDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => WeightItemDto)
  items!: WeightItemDto[];
}
