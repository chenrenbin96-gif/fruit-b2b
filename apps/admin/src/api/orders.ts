import { apiClient } from './client';

type Envelope<T> = { data: T };

export type OrderItem = {
  id: string;
  sku_id: string;
  product_name: string;
  sku_name: string;
  specification: string | null;
  sale_type: 'PIECE' | 'WEIGHT';
  planned_quantity: string | null;
  planned_weight: string | null;
  actual_quantity: string | null;
  actual_weight: string | null;
  actual_gross_weight: string | null;
  actual_net_weight: string | null;
  weight_unit: string | null;
  unit: string;
  unit_price: string;
  final_unit_price: string | null;
  gross_weight_unit_price: string | null;
  net_weight_unit_price: string | null;
  estimated_amount: string;
  final_amount: string | null;
  amount_adjustment_type: 'NONE' | 'SUPPLEMENT' | 'REFUND';
  amount_adjustment: string;
};

export type AdminOrder = {
  id: string;
  order_no: string;
  customer_id: string;
  customer_name?: string;
  warehouse_id: string;
  warehouse_name?: string;
  estimated_product_amount: string;
  estimated_discount_amount: string;
  estimated_amount: string;
  final_product_amount: string | null;
  final_amount: string | null;
  discount_amount: string;
  shipping_fee: string;
  shipping_status: string;
  estimated_weight: string | null;
  weight_unit: string;
  status:
    | 'CREATED'
    | 'WAITING_REVIEW'
    | 'APPROVED'
    | 'PICKING'
    | 'WEIGHING'
    | 'WAITING_DELIVERY'
    | 'DELIVERING'
    | 'COMPLETED'
    | 'CANCELLED';
  remark: string | null;
  rejection_reason: string | null;
  cancellation_reason: string | null;
  expires_at: string;
  created_at: string;
  items?: OrderItem[];
  delivery?: {
    id: string;
    delivery_no: string;
    status: 'WAITING' | 'DELIVERING' | 'DELIVERED' | 'FAILED';
  } | null;
  status_logs?: Array<{
    id: string;
    from_status: string | null;
    to_status: string;
    action: string;
    operator_type: string;
    remark: string | null;
    created_at: string;
  }>;
  fulfillment_progress?: Array<{
    code: string;
    label: string;
    completed: boolean;
    current: boolean;
    time: string | null;
  }>;
};

export const orderApi = {
  async list(params: Record<string, unknown>): Promise<{
    items: AdminOrder[];
    pagination: {
      page: number;
      page_size: number;
      total: number;
      total_pages: number;
    };
  }> {
    return (
      await apiClient.get<Envelope<{
        items: AdminOrder[];
        pagination: {
          page: number;
          page_size: number;
          total: number;
          total_pages: number;
        };
      }>>('/admin/orders', { params })
    ).data.data;
  },

  async detail(id: string): Promise<AdminOrder> {
    return (
      await apiClient.get<Envelope<AdminOrder>>(`/admin/orders/${id}`)
    ).data.data;
  },

  async review(
    id: string,
    action: 'APPROVE' | 'REJECT',
    reason?: string,
  ): Promise<AdminOrder> {
    return (
      await apiClient.post<Envelope<AdminOrder>>(
        `/admin/orders/${id}/review`,
        { action, reason },
      )
    ).data.data;
  },

  async startPicking(id: string): Promise<void> {
    await apiClient.post(`/admin/orders/${id}/picking/start`);
  },

  async completeWeighing(
    id: string,
    items: Array<{
      order_item_id: string;
      actual_gross_weight: number;
      actual_net_weight: number;
    }>,
  ): Promise<void> {
    await apiClient.post(`/admin/orders/${id}/weighing`, { items });
  },

  async completePieceOrder(id: string): Promise<void> {
    await apiClient.post(`/admin/orders/${id}/fulfillment/complete`);
  },
};
