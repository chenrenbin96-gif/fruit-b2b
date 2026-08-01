import { Body, Controller, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import {
  CurrentPrincipal,
  RequirePermissions,
  RequirePrincipalTypes,
} from '../../common/decorators/auth.decorators';
import type { AuthPrincipal } from '../auth/types/auth-principal';
import { AuditService } from '../audit/audit.service';
import { IdParamDto } from '../products/dto/product.dto';
import {
  CreatePaymentDto,
  FinanceListQueryDto,
  FinanceReportQueryDto,
  MonthlyStatementQueryDto,
  UpdateCreditDto,
} from './dto/finance.dto';
import { FinanceService } from './finance.service';

@Controller('finance')
@RequirePrincipalTypes('CUSTOMER_ACCOUNT')
@RequirePermissions('customer.self')
export class CustomerFinanceController {
  constructor(private readonly finance: FinanceService) {}
  @Get('summary')
  summary(@CurrentPrincipal() principal: AuthPrincipal) {
    return this.finance.customerSummary(principal);
  }
  @Get('receivables')
  receivables(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: FinanceListQueryDto,
  ) {
    return this.finance.customerReceivables(principal, query);
  }
  @Get('payments')
  payments(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: FinanceListQueryDto,
  ) {
    return this.finance.customerPayments(principal, query);
  }
}

@Controller('admin/finance')
@RequirePrincipalTypes('EMPLOYEE')
export class AdminFinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly audit: AuditService,
  ) {}
  @Get('statements/monthly')
  @RequirePermissions('finance.statement.export')
  statement(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: MonthlyStatementQueryDto,
  ) {
    return this.finance.monthlyStatement(
      principal.tenantId,
      query.customer_id,
      query.month,
    );
  }
  @Get('statements/monthly/pdf')
  @RequirePermissions('finance.statement.export')
  async statementPdf(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: MonthlyStatementQueryDto,
    @Res() response: Response,
  ) {
    const pdf = await this.finance.statementPdf(
      principal.tenantId,
      query.customer_id,
      query.month,
    );
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="statement-${query.month}.pdf"`,
    );
    response.send(pdf);
  }
  @Get('reports')
  @RequirePermissions('finance.report.read')
  report(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: FinanceReportQueryDto,
  ) {
    return this.finance.financialReport(
      principal.tenantId,
      query.period,
      query.date,
    );
  }
  @Get('customers')
  @RequirePermissions('finance.read')
  customers(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: FinanceListQueryDto,
  ) {
    return this.finance.creditCustomers(principal.tenantId, query);
  }
  @Put('customers/:id/credit')
  @RequirePermissions('finance.credit.manage')
  async updateCredit(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param() params: IdParamDto,
    @Body() dto: UpdateCreditDto,
  ) {
    const beforePage = await this.finance.creditCustomers(principal.tenantId, {
      customer_id: params.id,
      page: 1,
      page_size: 1,
    });
    const result = await this.finance.updateCredit(principal.tenantId, params.id, dto);
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'FINANCE',
      actionCode: 'CUSTOMER_CREDIT_UPDATE',
      targetType: 'CUSTOMER',
      targetId: params.id,
      before: { credit: beforePage.items[0] ?? null },
      after: { credit: result.items[0] ?? null },
    }));
    return result;
  }
  @Get('receivables')
  @RequirePermissions('finance.read')
  receivables(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: FinanceListQueryDto,
  ) {
    return this.finance.receivables(principal.tenantId, query);
  }
  @Get('payments')
  @RequirePermissions('finance.read')
  payments(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Query() query: FinanceListQueryDto,
  ) {
    return this.finance.payments(principal.tenantId, query);
  }
  @Post('payments')
  @RequirePermissions('finance.payment.create')
  async createPayment(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CreatePaymentDto,
  ) {
    const result = await this.finance.createPayment(
      principal.tenantId,
      principal.userId ?? '',
      dto,
    );
    await this.audit.record(this.audit.fromPrincipal(principal, {
      moduleCode: 'FINANCE',
      actionCode: 'PAYMENT_CREATE',
      targetType: 'PAYMENT',
      targetId: result.id,
      before: { customer_id: dto.customer_id },
      after: { payment: result },
    }));
    return result;
  }
}
