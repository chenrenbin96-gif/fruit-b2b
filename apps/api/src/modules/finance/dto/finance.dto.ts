import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class FinanceListQueryDto {
  @IsOptional()
  @IsNumberString()
  customer_id?: string;
  @IsOptional()
  @IsDateString()
  start_time?: string;
  @IsOptional()
  @IsDateString()
  end_time?: string;
  @IsOptional()
  @IsIn(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'])
  status?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
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

export class UpdateCreditDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  credit_limit!: number;
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  credit_days!: number;
  @IsBoolean()
  credit_enabled!: boolean;
}

export class CreatePaymentDto {
  @IsNumberString()
  customer_id!: string;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
  @IsIn(['CASH', 'BANK_TRANSFER', 'WECHAT', 'ALIPAY'])
  payment_method!: 'CASH' | 'BANK_TRANSFER' | 'WECHAT' | 'ALIPAY';
  @IsDateString()
  payment_time!: string;
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class MonthlyStatementQueryDto {
  @IsNumberString()
  customer_id!: string;

  @IsString()
  @MaxLength(7)
  month!: string;
}

export class FinanceReportQueryDto {
  @IsIn(['DAY', 'WEEK', 'MONTH'])
  period!: 'DAY' | 'WEEK' | 'MONTH';

  @IsOptional()
  @IsDateString()
  date?: string;
}
