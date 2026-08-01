import { apiClient } from './client';

type Envelope<T> = { data: T };
type Page<T> = { items: T[]; pagination: { total: number } };

export type CreditCustomer = {
  customer_id: string;
  customer_no: string;
  customer_name: string;
  customer_level: string | null;
  credit_enabled: boolean;
  credit_limit: string;
  credit_days: number;
  balance_due: string;
  available_credit: string;
  overdue_amount: string;
  account_status: string;
};

export type Receivable = {
  id: string;
  receivable_no: string;
  customer_id: string;
  customer_name: string;
  order_no: string;
  order_amount: string;
  discount_amount: string;
  shipping_fee: string;
  final_amount: string;
  paid_amount: string;
  remaining_amount: string;
  status: string;
  term_status: string;
  bill_date: string;
  due_date: string;
  overdue_amount: string;
};

export type FinancialReport = {
  period: 'DAY' | 'WEEK' | 'MONTH';
  anchor_date: string;
  sales_amount: string;
  purchase_cost: string;
  gross_profit: string;
  gross_margin_rate: string;
  receivables: string;
  cash_income: string;
};

export type MonthlyStatement = {
  month: string;
  customer: CreditCustomer & { id: string; customer_level: string | null };
  summary: {
    sales_amount: string;
    paid_amount: string;
    remaining_amount: string;
  };
  items: Receivable[];
};

export type Payment = {
  id: string;
  payment_no: string;
  customer_name: string;
  amount: string;
  payment_method: string;
  payment_time: string;
  operator_name: string;
  remark: string | null;
};

export const financeApi = {
  async customers(): Promise<CreditCustomer[]> {
    return (
      await apiClient.get<Envelope<Page<CreditCustomer>>>('/admin/finance/customers', {
        params: { page_size: 100 },
      })
    ).data.data.items;
  },
  async updateCredit(
    id: string,
    data: { credit_limit: number; credit_days: number; credit_enabled: boolean },
  ) {
    await apiClient.put(`/admin/finance/customers/${id}/credit`, data);
  },
  async receivables(params: Record<string, unknown> = {}): Promise<Receivable[]> {
    return (
      await apiClient.get<Envelope<Page<Receivable>>>('/admin/finance/receivables', {
        params: { page_size: 100, ...params },
      })
    ).data.data.items;
  },
  async payments(params: Record<string, unknown> = {}): Promise<Payment[]> {
    return (
      await apiClient.get<Envelope<Page<Payment>>>('/admin/finance/payments', {
        params: { page_size: 100, ...params },
      })
    ).data.data.items;
  },
  async createPayment(data: {
    customer_id: string;
    amount: number;
    payment_method: string;
    payment_time: string;
    remark?: string;
  }) {
    await apiClient.post('/admin/finance/payments', data);
  },
  async report(period: 'DAY' | 'WEEK' | 'MONTH', date: string) {
    return (
      await apiClient.get<Envelope<FinancialReport>>('/admin/finance/reports', {
        params: { period, date },
      })
    ).data.data;
  },
  async statement(customerId: string, month: string) {
    return (
      await apiClient.get<Envelope<MonthlyStatement>>(
        '/admin/finance/statements/monthly',
        { params: { customer_id: customerId, month } },
      )
    ).data.data;
  },
  async downloadStatement(customerId: string, month: string) {
    const response = await apiClient.get('/admin/finance/statements/monthly/pdf', {
      params: { customer_id: customerId, month },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `客户对账单-${month}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  },
};
