import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsArray,
  IsIn,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsBoolean,
  IsInt,
  ValidateNested,
} from 'class-validator';

export class SupplierListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';
}

export class SaveSupplierDto {
  @IsString()
  @MaxLength(150)
  supplier_name!: string;

  @IsString()
  @MaxLength(50)
  contact_name!: string;

  @IsString()
  @MaxLength(30)
  phone!: string;

  @IsString()
  @MaxLength(255)
  address!: string;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  supply_categories!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';

  @IsOptional()
  @IsString()
  @MaxLength(30)
  settlement_method?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  credit_days?: number;
}

export class PurchaseOrderItemInputDto {
  @IsNumberString()
  sku_id!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  purchase_price!: number;
}

export class SavePurchaseOrderDto {
  @IsNumberString()
  supplier_id!: string;

  @IsNumberString()
  warehouse_id!: string;

  @IsOptional()
  @IsDateString()
  purchase_date?: string;

  @IsOptional()
  @IsIn(['MARKET', 'SUPPLIER'])
  purchase_type?: 'MARKET' | 'SUPPLIER';

  @IsOptional()
  @IsIn(['MANUAL', 'PLAN', 'IMPORT'])
  source_type?: 'MANUAL' | 'PLAN' | 'IMPORT';

  @IsOptional()
  @IsNumberString()
  responsible_person_id?: string;

  @IsOptional()
  @IsNumberString()
  purchaser_id?: string;

  @IsOptional()
  @IsDateString()
  planned_delivery_date?: string;

  @IsOptional()
  @IsIn(['ADDED', 'CATEGORY'])
  sort_mode?: 'ADDED' | 'CATEGORY';

  @IsOptional()
  @IsBoolean()
  update_last_purchase_price?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemInputDto)
  items!: PurchaseOrderItemInputDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class PurchaseOrderListQueryDto {
  @IsOptional()
  @IsIn([
    'PENDING_PURCHASE',
    'PURCHASING',
    'ARRIVED',
    'PARTIALLY_RECEIVED',
    'RECEIVED',
    'COMPLETED',
    'STOCKED',
    'CANCELLED',
  ])
  status?:
    | 'PENDING_PURCHASE'
    | 'PURCHASING'
    | 'ARRIVED'
    | 'PARTIALLY_RECEIVED'
    | 'RECEIVED'
    | 'COMPLETED'
    | 'STOCKED'
    | 'CANCELLED';

  @IsOptional()
  @IsNumberString()
  supplier_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @IsIn(['MARKET', 'SUPPLIER'])
  purchase_type?: 'MARKET' | 'SUPPLIER';

  @IsOptional()
  @IsNumberString()
  purchaser_id?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}

export class ReceivePurchaseItemDto {
  @IsNumberString()
  purchase_order_item_id!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  received_quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  gross_weight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  net_weight?: number;
}

export class SaveSupplierProductDto {
  @IsNumberString()
  sku_id!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  purchase_price!: number;
}

export class PurchaseReturnItemDto {
  @IsNumberString()
  purchase_order_item_id!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  return_quantity!: number;
}

export class CreatePurchaseReturnDto {
  @IsNumberString()
  purchase_order_id!: string;

  @IsString()
  @MaxLength(255)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseReturnItemDto)
  items!: PurchaseReturnItemDto[];
}

export class UpdatePurchaseReturnDto {
  @IsIn(['APPROVED', 'COMPLETED', 'CANCELLED'])
  status!: 'APPROVED' | 'COMPLETED' | 'CANCELLED';
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseItemDto)
  items!: ReceivePurchaseItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
