import { apiClient } from './client';

type Envelope<T> = { data: T };

export type Coupon = {
  id: string;
  name: string;
  coupon_type: 'ORDER_REDUCTION' | 'PRODUCT' | 'CATEGORY' | 'NEW_CUSTOMER' | 'CUSTOMER_EXCLUSIVE';
  discount_amount: string;
  min_amount: string;
  total_limit: number | null;
  issued_count: number;
  used_count: number;
  per_customer_limit: number;
  start_time: string;
  end_time: string;
  status: 'DRAFT' | 'ACTIVE' | 'DISABLED';
  product_ids: string[];
  category_ids: string[];
  level_ids: string[];
};

export type Delivery = {
  id: string;
  delivery_no: string;
  order_id: string;
  order_no: string;
  delivery_person_id: string | null;
  delivery_person_name: string | null;
  customer_name: string;
  phone: string;
  address: string;
  status: 'WAITING' | 'DELIVERING' | 'DELIVERED' | 'FAILED';
  order_amount: string;
  item_count: number;
  assigned_at: string | null;
  started_at: string | null;
  delivered_at: string | null;
};

export const fulfillmentApi = {
  async coupons(): Promise<Coupon[]> {
    return (
      await apiClient.get<Envelope<{ items: Coupon[] }>>('/admin/coupons', {
        params: { page_size: 100 },
      })
    ).data.data.items;
  },
  async saveCoupon(id: string | null, data: Record<string, unknown>) {
    if (id) await apiClient.put(`/admin/coupons/${id}`, data);
    else await apiClient.post('/admin/coupons', data);
  },
  async disableCoupon(id: string) {
    await apiClient.delete(`/admin/coupons/${id}`);
  },
  async issueCoupon(id: string, customerIds: string[]) {
    await apiClient.post(`/admin/coupons/${id}/issue`, {
      customer_ids: customerIds,
    });
  },
  async couponRecords(id: string): Promise<Array<Record<string, string>>> {
    return (
      await apiClient.get<Envelope<Array<Record<string, string>>>>(
        `/admin/coupons/${id}/records`,
      )
    ).data.data;
  },
  async issuedCoupons(id: string): Promise<Array<Record<string, string>>> {
    return (
      await apiClient.get<Envelope<Array<Record<string, string>>>>(
        `/admin/coupons/${id}/customer-coupons`,
      )
    ).data.data;
  },
  async deliveries(status?: string): Promise<Delivery[]> {
    return (
      await apiClient.get<Envelope<{ items: Delivery[] }>>(
        '/admin/deliveries',
        { params: { status, page_size: 100 } },
      )
    ).data.data.items;
  },
  async deliveryPeople(): Promise<Array<{ id: string; name: string }>> {
    return (
      await apiClient.get<Envelope<Array<{ id: string; name: string }>>>(
        '/admin/deliveries/delivery-people',
      )
    ).data.data;
  },
  async assignDelivery(id: string, deliveryPersonId: string) {
    await apiClient.put(`/admin/deliveries/${id}/assignee`, {
      delivery_person_id: deliveryPersonId,
    });
  },
  async updateDeliveryStatus(
    id: string,
    status: 'DELIVERING' | 'DELIVERED' | 'FAILED',
    signedBy?: string,
    failure?: {
      reason_code: 'CUSTOMER_REJECTED' | 'UNREACHABLE' | 'ADDRESS_ERROR' | 'OTHER';
      reason: string;
    },
  ) {
    await apiClient.post(`/admin/deliveries/${id}/status`, {
      status,
      signed_by: signedBy,
      ...failure,
    });
  },
  async shippingRules(): Promise<Array<{
    id: string;
    name: string;
    delivery_region_id: string;
    delivery_region_name: string;
    calculation_type: 'WEIGHT' | 'FIXED';
    price_per_weight: string | null;
    weight_unit: '斤' | '公斤' | null;
    fixed_fee: string | null;
    status: 'ACTIVE' | 'DISABLED';
  }>> {
    return (
      await apiClient.get<Envelope<Array<{
        id: string;
        name: string;
        delivery_region_id: string;
        delivery_region_name: string;
        calculation_type: 'WEIGHT' | 'FIXED';
        price_per_weight: string | null;
        weight_unit: '斤' | '公斤' | null;
        fixed_fee: string | null;
        status: 'ACTIVE' | 'DISABLED';
      }>>>('/admin/shipping/rules')
    ).data.data;
  },
  async updateShippingRule(id: string, data: Record<string, unknown>) {
    await apiClient.put(`/admin/shipping/rules/${id}`, data);
  },
  async createShippingRule(data: Record<string, unknown>) {
    await apiClient.post('/admin/shipping/rules', data);
  },
  async deliveryRegions(): Promise<Array<{
    id: string;
    region_code: string;
    region_name: string;
    address_keywords: string | null;
    min_order_amount: string;
    is_default: boolean;
    sort: number;
    status: 'ACTIVE' | 'DISABLED';
  }>> {
    return (
      await apiClient.get<Envelope<Array<{
        id: string;
        region_code: string;
        region_name: string;
        address_keywords: string | null;
        min_order_amount: string;
        is_default: boolean;
        sort: number;
        status: 'ACTIVE' | 'DISABLED';
      }>>>('/admin/shipping/regions')
    ).data.data;
  },
  async saveDeliveryRegion(id: string | null, data: Record<string, unknown>) {
    if (id) await apiClient.put(`/admin/shipping/regions/${id}`, data);
    else await apiClient.post('/admin/shipping/regions', data);
  },
};
