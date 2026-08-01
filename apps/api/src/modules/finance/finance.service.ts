import { randomInt } from 'node:crypto';
import { existsSync } from 'node:fs';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import PDFDocument from 'pdfkit';

import type { AuthPrincipal } from '../auth/types/auth-principal';
import { CustomerEntity } from '../customers/entities/customer.entities';
import { OrderEntity } from '../orders/entities/order.entities';
import { centsToAmount } from '../orders/money';
import type {
  CreatePaymentDto,
  FinanceListQueryDto,
  UpdateCreditDto,
} from './dto/finance.dto';
import {
  PaymentAllocationEntity,
  PaymentEntity,
  ReceivableEntity,
} from './entities/finance.entities';

@Injectable()
export class FinanceService {
  constructor(private readonly dataSource: DataSource) {}

  async assertCreditAvailable(
    manager: EntityManager,
    customer: CustomerEntity,
    orderAmount: string,
  ): Promise<void> {
    if (!customer.creditEnabled) return;
    const projected = this.toCents(customer.balanceDue) + this.toCents(orderAmount);
    if (projected > this.toCents(customer.creditLimit)) {
      throw new BadRequestException({
        code: 'CUSTOMER_CREDIT_LIMIT_EXCEEDED',
        message: '客户当前欠款加本次订单金额已超过信用额度',
        details: {
          credit_limit: customer.creditLimit,
          balance_due: customer.balanceDue,
          order_amount: orderAmount,
          available_credit: centsToAmount(
            this.toCents(customer.creditLimit) - this.toCents(customer.balanceDue),
          ),
        },
      });
    }
  }

  async createReceivableForCompletedOrder(
    manager: EntityManager,
    order: OrderEntity,
  ): Promise<ReceivableEntity> {
    const existing = await manager.getRepository(ReceivableEntity).findOneBy({
      orderId: order.id,
    });
    if (existing) return existing;
    if (!order.finalAmount) {
      throw new BadRequestException({
        code: 'ORDER_FINAL_AMOUNT_MISSING',
        message: '订单最终金额未生成，不能创建应收账单',
      });
    }
    const customer = await manager
      .getRepository(CustomerEntity)
      .createQueryBuilder('customer')
      .setLock('pessimistic_write')
      .where('customer.id = :id', { id: order.customerId })
      .getOneOrFail();
    const now = new Date();
    const due = new Date(now);
    due.setUTCDate(due.getUTCDate() + customer.creditDays);
    const receivable = await manager.getRepository(ReceivableEntity).save({
      tenantId: order.tenantId,
      receivableNo: this.generateNo('AR'),
      customerId: order.customerId,
      orderId: order.id,
      orderAmount: order.finalProductAmount ?? order.estimatedProductAmount,
      discountAmount: order.discountAmount,
      shippingFee: order.shippingFee,
      finalAmount: order.finalAmount,
      receivableAmount: order.finalAmount,
      paidAmount: '0.00',
      remainingAmount: order.finalAmount,
      status: 'UNPAID',
      billDate: now,
      dueDate: due,
      settledAt: null,
    });
    customer.balanceDue = centsToAmount(
      this.toCents(customer.balanceDue) + this.toCents(order.finalAmount),
    );
    await manager.getRepository(CustomerEntity).save(customer);
    return receivable;
  }

  async customerSummary(principal: AuthPrincipal) {
    const customer = await this.customerOrFail(
      principal.tenantId,
      principal.customerId ?? '',
    );
    const overdue = await this.dataSource.getRepository(ReceivableEntity)
      .createQueryBuilder('receivable')
      .where('receivable.tenant_id = :tenantId', { tenantId: principal.tenantId })
      .andWhere('receivable.customer_id = :customerId', { customerId: customer.id })
      .andWhere("receivable.status <> 'PAID'")
      .andWhere('receivable.due_date < :now', { now: new Date() })
      .select('COALESCE(SUM(receivable.remaining_amount), 0)', 'amount')
      .getRawOne<{ amount: string }>();
    return this.creditView(customer, overdue?.amount ?? '0.00');
  }

