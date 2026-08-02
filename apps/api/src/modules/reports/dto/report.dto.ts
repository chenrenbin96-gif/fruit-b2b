import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const reportTypes=['business','products','orders','customers','purchases','estimated-margin','sales-margin','profit'] as const;
export class ReportTypeDto { @IsIn(reportTypes) type!: typeof reportTypes[number]; }
export class ReportQueryDto {
  @IsOptional() @IsDateString() date_from?:string;
  @IsOptional() @IsDateString() date_to?:string;
  @IsOptional() @IsString() @MaxLength(100) keyword?:string;
  @IsOptional() @IsString() region_id?:string;
  @IsOptional() @IsString() salesperson_id?:string;
  @IsOptional() @IsString() purchase_manager_id?:string;
  @IsOptional() @IsString() supplier_id?:string;
  @IsOptional() @IsString() category_id?:string;
  @IsOptional() @IsString() category_parent_id?:string;
  @IsOptional() @IsString() brand?:string;
  @IsOptional() @IsString() customer_type_id?:string;
  @IsOptional() @IsString() delivery_region_id?:string;
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(50) top=10;
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) page=1;
  @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) page_size=20;
}

export const biReportTypes=['inventory','delivery','finance','salespersons','customers','products','purchases'] as const;
export class BiReportTypeDto { @IsIn(biReportTypes) type!: typeof biReportTypes[number]; }
export class BiExportQueryDto extends ReportQueryDto {
  @IsOptional() @IsIn(['xlsx','csv','pdf']) format:'xlsx'|'csv'|'pdf'='xlsx';
  @IsOptional() @IsIn(['page','all','filtered']) scope:'page'|'all'|'filtered'='filtered';
}
