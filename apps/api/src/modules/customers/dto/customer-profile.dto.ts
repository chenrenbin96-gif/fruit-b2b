import {
  IsNumberString,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateCustomerProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  customer_name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  contact_name?: string;

  @IsOptional()
  @IsPhoneNumber('CN')
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsNumberString()
  delivery_region_id?: string;
}
