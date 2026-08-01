import { apiClient } from './client';
type Envelope<T> = { data: T };
export type AfterSaleReason = { id: string; name: string; sort: number; status: 'ACTIVE' | 'INACTIVE' };
export type AfterSale = {
  id: string; after_sale_no: string; order_id: string; order_no?: string; customer_name?: string;
  status: string; reason: AfterSaleReason | null; refund_type: string; refund_amount: string;
  description?: string | null; review_remark?: string | null; created_at: string;
  items?: Array<{ id: string; product_name: string; sku_name: string; sale_type: 'PIECE'|'WEIGHT'; quantity: string|null; approved_quantity: string|null; requested_weight: string|null; approved_weight: string|null; unit: string; purchased_quantity: string|null; purchased_weight: string|null; refund_price: string; refund_amount: string }>;
  media?: Array<{ id: string; media_type: 'IMAGE'|'VIDEO'; url: string; thumbnail_url: string|null; sort: number }>;
  refund?: { id: string; amount: string; status: string; completed_at: string|null } | null;
};
export const afterSalesApi = {
  async list(params: Record<string, unknown>) { return (await apiClient.get<Envelope<{items: AfterSale[]; pagination:{page:number;page_size:number;total:number}}>>('/admin/after-sales', { params })).data.data; },
  async detail(id: string) { return (await apiClient.get<Envelope<AfterSale>>(`/admin/after-sales/${id}`)).data.data; },
  async approve(id: string, data: Record<string, unknown>) { return (await apiClient.post<Envelope<AfterSale>>(`/admin/after-sales/${id}/approve`, data)).data.data; },
  async reject(id: string, reason: string) { return (await apiClient.post<Envelope<AfterSale>>(`/admin/after-sales/${id}/reject`, { reason })).data.data; },
  async complete(id: string) { return (await apiClient.post<Envelope<AfterSale>>(`/admin/after-sales/${id}/complete`)).data.data; },
  async reasons() { return (await apiClient.get<Envelope<AfterSaleReason[]>>('/admin/after-sale-reasons')).data.data; },
  async createReason(data: Omit<AfterSaleReason,'id'>) { return (await apiClient.post<Envelope<AfterSaleReason>>('/admin/after-sale-reasons', data)).data.data; },
  async updateReason(id: string, data: Omit<AfterSaleReason,'id'>) { return (await apiClient.put<Envelope<AfterSaleReason>>(`/admin/after-sale-reasons/${id}`, data)).data.data; },
  async deleteReason(id: string) { await apiClient.delete(`/admin/after-sale-reasons/${id}`); },
};
