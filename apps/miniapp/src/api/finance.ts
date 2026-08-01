import { request } from './request';

export type FinanceSummary = {
  customer_name: string;
  credit_enabled: boolean;
  credit_limit: string;
  credit_days: number;
  balance_due: string;
  available_credit: string;
  overdue_amount: string;
  account_status: string;
};

export type CustomerReceivable = {
  id: string;
  receivable_no: string;
  order_no: string;
  final_amount: string;
  paid_amount: string;
  remaining_amount: string;
  status: string;
  term_status: string;
  bill_date: string;
  due_date: string;
};

export type CustomerPayment = {
  id: string;
  payment_no: string;
  amount: string;
  payment_method: string;
  payment_time: string;
  remark: string | null;
};

type Page<T> = { items: T[] };

export const customerFinanceApi = {
  async summary(): Promise<FinanceSummary> {
    return (await request<FinanceSummary>({ url: '/finance/summary' })).data;
  },
  async receivables(): Promise<CustomerReceivable[]> {
    return (
      await request<Page<CustomerReceivable>>({
        url: '/finance/receivables?page_size=100',
      })
    ).data.items;
  },
  async payments(): Promise<CustomerPayment[]> {
    return (
      await request<Page<CustomerPayment>>({
        url: '/finance/payments?page_size=100',
      })
    ).data.items;
  },
};
