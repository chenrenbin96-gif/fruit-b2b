import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsNumberString, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreateAfterSaleItemDto {
  @IsNumberString() order_item_id!: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) quantity?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) requested_weight?: number;
}
export class CreateAfterSaleMediaDto {
  @IsIn(['IMAGE', 'VIDEO']) media_type!: 'IMAGE' | 'VIDEO';
  @IsString() @MaxLength(1000) url!: string;
  @IsOptional() @IsString() @MaxLength(1000) thumbnail_url?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort = 0;
}
export class CreateAfterSaleDto {
  @IsNumberString() order_id!: string;
  @IsNumberString() reason_id!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsIn(['REFUND', 'COMPENSATION']) refund_type: 'REFUND' | 'COMPENSATION' = 'REFUND';
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => CreateAfterSaleItemDto) items!: CreateAfterSaleItemDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(9) @ValidateNested({ each: true }) @Type(() => CreateAfterSaleMediaDto) media: CreateAfterSaleMediaDto[] = [];
}
export class AfterSaleListQueryDto {
  @IsOptional() @IsIn(['PENDING','APPROVED','REJECTED','PROCESSING','COMPLETED','CANCELLED']) status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page_size = 20;
}
export class AdminAfterSaleListQueryDto extends AfterSaleListQueryDto {
  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
  @IsOptional() @IsNumberString() customer_id?: string;
  @IsOptional() @IsNumberString() reason_id?: string;
  @IsOptional() @IsString() start_date?: string;
  @IsOptional() @IsString() end_date?: string;
}
export class ReviewAfterSaleItemDto {
  @IsNumberString() id!: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) approved_quantity?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0) approved_weight?: number;
}
export class ApproveAfterSaleDto {
  @IsOptional() @IsIn(['REFUND', 'COMPENSATION']) refund_type?: 'REFUND' | 'COMPENSATION';
  @IsOptional() @IsString() @MaxLength(500) remark?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) refund_amount?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ReviewAfterSaleItemDto) items?: ReviewAfterSaleItemDto[];
}
export class RejectAfterSaleDto { @IsString() @MaxLength(500) reason!: string; }
export class UpdateAfterSaleDto extends ApproveAfterSaleDto {}
export class ReasonDto {
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sort = 0;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE';
}
