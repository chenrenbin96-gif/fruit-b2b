import { Body, Controller, Get, Post } from '@nestjs/common';

import {
  CurrentPrincipal,
  Public,
} from '../../common/decorators/auth.decorators';
import { AuthService } from './auth.service';
import {
  CustomerLoginDto,
  CustomerPasswordLoginDto,
  CustomerVerificationCodeRequestDto,
  EmployeeLoginDto,
  RefreshTokenDto,
} from './dto/auth.dto';
import type { AuthPrincipal } from './types/auth-principal';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('employee/login')
  employeeLogin(@Body() dto: EmployeeLoginDto) {
    return this.auth.employeeLogin(dto);
  }

  @Public()
  @Post('customer/verification-code')
  requestCustomerCode(@Body() dto: CustomerVerificationCodeRequestDto) {
    return this.auth.requestCustomerCode(dto);
  }

  @Public()
  @Post('customer/login')
  customerLogin(@Body() dto: CustomerLoginDto) {
    return this.auth.customerLogin(dto);
  }

  @Public()
  @Post('customer/password-login')
  customerPasswordLogin(@Body() dto: CustomerPasswordLoginDto) {
    return this.auth.customerPasswordLogin(dto);
  }

  @Public()
  @Post('token/refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refresh_token);
  }

  @Post('logout')
  logout(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.auth.logout(principal);
  }

  @Get('me')
  me(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.auth.me(principal);
  }
}
