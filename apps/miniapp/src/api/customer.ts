import { request } from './request';

export type CustomerProfile = {
  id: string;
  customer_no: string;
  customer_name: string;
  contact_name: string;
  phone: string;
  address: string;
  delivery_region: { id: string; name: string } | null;
  business_type: string;
  level: { id: string; code: string; name: string };
  settlement_type: string;
  credit_days: number;
  credit_enabled: boolean;
  credit_limit: string;
  balance_due: string;
  status: string;
};

export async function getCustomerProfile(): Promise<CustomerProfile> {
  return (await request<CustomerProfile>({ url: '/customers/me' })).data;
}

export async function getCustomerCenter(): Promise<Record<string, any>> {
  return (await request<Record<string, any>>({ url: '/customers/me/center', method: 'GET' })).data;
}

export async function updateCustomerProfile(data: {
  customer_name: string;
  contact_name: string;
  phone: string;
  address: string;
  delivery_region_id?: string;
}): Promise<CustomerProfile> {
  return (
    await request<CustomerProfile>({
      url: '/customers/me',
      method: 'PATCH',
      data,
    })
  ).data;
}

export type DeliveryRegionOption = {
  id: string;
  region_name: string;
  min_order_amount: string;
  is_default: boolean;
};

export async function getDeliveryRegions(): Promise<DeliveryRegionOption[]> {
  return (
    await request<DeliveryRegionOption[]>({ url: '/shipping/regions' })
  ).data;
}
