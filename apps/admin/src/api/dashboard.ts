import { apiClient } from './client';

type Envelope<T> = { data: T };

export type WarehouseDashboard = {
  today_orders: number;
  waiting_review: number;
  waiting_picking: number;
  waiting_weighing: number;
  waiting_delivery: number;
  exception_orders: number;
  generated_at: string;
};

export async function getWarehouseDashboard(): Promise<WarehouseDashboard> {
  return (
    await apiClient.get<Envelope<WarehouseDashboard>>(
      '/admin/warehouse-dashboard',
    )
  ).data.data;
}

export type ManagementDashboard = {
  sales: {
    today_orders: number;
    today_completed_orders: number;
    today_sales: string;
    month_sales: string;
    average_order_amount: string;
    today_gross_profit: string;
    today_gross_margin_rate: string;
  };
  order_status: Record<string, number>;
  inventory: {
    warning_count: number;
    stock_value: string;
    low_stock_count: number;
    out_of_stock_count: number;
    warnings: Array<{
      id: string;
      sku_id: string;
      product_name: string;
      sku_name: string;
      available_quantity: string;
      stock_warning: string;
      stock_unit: string;
    }>;
  };
  receivables: {
    total_debt: string;
    debt_customers: number;
    customers: Array<{
      id: string;
      customer_no: string;
      customer_name: string;
      balance_due: string;
      credit_limit: string;
      credit_days: number;
    }>;
  };
  customers: {
    new_customers: number;
    active_customers: number;
  };
  generated_at: string;
};

export async function getManagementDashboard(): Promise<ManagementDashboard> {
  return (
    await apiClient.get<Envelope<ManagementDashboard>>(
      '/admin/management-dashboard',
    )
  ).data.data;
}
