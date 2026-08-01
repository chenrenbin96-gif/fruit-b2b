import { request } from './request';

export type PurchaseCartItem = {
  id: string;
  sku_id: string;
  product_id: string;
  product_name: string;
  category_id: string;
  category_name: string;
  main_image: string | null;
  sku_name: string;
  specification: string | null;
  sale_type: 'PIECE' | 'WEIGHT';
  quantity: string | null;
  estimated_weight: string | null;
  standard_weight: string | null;
  weight_unit: string | null;
  unit: string;
  stock_unit: string;
  price_unit: string;
  unit_price: string | null;
  amount: string;
  available_quantity: string;
  purchasable: boolean;
  invalid_reason: string | null;
};

export type PurchaseCart = {
  id: string;
  status: string;
  items: PurchaseCartItem[];
  summary: {
    item_count: number;
    estimated_product_amount: string;
    estimated_weight: string;
    estimated_weight_unit: string;
    shipping_price: string;
    estimated_shipping_fee: string;
    estimated_amount: string;
    all_items_purchasable: boolean;
  };
  first_order_check: {
    is_first_order: boolean;
    historical_order_count: number;
    required_min_amount: string;
    current_amount: string;
    passed: boolean;
  };
  delivery_minimum_check: {
    delivery_region_id: string;
    delivery_region_name: string;
    required_min_amount: string;
    current_amount: string;
    shortfall_amount: string;
    passed: boolean;
  };
};

export type CustomerOrder = {
  id: string;
  order_no: string;
  estimated_product_amount: string;
  estimated_discount_amount: string;
  estimated_amount: string;
  final_product_amount: string | null;
  final_amount: string | null;
  amount_adjustment_type: 'NONE' | 'SUPPLEMENT' | 'REFUND';
  amount_adjustment: string;
  discount_amount: string;
  shipping_fee: string;
  status: string;
  remark: string | null;
  cancellation_reason: string | null;
  created_at: string;
  delivery: {
    id: string;
    delivery_no: string;
    status: 'WAITING' | 'DELIVERING' | 'DELIVERED' | 'FAILED';
    started_at: string | null;
    delivered_at: string | null;
    signed_by: string | null;
  } | null;
  items: Array<{
    id: string;
    sku_id: string;
    product_name: string;
    sku_name: string;
    sale_type: 'PIECE' | 'WEIGHT';
    planned_quantity: string | null;
    planned_weight: string | null;
    actual_quantity: string | null;
    actual_weight: string | null;
    actual_gross_weight: string | null;
    actual_net_weight: string | null;
    weight_unit: string | null;
    gross_weight_unit_price: string | null;
    net_weight_unit_price: string | null;
    unit: string;
    unit_price: string;
    final_unit_price: string | null;
    estimated_amount: string;
    final_amount: string | null;
  }>;
  fulfillment_progress: Array<{
    code: string;
    label: string;
    completed: boolean;
    current: boolean;
    time: string | null;
  }>;
  delivery_progress: Array<{
    code: string;
    label: string;
    completed: boolean;
    current: boolean;
    time: string | null;
  }>;
  delivery_status: 'WAITING' | 'DELIVERING' | 'DELIVERED' | 'FAILED' | null;
  tracking_logs: Array<{
    status: 'WAITING' | 'DELIVERING' | 'DELIVERED' | 'FAILED';
    reason_code: string | null;
    reason: string | null;
    created_at: string;
  }>;
};

function normalizeCustomerOrder(order: CustomerOrder): CustomerOrder {
  const progress = Array.isArray(order.delivery_progress)
    ? order.delivery_progress
    : Array.isArray(order.fulfillment_progress)
      ? order.fulfillment_progress
      : [];
  return {
    ...order,
    items: Array.isArray(order.items) ? order.items : [],
    fulfillment_progress: progress,
    delivery_progress: progress,
    delivery_status: order.delivery_status ?? order.delivery?.status ?? null,
    tracking_logs: Array.isArray(order.tracking_logs)
      ? order.tracking_logs
      : [],
  };
}

export type CustomerCoupon = {
  id: string;
  status: 'AVAILABLE' | 'LOCKED' | 'USED' | 'EXPIRED' | 'INVALID';
  coupon: {
    id: string;
    name: string;
    coupon_type: string;
    discount_amount: string;
    min_amount: string;
    start_time: string;
    end_time: string;
  };
};

