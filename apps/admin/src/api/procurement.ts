import { apiClient } from './client';

type Envelope<T> = { data: T };

export type Supplier = {
  id: string;
  supplier_no: string;
  supplier_name: string;
  contact_name: string;
  phone: string;
  address: string;
  supply_categories: string[];
  remark: string | null;
  status: 'ACTIVE' | 'DISABLED';
  created_at: string;
};

export type PurchaseOrderItem = {
  id: string;
  sku_id: string;
  product_name: string;
  sku_name: string;
  sale_type: 'PIECE' | 'WEIGHT';
  ordered_quantity: string;
  received_quantity: string;
  purchase_unit: string;
  purchase_price: string;
  amount: string;
};

export type PurchaseOrder = {
  id: string;
  purchase_no: string;
  supplier_id: string;
  supplier_name: string;
  warehouse_id: string;
  warehouse_name: string;
  status:
    | 'PENDING_PURCHASE'
    | 'PURCHASING'
    | 'ARRIVED'
    | 'PARTIALLY_RECEIVED'
    | 'RECEIVED'
    | 'COMPLETED'
    | 'STOCKED'
    | 'CANCELLED';
  purchase_date: string | null;
  purchase_type: 'MARKET' | 'SUPPLIER';
  source_type: 'MANUAL' | 'PLAN' | 'IMPORT';
  planned_delivery_date: string | null;
  purchaser_id: string | null;
  responsible_person_id: string | null;
  received_amount: string;
  progress: string;
  total_amount: string;
  remark: string | null;
  submitted_at: string | null;
  arrived_at: string | null;
  received_at: string | null;
  created_at: string;
  items: PurchaseOrderItem[];
  receipt?: {
    id: string;
    receipt_no: string;
    total_amount: string;
    received_at: string;
    items: Array<{
      id: string;
      sku_id: string;
      received_quantity: string;
      purchase_unit: string;
      purchase_price: string;
      amount: string;
      inventory_cost_before: string;
      inventory_cost_after: string;
    }>;
  } | null;
};

export type PurchaseReferences = {
  suppliers: Array<{
    id: string;
    supplier_no: string;
    supplier_name: string;
  }>;
  warehouses: Array<{ id: string; warehouse_name: string }>;
  skus: Array<{
    id: string;
    sku_code: string;
    sku_name: string;
    product_name: string;
    sale_type: 'PIECE' | 'WEIGHT';
    stock_unit: string;
    current_cost_price: string;
  }>;
};

