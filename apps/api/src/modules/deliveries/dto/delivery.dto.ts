import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class DeliveryListQueryDto {
  @IsOptional()
  @IsIn(['WAITING', 'DELIVERING', 'DELIVERED', 'FAILED'])
  status?: 'WAITING' | 'DELIVERING' | 'DELIVERED' | 'FAILED';

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

export class AssignDeliveryDto {
  @IsNumberString()
  delivery_person_id!: string;
}

export class UpdateDeliveryStatusDto {
  @IsIn(['DELIVERING', 'DELIVERED', 'FAILED'])
  status!: 'DELIVERING' | 'DELIVERED' | 'FAILED';

  @ValidateIf((dto: UpdateDeliveryStatusDto) => dto.status === 'DELIVERED')
  @IsString()
  @MaxLength(50)
  signed_by?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ValidateIf((dto: UpdateDeliveryStatusDto) => dto.status === 'FAILED')
  @IsIn(['CUSTOMER_REJECTED', 'UNREACHABLE', 'ADDRESS_ERROR', 'OTHER'])
  reason_code?:
    | 'CUSTOMER_REJECTED'
    | 'UNREACHABLE'
    | 'ADDRESS_ERROR'
    | 'OTHER';

  @ValidateIf((dto: UpdateDeliveryStatusDto) => dto.status === 'FAILED')
  @IsString()
  @MaxLength(500)
  reason?: string;
}