export type PurchasedProduct = {
  sku_id: string;
  product_id: string;
  product_name: string;
  main_image: string | null;
  category_id: string;
  category_name: string;
  sku_name: string;
  specification: string | null;
  sale_type: 'PIECE' | 'WEIGHT';
  unit: string;
  price_unit: string;
  last_quantity: string;
  last_unit_price: string;
  last_order_id: string;
  last_order_no: string;
  last_purchase_time: string;
  purchase_count: number;
  total_purchase_quantity: string;
  current_price: string;
  current_price_source: string;
  available_quantity: string;
  stock_unit: string;
  purchasable: boolean;
};

export type PurchaseSummary = {
  month: { purchase_amount: string; purchase_count: number };
  most_purchased: PurchasedProduct | null;
};

export const purchaseOrderApi = {
  async cart(): Promise<PurchaseCart> {
    return (await request<PurchaseCart>({ url: '/purchase-cart' })).data;
  },
  async addItem(data: {
    sku_id: string;
    quantity?: number;
    estimated_weight?: number;
  }): Promise<PurchaseCart> {
    return (
      await request<PurchaseCart>({
        url: '/purchase-cart/items',
        method: 'POST',
        data,
      })
    ).data;
  },
  async batchAdd(
    items: Array<{
      sku_id: string;
      quantity?: number;
      estimated_weight?: number;
    }>,
  ): Promise<PurchaseCart> {
    return (
      await request<PurchaseCart>({
        url: '/cart/batch-add',
        method: 'POST',
        data: { items },
      })
    ).data;
  },
  async updateItem(
    id: string,
    data: { quantity?: number; estimated_weight?: number },
  ): Promise<PurchaseCart> {
    return (
      await request<PurchaseCart>({
        url: `/purchase-cart/items/${id}`,
        method: 'PATCH',
        data,
      })
    ).data;
  },
  async removeItem(id: string): Promise<PurchaseCart> {
    return (
      await request<PurchaseCart>({
        url: `/purchase-cart/items/${id}`,
        method: 'DELETE',
      })
    ).data;
  },
  async clear(): Promise<PurchaseCart> {
    return (
      await request<PurchaseCart>({
        url: '/purchase-cart/items',
        method: 'DELETE',
      })
    ).data;
  },
  async submit(
    remark?: string,
    customerCouponId?: string,
  ): Promise<CustomerOrder> {
    const storageKey = 'purchase_submit_idempotency_key';
    const idempotencyKey =
      uni.getStorageSync(storageKey) ||
      `miniapp_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    uni.setStorageSync(storageKey, idempotencyKey);
    const result = (
      await request<CustomerOrder>({
        url: '/purchase-cart/submit',
        method: 'POST',
        header: { 'Idempotency-Key': idempotencyKey },
        data: {
          remark: remark || undefined,
          customer_coupon_id: customerCouponId || undefined,
        },
      })
    ).data;
    uni.removeStorageSync(storageKey);
    return normalizeCustomerOrder(result);
  },
  async orders(group?: string): Promise<CustomerOrder[]> {
    const query = group ? `?group=${group}` : '';
    const result = (
      await request<{
        items: CustomerOrder[];
        pagination: { total: number };
      }>({
        url: `/orders${query}`,
      })
    ).data.items;
    return Array.isArray(result)
      ? result.map(normalizeCustomerOrder)
      : [];
  },
  async order(id: string): Promise<CustomerOrder> {
    return normalizeCustomerOrder(
      (await request<CustomerOrder>({ url: `/orders/${id}` })).data,
    );
  },
  async coupons(): Promise<CustomerCoupon[]> {
    return (await request<CustomerCoupon[]>({ url: '/coupons' })).data;
  },
  async cancelOrder(id: string, reason: string): Promise<CustomerOrder> {
    return normalizeCustomerOrder(
      (
      await request<CustomerOrder>({
        url: `/orders/${id}/cancel`,
        method: 'POST',
        data: { reason },
      })
      ).data,
    );
  },
  async reorder(id: string): Promise<PurchaseCart> {
    return (
      await request<PurchaseCart>({
        url: `/purchase-cart/reorder/${id}`,
        method: 'POST',
      })
    ).data;
  },
  async purchasedProducts(): Promise<PurchasedProduct[]> {
    return (
      await request<PurchasedProduct[]>({
        url: '/customer/purchased-products',
      })
    ).data;
  },
  async frequentProducts(): Promise<PurchasedProduct[]> {
    return (
      await request<PurchasedProduct[]>({
        url: '/customer/frequent-products',
      })
    ).data;
  },
  async purchaseSummary(): Promise<PurchaseSummary> {
    return (
      await request<PurchaseSummary>({
        url: '/customer/purchase-summary',
      })
    ).data;
  },
};
