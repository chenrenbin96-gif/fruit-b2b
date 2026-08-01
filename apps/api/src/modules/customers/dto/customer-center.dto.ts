import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsNumberString, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CustomerCenterQueryDto {
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsNumberString() customer_type_id?: string;
  @IsOptional() @IsNumberString() delivery_region_id?: string;
  @IsOptional() @IsNumberString() salesperson_id?: string;
  @IsOptional() @IsIn(['ACTIVE', 'PENDING', 'DISABLED']) status?: string;
  @IsOptional() @IsDateString() date_from?: string;
  @IsOptional() @IsDateString() date_to?: string;
  @IsOptional() @IsNumberString() customer_tag_id?: string;
}

const arrayQuery = ({ value, obj }: { value: unknown; obj: Record<string, unknown> }) => {
  const source = value ?? obj['ids[]'];
  if (source === undefined || source === null || source === '') return undefined;
  return Array.isArray(source) ? source : String(source).split(',');
};

export class CustomerExportQueryDto extends CustomerCenterQueryDto {
  @IsOptional() @Transform(arrayQuery) @IsArray() @IsNumberString({}, { each: true }) ids?: string[];
  @IsOptional() @Transform(arrayQuery) @IsArray() @IsNumberString({}, { each: true }) 'ids[]'?: string[];
  @IsOptional() @IsIn(['ALL', 'FILTERED', 'SELECTED']) export_type?: 'ALL' | 'FILTERED' | 'SELECTED';
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() include_statistics?: boolean;
}

export class SaveCustomerCenterDto {
  @IsOptional() @IsString() @MaxLength(50) account_name?: string;
  @IsOptional() @IsString() @MaxLength(100) password?: string;
  @IsString() @MaxLength(150) customer_name!: string;
  @IsString() @MaxLength(50) contact_name!: string;
  @IsString() @MaxLength(30) phone!: string;
  @IsString() @MaxLength(255) address!: string;
  @IsOptional() @IsString() @MaxLength(32) customer_no?: string;
  @IsOptional() @IsNumberString() customer_type_id?: string;
  @IsOptional() @IsNumberString() group_id?: string;
  @IsOptional() @IsNumberString() level_id?: string;
  @IsOptional() @IsNumberString() delivery_region_id?: string;
  @IsOptional() @IsNumberString() salesperson_id?: string;
  @IsOptional() @IsArray() @IsNumberString({}, { each: true }) tag_ids?: string[];
  @IsOptional() @IsIn(['ACTIVE', 'PENDING', 'DISABLED']) status?: string;
  @IsOptional() @IsString() business_type?: string;
  @IsOptional() @IsString() unified_social_credit_code?: string;
  @IsOptional() @IsIn(['UNVERIFIED','PENDING','VERIFIED','REJECTED']) certification_status?: string;
  @IsOptional() @IsString() default_route?: string;
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
  @IsOptional() @IsString() delivery_time?: string;
  @IsOptional() @IsString() receiving_cycle?: string;
  @IsOptional() @IsBoolean() cod_enabled?: boolean;
  @IsOptional() @IsBoolean() online_payment_enabled?: boolean;
  @IsOptional() @IsBoolean() balance_payment_enabled?: boolean;
  @IsOptional() @IsBoolean() credit_payment_enabled?: boolean;
  @IsOptional() @IsIn(['SYSTEM','ENABLED','DISABLED']) order_review_mode?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) min_order_amount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.0001) discount_rate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) credit_limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) credit_days?: number;
  @IsOptional() @IsString() settlement_type?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) debt_limit?: number;
  @IsOptional() print_templates?: Record<string, string>;
}

export class SaveCustomerTypeDto {
  @IsString() name!: string;
  @Type(() => Number) @IsNumber() @Min(0.0001) default_discount!: number;
  @Type(() => Number) @IsInt() @Min(0) default_credit_days!: number;
  @IsOptional() @IsNumberString() default_delivery_region_id?: string;
  @IsOptional() @IsIn(['ACTIVE','DISABLED']) status?: string;
}
export class SaveCustomerGroupDto {
  @IsString() group_name!: string; @IsString() contact_name!: string;
  @IsString() phone!: string; @IsString() address!: string;
  @IsOptional() @IsBoolean() unified_settlement?: boolean;
  @IsOptional() @IsIn(['ACTIVE','DISABLED']) status?: string;
}
export class SaveCustomerTagDto {
  @IsString() tag_name!: string; @IsString() color!: string;
  @Type(() => Number) @IsInt() sort!: number;
  @IsOptional() @IsIn(['ACTIVE','DISABLED']) status?: string;
}
export class SaveCustomerAgreementDto {
  @IsNumberString() customer_id!: string; @IsNumberString() sku_id!: string;
  @Type(() => Number) @IsNumber() @Min(0) agreement_price!: number;
  @IsDateString() start_time!: string; @IsOptional() @IsDateString() end_time?: string;
  @IsOptional() @IsIn(['ACTIVE','DISABLED']) status?: string;
}
export class AdjustCustomerCreditDto {
  @Type(() => Number) @IsNumber() @Min(0) credit_limit!: number;
  @Type(() => Number) @IsInt() @Min(0) credit_days!: number;
  @IsBoolean() credit_enabled!: boolean; @IsString() @MaxLength(500) reason!: string;
}