  customerReceivables(principal: AuthPrincipal, query: FinanceListQueryDto) {
    return this.receivables(principal.tenantId, {
      ...query,
      customer_id: principal.customerId ?? '',
    });
  }

  customerPayments(principal: AuthPrincipal, query: FinanceListQueryDto) {
    return this.payments(principal.tenantId, {
      ...query,
      customer_id: principal.customerId ?? '',
    });
  }

  async creditCustomers(tenantId: string, query: FinanceListQueryDto) {
    const builder = this.dataSource.getRepository(CustomerEntity)
      .createQueryBuilder('customer')
      .leftJoinAndSelect('customer.level', 'level')
      .where('customer.tenant_id = :tenantId', { tenantId })
      .andWhere('customer.deleted_at IS NULL');
    if (query.customer_id) {
      builder.andWhere('customer.id = :customerId', {
        customerId: query.customer_id,
      });
    }
    const [items, total] = await builder
      .orderBy('customer.id', 'DESC')
      .skip((query.page - 1) * query.page_size)
      .take(query.page_size)
      .getManyAndCount();
    return this.page(
      items.map((item) => this.creditView(item)),
      total,
      query,
    );
  }

  async updateCredit(
    tenantId: string,
    customerId: string,
    dto: UpdateCreditDto,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const customer = await manager.getRepository(CustomerEntity)
        .createQueryBuilder('customer')
        .setLock('pessimistic_write')
        .where('customer.id = :customerId', { customerId })
        .andWhere('customer.tenant_id = :tenantId', { tenantId })
        .getOne();
      if (!customer) throw this.notFound('客户不存在');
      if (
        dto.credit_enabled &&
        this.toCents(customer.balanceDue) > BigInt(Math.round(dto.credit_limit * 100))
      ) {
        throw new BadRequestException({
          code: 'CREDIT_LIMIT_BELOW_BALANCE',
          message: '信用额度不能低于客户当前欠款',
        });
      }
      customer.creditLimit = dto.credit_limit.toFixed(2);
      customer.creditDays = dto.credit_days;
      customer.creditEnabled = dto.credit_enabled;
      customer.settlementType = dto.credit_enabled ? 'MONTHLY' : 'CASH';
      await manager.getRepository(CustomerEntity).save(customer);
    });
    return this.creditCustomers(tenantId, {
      customer_id: customerId,
      page: 1,
      page_size: 1,
    });
  }

  async receivables(tenantId: string, query: FinanceListQueryDto) {
    const builder = this.dataSource.getRepository(ReceivableEntity)
      .createQueryBuilder('receivable')
      .innerJoinAndSelect('receivable.customer', 'customer')
      .leftJoinAndSelect('customer.level', 'level')
      .innerJoinAndSelect('receivable.order', 'orders')
      .where('receivable.tenant_id = :tenantId', { tenantId });
    this.applyFilters(builder, query, 'receivable', 'billDate');
    if (query.status === 'OVERDUE') {
      builder
        .andWhere("receivable.status <> 'PAID'")
        .andWhere('receivable.due_date < :now', { now: new Date() });
    } else if (query.status) {
      builder.andWhere('receivable.status = :status', { status: query.status });
    }
    const [items, total] = await builder
      .orderBy('receivable.billDate', 'DESC')
      .skip((query.page - 1) * query.page_size)
      .take(query.page_size)
      .getManyAndCount();
    return this.page(items.map((item) => this.receivableView(item)), total, query);
  }

  async monthlyStatement(tenantId: string, customerId: string, month: string) {
    if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new BadRequestException({
        code: 'INVALID_STATEMENT_MONTH',
        message: '月份格式必须为YYYY-MM',
      });
    }
    const customer = await this.dataSource.getRepository(CustomerEntity).findOne({
      where: { id: customerId, tenantId },
      relations: { level: true },
    });
    if (!customer) throw this.notFound('客户不存在');
    const start = `${month}-01`;
    const [summaryRows, items] = await Promise.all([
      this.dataSource.query(
        `SELECT
           COALESCE(SUM(final_amount), 0) AS sales_amount,
           COALESCE(SUM(paid_amount), 0) AS paid_amount,
           COALESCE(SUM(remaining_amount), 0) AS remaining_amount
         FROM receivables
         WHERE tenant_id = ? AND customer_id = ?
           AND bill_date >= ? AND bill_date < DATE_ADD(?, INTERVAL 1 MONTH)`,
        [tenantId, customerId, start, start],
      ),
      this.dataSource.query(
        `SELECT r.receivable_no, o.order_no, r.bill_date, r.due_date,
           r.final_amount, r.paid_amount, r.remaining_amount, r.status
         FROM receivables r
         JOIN orders o ON o.id = r.order_id
         WHERE r.tenant_id = ? AND r.customer_id = ?
           AND r.bill_date >= ? AND r.bill_date < DATE_ADD(?, INTERVAL 1 MONTH)
         ORDER BY r.bill_date, r.id`,
        [tenantId, customerId, start, start],
      ),
    ]);
    const summary = summaryRows[0] ?? {};
    return {
      month,
      customer: {
        id: customer.id,
        customer_name: customer.customerName,
        customer_level: customer.level?.name ?? null,
        credit_limit: customer.creditLimit,
        credit_days: customer.creditDays,
        balance_due: customer.balanceDue,
      },
      summary: {
        sales_amount: this.money(summary.sales_amount),
        paid_amount: this.money(summary.paid_amount),
        remaining_amount: this.money(summary.remaining_amount),
      },
      items: items.map((item: Record<string, unknown>) => ({
        ...item,
        final_amount: this.money(item.final_amount),
        paid_amount: this.money(item.paid_amount),
        remaining_amount: this.money(item.remaining_amount),
      })),
    };
  }

  async statementPdf(tenantId: string, customerId: string, month: string) {
    const statement = await this.monthlyStatement(tenantId, customerId, month);
    const document = new PDFDocument({ size: 'A4', margin: 42 });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    const completed = new Promise<void>((resolve, reject) => {
      document.on('end', resolve);
      document.on('error', reject);
    });
    const fontPath = [
      process.env.PDF_FONT_PATH,
      '/usr/share/fonts/noto/NotoSansCJK-Regular.ttc',
      '/System/Library/Fonts/Hiragino Sans GB.ttc',
    ].find((path): path is string => Boolean(path && existsSync(path)));
    if (fontPath) {
      try {
        document.font(
          fontPath,
          fontPath.includes('Hiragino') ? 'Hiragino Sans GB W3' : 'NotoSansCJKsc-Regular',
        );
      } catch {
        document.font('Helvetica');
      }
    }
    document.fontSize(20).text('客户月度对账单', { align: 'center' });
    document.moveDown();
    document.fontSize(11)
      .text(`客户：${statement.customer.customer_name}`)
      .text(`月份：${statement.month}`)
      .text(`信用额度：¥${statement.customer.credit_limit}  账期：${statement.customer.credit_days}天`);
    document.moveDown();
    document.fontSize(13).text(
      `销售金额 ¥${statement.summary.sales_amount}    已收 ¥${statement.summary.paid_amount}    欠款 ¥${statement.summary.remaining_amount}`,
    );
    document.moveDown();
    document.fontSize(10).text('订单号                         订单日期          金额        已收        未收');
    document.moveTo(42, document.y + 3).lineTo(553, document.y + 3).stroke('#cccccc');
    document.moveDown(0.7);
    for (const item of statement.items) {
      document.text(
        `${String(item.order_no).padEnd(30)} ${new Date(String(item.bill_date)).toISOString().slice(0, 10)}    ${String(item.final_amount).padStart(8)}    ${String(item.paid_amount).padStart(8)}    ${String(item.remaining_amount).padStart(8)}`,
      );
    }
    document.moveDown();
    document.fontSize(9).fillColor('#666666')
      .text(`生成时间：${new Date().toISOString()}`, { align: 'right' });
    document.end();
    await completed;
    return Buffer.concat(chunks);
  }

  async financialReport(
    tenantId: string,
    period: 'DAY' | 'WEEK' | 'MONTH',
    date?: string,
  ) {
    const anchor = date ? new Date(date) : new Date();
    if (Number.isNaN(anchor.getTime())) {
      throw new BadRequestException({ code: 'INVALID_REPORT_DATE', message: '报表日期无效' });
    }
    const iso = anchor.toISOString().slice(0, 10);
    const startExpression =
      period === 'DAY'
        ? 'DATE(?)'
        : period === 'WEEK'
          ? 'DATE_SUB(DATE(?), INTERVAL WEEKDAY(DATE(?)) DAY)'
          : "DATE_FORMAT(DATE(?), '%Y-%m-01')";
    const startParams = period === 'WEEK' ? [iso, iso] : [iso];
    const endExpression =
      period === 'DAY'
        ? 'DATE_ADD(DATE(?), INTERVAL 1 DAY)'
        : period === 'WEEK'
          ? 'DATE_ADD(DATE_SUB(DATE(?), INTERVAL WEEKDAY(DATE(?)) DAY), INTERVAL 7 DAY)'
          : "DATE_ADD(DATE_FORMAT(DATE(?), '%Y-%m-01'), INTERVAL 1 MONTH)";
    const endParams = period === 'WEEK' ? [iso, iso] : [iso];
    const [rows] = await this.dataSource.query(
      `SELECT
         COALESCE((SELECT SUM(final_amount) FROM orders
           WHERE tenant_id = ? AND status = 'COMPLETED'
             AND created_at >= ${startExpression}
             AND created_at < ${endExpression}), 0) AS sales_amount,
         COALESCE((SELECT SUM(
           COALESCE(oi.actual_quantity, oi.actual_weight,
             oi.planned_quantity, oi.planned_weight, 0) * s.cost_price)
           FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
           JOIN skus s ON s.id = oi.sku_id
           WHERE o.tenant_id = ? AND o.status = 'COMPLETED'
             AND o.created_at >= ${startExpression}
             AND o.created_at < ${endExpression}), 0) AS purchase_cost,
         COALESCE((SELECT SUM(remaining_amount) FROM receivables
           WHERE tenant_id = ? AND bill_date < ${endExpression}), 0)
           AS receivables,
         COALESCE((SELECT SUM(amount) FROM payments
           WHERE tenant_id = ? AND payment_time >= ${startExpression}
             AND payment_time < ${endExpression}), 0) AS cash_income`,
      [
        tenantId, ...startParams, ...endParams,
        tenantId, ...startParams, ...endParams,
        tenantId, ...endParams,
        tenantId, ...startParams, ...endParams,
      ],
    );
    const sales = Number(rows.sales_amount ?? 0);
    const cost = Number(rows.purchase_cost ?? 0);
    return {
      period,
      anchor_date: iso,
      sales_amount: this.money(sales),
      purchase_cost: this.money(cost),
      gross_profit: this.money(sales - cost),
      gross_margin_rate: this.money(sales > 0 ? ((sales - cost) / sales) * 100 : 0),
      receivables: this.money(rows.receivables),
      cash_income: this.money(rows.cash_income),
      cost_basis: 'CURRENT_WEIGHTED_AVERAGE',
    };
  }

  async payments(tenantId: string, query: FinanceListQueryDto) {
    const builder = this.dataSource.getRepository(PaymentEntity)
      .createQueryBuilder('payment')
      .innerJoinAndSelect('payment.customer', 'customer')
      .innerJoinAndSelect('payment.operator', 'operator')
      .leftJoinAndSelect('payment.allocations', 'allocations')
      .leftJoinAndSelect('allocations.receivable', 'receivable')
      .where('payment.tenant_id = :tenantId', { tenantId });
    this.applyFilters(builder, query, 'payment', 'paymentTime');
    const [items, total] = await builder
      .orderBy('payment.paymentTime', 'DESC')
      .skip((query.page - 1) * query.page_size)
      .take(query.page_size)
      .getManyAndCount();
    return this.page(
      items.map((item) => ({
        id: item.id,
        payment_no: item.paymentNo,
        customer_id: item.customerId,
        customer_name: item.customer.customerName,
        amount: item.amount,
        payment_method: item.paymentMethod,
        payment_time: item.paymentTime,
        operator_name: item.operator.name,
        remark: item.remark,
        allocations: (item.allocations ?? []).map((allocation) => ({
          receivable_id: allocation.receivableId,
          receivable_no: allocation.receivable?.receivableNo,
          amount: allocation.amount,
        })),
      })),
      total,
      query,
    );
  }

  async createPayment(
    tenantId: string,
    operatorId: string,
    dto: CreatePaymentDto,
  ) {
    const paymentId = await this.dataSource.transaction(async (manager) => {
      const customer = await manager.getRepository(CustomerEntity)
        .createQueryBuilder('customer')
        .setLock('pessimistic_write')
        .where('customer.id = :id', { id: dto.customer_id })
        .andWhere('customer.tenant_id = :tenantId', { tenantId })
        .getOne();
      if (!customer) throw this.notFound('客户不存在');
      let remaining = BigInt(Math.round(dto.amount * 100));
      if (remaining > this.toCents(customer.balanceDue)) {
        throw new BadRequestException({
          code: 'PAYMENT_EXCEEDS_BALANCE',
          message: '收款金额不能超过客户当前欠款',
        });
      }
      const receivables = await manager.getRepository(ReceivableEntity)
        .createQueryBuilder('receivable')
        .setLock('pessimistic_write')
        .where('receivable.tenant_id = :tenantId', { tenantId })
        .andWhere('receivable.customer_id = :customerId', { customerId: customer.id })
        .andWhere("receivable.status <> 'PAID'")
        .orderBy('receivable.due_date', 'ASC')
        .addOrderBy('receivable.id', 'ASC')
        .getMany();
      const payment = await manager.getRepository(PaymentEntity).save({
        tenantId,
        paymentNo: this.generateNo('PAY'),
        customerId: customer.id,
        amount: dto.amount.toFixed(2),
        paymentMethod: dto.payment_method,
        paymentTime: new Date(dto.payment_time),
        operatorId,
        remark: dto.remark?.trim() ?? null,
      });
      for (const receivable of receivables) {
        if (remaining === 0n) break;
        const open = this.toCents(receivable.remainingAmount);
        const allocated = remaining < open ? remaining : open;
        receivable.paidAmount = centsToAmount(
          this.toCents(receivable.paidAmount) + allocated,
        );
        receivable.remainingAmount = centsToAmount(open - allocated);
        receivable.status =
          open === allocated ? 'PAID' : 'PARTIALLY_PAID';
        receivable.settledAt = open === allocated ? new Date() : null;
        await manager.getRepository(ReceivableEntity).save(receivable);
        await manager.getRepository(PaymentAllocationEntity).save({
          tenantId,
          paymentId: payment.id,
          receivableId: receivable.id,
          amount: centsToAmount(allocated),
        });
        remaining -= allocated;
      }
      if (remaining !== 0n) {
        throw new BadRequestException({
          code: 'RECEIVABLE_BALANCE_INCONSISTENT',
          message: '客户欠款汇总与应收明细不一致',
        });
      }
      customer.balanceDue = centsToAmount(
        this.toCents(customer.balanceDue) - BigInt(Math.round(dto.amount * 100)),
      );
      await manager.getRepository(CustomerEntity).save(customer);
      return payment.id;
    });
    return this.paymentDetail(tenantId, paymentId);
  }

  private async paymentDetail(tenantId: string, id: string) {
    const direct = await this.dataSource.getRepository(PaymentEntity).findOne({
      where: { id, tenantId },
      relations: { customer: true, operator: true, allocations: { receivable: true } },
    });
    if (!direct) throw this.notFound('收款记录不存在');
    return {
      id: direct.id,
      payment_no: direct.paymentNo,
      customer_id: direct.customerId,
      customer_name: direct.customer.customerName,
      amount: direct.amount,
      payment_method: direct.paymentMethod,
      payment_time: direct.paymentTime,
      operator_name: direct.operator.name,
      remark: direct.remark,
      allocations: direct.allocations.map((item) => ({
        receivable_id: item.receivableId,
        receivable_no: item.receivable.receivableNo,
        amount: item.amount,
      })),
    };
  }

  private async customerOrFail(tenantId: string, customerId: string) {
    const customer = await this.dataSource.getRepository(CustomerEntity).findOneBy({
      tenantId,
      id: customerId,
    });
    if (!customer) throw this.notFound('客户不存在');
    return customer;
  }

  private creditView(customer: CustomerEntity, overdueAmount = '0.00') {
    const available = this.toCents(customer.creditLimit) - this.toCents(customer.balanceDue);
    return {
      customer_id: customer.id,
      customer_no: customer.customerNo,
      customer_name: customer.customerName,
      settlement_type: customer.settlementType,
      credit_enabled: customer.creditEnabled,
      credit_limit: customer.creditLimit,
      credit_days: customer.creditDays,
      balance_due: customer.balanceDue,
      available_credit: centsToAmount(available > 0n ? available : 0n),
      overdue_amount: overdueAmount,
      account_status:
        Number(overdueAmount) > 0
          ? 'OVERDUE'
          : customer.creditEnabled &&
              this.toCents(customer.balanceDue) >= this.toCents(customer.creditLimit)
            ? 'LIMIT_REACHED'
            : 'NORMAL',
    };
  }

  private receivableView(item: ReceivableEntity) {
    return {
      id: item.id,
      receivable_no: item.receivableNo,
      customer_id: item.customerId,
      customer_name: item.customer.customerName,
      customer_level: item.customer.level?.name ?? null,
      credit_days: item.customer.creditDays,
      order_id: item.orderId,
      order_no: item.order.orderNo,
      order_amount: item.orderAmount,
      discount_amount: item.discountAmount,
      shipping_fee: item.shippingFee,
      final_amount: item.finalAmount,
      receivable_amount: item.receivableAmount,
      paid_amount: item.paidAmount,
      remaining_amount: item.remainingAmount,
      status: item.status,
      term_status:
        item.status !== 'PAID' && item.dueDate.getTime() < Date.now()
          ? 'OVERDUE'
          : 'CURRENT',
      overdue_amount:
        item.status !== 'PAID' && item.dueDate.getTime() < Date.now()
          ? item.remainingAmount
          : '0.00',
      bill_date: item.billDate,
      due_date: item.dueDate,
      settled_at: item.settledAt,
    };
  }

  private applyFilters(
    builder: ReturnType<DataSource['createQueryBuilder']>,
    query: FinanceListQueryDto,
    alias: string,
    dateProperty: string,
  ) {
    if (query.customer_id) {
      builder.andWhere(`${alias}.customerId = :customerId`, {
        customerId: query.customer_id,
      });
    }
    if (query.start_time) {
      builder.andWhere(`${alias}.${dateProperty} >= :startTime`, {
        startTime: new Date(query.start_time),
      });
    }
    if (query.end_time) {
      builder.andWhere(`${alias}.${dateProperty} <= :endTime`, {
        endTime: new Date(query.end_time),
      });
    }
  }

  private page(items: unknown[], total: number, query: FinanceListQueryDto) {
    return {
      items,
      pagination: {
        page: query.page,
        page_size: query.page_size,
        total,
        total_pages: Math.ceil(total / query.page_size),
      },
    };
  }

  private toCents(value: string): bigint {
    return BigInt(Math.round(Number(value) * 100));
  }

  private money(value: unknown): string {
    const numeric = Number(value ?? 0);
    return (Number.isFinite(numeric) ? numeric : 0).toFixed(2);
  }

  private generateNo(prefix: string): string {
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}`;
    return `${prefix}${stamp}${randomInt(100000, 999999)}`;
  }

  private notFound(message: string) {
    return new NotFoundException({ code: 'FINANCE_RESOURCE_NOT_FOUND', message });
  }
}
