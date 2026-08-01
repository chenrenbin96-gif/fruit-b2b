import {
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class EmployeeLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  tenant_code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class CustomerVerificationCodeRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  tenant_code!: string;

  @IsPhoneNumber('CN')
  phone!: string;
}

export class CustomerLoginDto extends CustomerVerificationCodeRequestDto {
  @IsString()
  @Matches(/^\d{6}$/)
  verification_code!: string;
}

export class CustomerPasswordLoginDto {
  @IsString() @IsNotEmpty() @MaxLength(32)
  tenant_code!: string;

  @IsString() @IsNotEmpty() @MaxLength(50)
  account!: string;

  @IsString() @MinLength(6) @MaxLength(128)
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  @Length(20, 4096)
  refresh_token!: string;
}