export const procurementApi = {
  async suppliers(params: Record<string, unknown> = {}): Promise<Supplier[]> {
    return (
      await apiClient.get<Envelope<Supplier[]>>('/admin/suppliers', { params })
    ).data.data;
  },
  async saveSupplier(
    id: string | null,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (id) await apiClient.put(`/admin/suppliers/${id}`, data);
    else await apiClient.post('/admin/suppliers', data);
  },
  async references(): Promise<PurchaseReferences> {
    return (
      await apiClient.get<Envelope<PurchaseReferences>>(
        '/admin/purchases/reference-data',
      )
    ).data.data;
  },
  async purchases(
    params: Record<string, unknown> = {},
  ): Promise<PurchaseOrder[]> {
    return (
      await apiClient.get<Envelope<PurchaseOrder[]>>('/admin/purchases', {
        params,
      })
    ).data.data;
  },
  async purchase(id: string): Promise<PurchaseOrder> {
    return (
      await apiClient.get<Envelope<PurchaseOrder>>(`/admin/purchases/${id}`)
    ).data.data;
  },
  async savePurchase(
    id: string | null,
    data: Record<string, unknown>,
  ): Promise<PurchaseOrder> {
    const response = id
      ? await apiClient.put<Envelope<PurchaseOrder>>(
          `/admin/purchases/${id}`,
          data,
        )
      : await apiClient.post<Envelope<PurchaseOrder>>('/admin/purchases', data);
    return response.data.data;
  },
  async submit(id: string): Promise<void> {
    await apiClient.post(`/admin/purchases/${id}/submit`);
  },
  async arrive(id: string): Promise<void> {
    await apiClient.post(`/admin/purchases/${id}/arrive`);
  },
  async cancel(id: string): Promise<void> {
    await apiClient.post(`/admin/purchases/${id}/cancel`);
  },
  async receive(
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await apiClient.post(`/admin/purchases/${id}/receive`, data);
  },
  async purchaseReturns(): Promise<Record<string, unknown>[]> {
    return (await apiClient.get<Envelope<Record<string, unknown>[]>>('/admin/purchase-returns')).data.data;
  },
  async createPurchaseReturn(data: Record<string, unknown>): Promise<void> {
    await apiClient.post('/admin/purchase-returns', data);
  },
  async updatePurchaseReturn(id: string, status: string): Promise<void> {
    await apiClient.put(`/admin/purchase-returns/${id}`, { status });
  },
  async purchaseHistory(): Promise<Record<string, unknown>[]> {
    return (await apiClient.get<Envelope<Record<string, unknown>[]>>('/admin/purchase-history')).data.data;
  },
  async purchasePrices(): Promise<Record<string, unknown>[]> {
    return (await apiClient.get<Envelope<Record<string, unknown>[]>>('/admin/purchase-prices')).data.data;
  },
  async supplierProducts(id: string): Promise<Record<string, unknown>[]> {
    return (await apiClient.get<Envelope<Record<string, unknown>[]>>(`/admin/suppliers/${id}/products`)).data.data;
  },
  async saveSupplierProduct(id: string, data: Record<string, unknown>): Promise<void> {
    await apiClient.post(`/admin/suppliers/${id}/products`, data);
  },
  async purchasePlans(): Promise<Record<string, unknown>[]> {
    return (await apiClient.get<Envelope<Record<string, unknown>[]>>('/admin/purchase-plans')).data.data;
  },
  async generatePurchasePlans(): Promise<Record<string, unknown>[]> {
    return (await apiClient.post<Envelope<Record<string, unknown>[]>>('/admin/purchase-plans/generate')).data.data;
  },
  async purchaseAnalysis(period = 'month'): Promise<Record<string, unknown>> {
    return (await apiClient.get<Envelope<Record<string, unknown>>>('/admin/purchase-analysis', { params: { period } })).data.data;
  },
  async purchasers(): Promise<Record<string, unknown>[]> {
    return (await apiClient.get<Envelope<Record<string, unknown>[]>>('/admin/purchasers')).data.data;
  },
};

export type CostRow = {
  sku_id: string;
  product_name: string;
  sku_name: string;
  stock_unit: string;
  cost_price: string;
  base_price: string;
  gross_profit_amount: string;
  gross_margin_rate: string;
  stock_quantity: string;
  stock_value: string;
};

export type ProfitProduct = {
  sku_id: string;
  product_name: string;
  sku_name: string;
  stock_unit: string;
  order_count: number;
  sold_quantity: string;
  sales_amount: string;
  cost_amount: string;
  gross_profit: string;
  gross_margin_rate: string;
};

export type ProfitAnalysis = {
  today: {
    sales_amount: string;
    cost_amount: string;
    gross_profit: string;
    gross_margin_rate: string;
  };
  hot_products: ProfitProduct[];
  profit_products: ProfitProduct[];
  loss_warnings: ProfitProduct[];
  cost_basis: 'CURRENT_WEIGHTED_AVERAGE';
};

export type InventoryAlertRow = {
  sku_id: string;
  product_name: string;
  sku_name: string;
  stock_unit: string;
  stock_warning: string;
  stock_quantity: string;
  available_quantity: string;
  last_sale_at: string | null;
};

export type PurchaseSuggestion = InventoryAlertRow & {
  average_daily_sales: string;
  purchase_lead_days: number;
  suggested_quantity: string;
};

export const supplyChainApi = {
  async costs(): Promise<CostRow[]> {
    return (
      await apiClient.get<Envelope<CostRow[]>>('/admin/supply-chain/costs')
    ).data.data;
  },
  async profitAnalysis(): Promise<ProfitAnalysis> {
    return (
      await apiClient.get<Envelope<ProfitAnalysis>>(
        '/admin/supply-chain/profit-analysis',
      )
    ).data.data;
  },
  async inventoryAlerts(): Promise<{
    low_stock: InventoryAlertRow[];
    out_of_stock: InventoryAlertRow[];
    slow_moving: InventoryAlertRow[];
    slow_moving_days: number;
  }> {
    return (
      await apiClient.get('/admin/supply-chain/inventory-alerts')
    ).data.data;
  },
  async purchaseSuggestions(): Promise<PurchaseSuggestion[]> {
    return (
      await apiClient.get<Envelope<PurchaseSuggestion[]>>(
        '/admin/supply-chain/purchase-suggestions',
      )
    ).data.data;
  },
};
