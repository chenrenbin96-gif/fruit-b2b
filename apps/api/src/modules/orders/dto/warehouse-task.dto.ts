import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsNumberString,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class WarehouseTaskListQueryDto {
  @IsOptional()
  @IsIn([
    'WAITING_REVIEW',
    'WAITING_PICKING',
    'PICKING',
    'WAITING_WEIGHING',
    'WAITING_OUTBOUND',
    'DELIVERING',
    'COMPLETED',
  ])
  stage?: string;

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

export class CompletePickingItemDto {
  @IsNumberString()
  task_item_id!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  picked_quantity!: number;
}

export class CompletePickingDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CompletePickingItemDto)
  items!: CompletePickingItemDto[];
}
