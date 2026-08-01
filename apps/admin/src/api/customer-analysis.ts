import { apiClient } from './client';

type Envelope<T> = { data: T };

export type CustomerPurchaseAnalysis = {
  customer_id: string;
  customer_no: string;
  customer_name: string;
  purchase_count: number;
  purchase_amount: string;
  frequent_product: string | null;
  last_purchase_time: string | null;
};

export async function getCustomerPurchaseAnalysis() {
  return (
    await apiClient.get<Envelope<CustomerPurchaseAnalysis[]>>(
      '/admin/customer-purchase-analysis',
    )
  ).data.data;
}
