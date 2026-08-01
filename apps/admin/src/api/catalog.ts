import { apiClient } from './client';

type Envelope<T> = { data: T };

export type CategoryNode = {
  id: string;
  parent_id: string | null;
  name: string;
  image: string | null;
  sort: number;
  status: 'ACTIVE' | 'DISABLED';
  children: CategoryNode[];
};

export type Product = {
  id: string;
  product_code: string;
  barcode: string | null;
  category_id: string;
  name: string;
  main_image: string | null;
  origin: string | null;
  brand: string | null;
  grade: 'A' | 'B' | 'C' | '特级' | null;
  description: string | null;
  status: 'DRAFT' | 'ON_SALE' | 'OFF_SALE';
  category?: { id: string; name: string };
  media?: ProductMedia[];
  descriptions?: ProductDescription[];
  skus?: Sku[];
  market_price?: string | null;
  sale_types?: Array<'PIECE' | 'WEIGHT'>;
  units?: string[];
  available_quantity?: string;
  recent_purchase_price?: string | null;
  updated_at?: string;
};

export type ProductDescription = {
  id: string;
  product_id?: string;
  content_json:
    | { type: 'TEXT'; text: string }
    | { type: 'IMAGE'; url: string };
  sort: number;
};

export type ProductMedia = {
  id: string;
  product_id: string;
  media_type: 'VIDEO' | 'IMAGE';
  url: string;
  thumbnail_url: string | null;
  sort: number;
  status: 'ENABLE' | 'DISABLE';
};

export type Sku = {
  id: string;
  product_id: string;
  product_name?: string;
  sku_code: string;
  sku_name: string;
  specification: string | null;
  sale_type: 'PIECE' | 'WEIGHT';
  piece_unit: string | null;
  weight_unit: string | null;
  stock_unit: string;
  price_unit: string;
  standard_weight: string | null;
  weight_price_type: 'ACTUAL_WEIGHT' | null;
  gross_weight_unit_price: string | null;
  net_weight_unit_price: string | null;
  delivery_weight_per_piece: string | null;
  delivery_weight_unit: '斤' | '公斤' | null;
  cost_price: string;
  base_price: string;
  market_price: string;
  stock_warning: string;
  status: 'ACTIVE' | 'DISABLED';
  inventory?: {
    stock_quantity: string;
    locked_quantity: string;
    available_quantity: string;
    stock_unit: string;
  };
};

export type ProductWorkbench = {
  product: Product & { skus: Sku[] };
  prices: PriceRules;
  inventory_logs: Array<{
    id: string;
    sku_id: string;
    sku_name: string;
    operation_type: string;
    change_quantity: string;
    before_quantity: string;
    after_quantity: string;
    stock_unit: string;
    reason: string;
    operator_id: string | null;
    created_at: string;
  }>;
  purchases: Array<{
    id: string;
    purchase_no: string;
    purchase_date: string | null;
    status: string;
    remark: string | null;
    sku_id: string;
    sku_name: string;
    purchase_price: string;
    purchase_unit: string;
    ordered_quantity: string;
    supplier_id: string;
    supplier_name: string;
    created_at: string;
  }>;
  operation_logs: Array<{
    id: string;
    operator_name: string;
    action_code: string;
    before_data: Record<string, unknown> | null;
    after_data: Record<string, unknown> | null;
    created_at: string;
  }>;
};

export type Inventory = {
  id: string;
  warehouse_id: string;
  sku_id: string;
  product_name: string;
  sku_code: string;
  sku_name: string;
  sale_type: 'PIECE' | 'WEIGHT';
  stock_unit: string;
  stock_quantity: string;
  locked_quantity: string;
  available_quantity: string;
  cost_price: string;
  stock_warning: string;
  warning: boolean;
};

export type HomeBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  banner_type: 'ACTIVITY' | 'MARKET' | 'NEW_ARRIVAL';
  link_type: 'NONE' | 'PRODUCT' | 'CATEGORY' | 'URL';
  link_id: string | null;
  link_value: string | null;
  sort: number;
  status: 'ACTIVE' | 'DISABLED';
  start_time: string | null;
  end_time: string | null;
};

export type HomeCategory = {
  id: string;
  category_id: string;
  title: string;
  image_url: string | null;
  category_name: string;
  parent_name: string | null;
  sort: number;
  status: 'ACTIVE' | 'DISABLED';
};

export type HomeProduct = {
  id: string;
  product_id: string;
  product_name: string;
  position: 'HOT' | 'NEW' | 'RECOMMEND';
  sort: number;
  status: 'ACTIVE' | 'DISABLED';
};

export const catalogApi = {
  async homeOperations(): Promise<{
    banners: HomeBanner[];
    categories: HomeCategory[];
    home_products: HomeProduct[];
    products: Array<{ id: string; name: string; origin: string | null }>;
    category_options: Array<{
      id: string;
      name: string;
      parent_name: string;
      image: string | null;
    }>;
  }> {
    return (
      await apiClient.get<Envelope<{
        banners: HomeBanner[];
        categories: HomeCategory[];
        home_products: HomeProduct[];
        products: Array<{ id: string; name: string; origin: string | null }>;
        category_options: Array<{
          id: string;
          name: string;
          parent_name: string;
          image: string | null;
        }>;
      }>>('/admin/home-operations')
    ).data.data;
  },
  async saveHomeBanner(
    id: string | null,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (id) await apiClient.put(`/admin/home-operations/banners/${id}`, data);
    else await apiClient.post('/admin/home-operations/banners', data);
  },
  async deleteHomeBanner(id: string): Promise<void> {
    await apiClient.delete(`/admin/home-operations/banners/${id}`);
  },
  async saveHomeCategory(
    id: string | null,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (id) await apiClient.put(`/admin/home-operations/categories/${id}`, data);
    else await apiClient.post('/admin/home-operations/categories', data);
  },
  async deleteHomeCategory(id: string): Promise<void> {
    await apiClient.delete(`/admin/home-operations/categories/${id}`);
  },
  async saveHomeProduct(
    id: string | null,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (id) await apiClient.put(`/admin/home-operations/products/${id}`, data);
    else await apiClient.post('/admin/home-operations/products', data);
  },
  async deleteHomeProduct(id: string): Promise<void> {
    await apiClient.delete(`/admin/home-operations/products/${id}`);
  },
  async categoryTree(): Promise<CategoryNode[]> {
    return (
      await apiClient.get<Envelope<CategoryNode[]>>('/admin/categories/tree')
    ).data.data;
  },
  async saveCategory(
    id: string | null,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (id) await apiClient.put(`/admin/categories/${id}`, data);
    else await apiClient.post('/admin/categories', data);
  },
  async deleteCategory(id: string): Promise<void> {
    await apiClient.delete(`/admin/categories/${id}`);
  },
  async listProducts(params: Record<string, unknown> = {}): Promise<{
    items: Product[];
    pagination: { total: number };
  }> {
    return (
      await apiClient.get<Envelope<{
        items: Product[];
        pagination: { total: number };
      }>>('/admin/products', { params })
    ).data.data;
  },
  async saveProduct(
    id: string | null,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (id) await apiClient.put(`/admin/products/${id}`, data);
    else await apiClient.post('/admin/products', data);
  },
  async product(id: string): Promise<Product> {
    return (
      await apiClient.get<Envelope<Product>>(`/admin/products/${id}`)
    ).data.data;
  },
  async productWorkbench(id: string): Promise<ProductWorkbench> {
    return (
      await apiClient.get<Envelope<ProductWorkbench>>(
        `/admin/products/${id}/workbench`,
      )
    ).data.data;
  },
  async saveProductDisplay(
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await apiClient.patch(`/admin/products/${id}/display`, data);
  },
  async duplicateProduct(id: string): Promise<Product> {
    return (
      await apiClient.post<Envelope<Product>>(`/admin/products/${id}/duplicate`)
    ).data.data;
  },
  async deleteProduct(id: string): Promise<void> {
    await apiClient.delete(`/admin/products/${id}`);
  },
  async batchProducts(
    action: 'ON_SALE' | 'OFF_SALE' | 'DELETE',
    ids: string[],
  ): Promise<void> {
    await apiClient.post('/admin/products/batch', { action, ids });
  },
  async uploadMedia(file: File, type: 'image' | 'video'): Promise<{
    url: string;
    thumbnail_url: string | null;
    size: number;
    type: string;
    duration: number | null;
  }> {
    const form = new FormData();
    form.append('file', file);
    return (
      await apiClient.post(`/admin/upload/${type}`, form, {
        timeout: type === 'video' ? 600_000 : 60_000,
      })
    ).data.data;
  },
  async uploadImages(files: File[]): Promise<Array<{
    url: string;
    thumbnail_url: string | null;
    size: number;
    type: string;
    duration: null;
  }>> {
    const form = new FormData();
    for (const file of files) form.append('files[]', file);
    return (
      await apiClient.post('/admin/upload/images', form, {
        timeout: 120_000,
      })
    ).data.data;
  },
  async addProductMedia(
    productId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await apiClient.post(`/admin/products/${productId}/media`, data);
  },
  async sortProductMedia(
    productId: string,
    mediaId: string,
    sort: number,
  ): Promise<void> {
    await apiClient.patch(`/admin/products/${productId}/media/${mediaId}/sort`, {
      sort,
    });
  },
  async deleteProductMedia(productId: string, mediaId: string): Promise<void> {
    await apiClient.delete(`/admin/products/${productId}/media/${mediaId}`);
  },
  async addProductDescription(
    productId: string,
    data: { content_json: ProductDescription['content_json']; sort: number },
  ): Promise<void> {
    await apiClient.post(`/admin/products/${productId}/descriptions`, data);
  },
  async updateProductDescription(
    productId: string,
    id: string,
    data: { content_json: ProductDescription['content_json']; sort: number },
  ): Promise<void> {
    await apiClient.put(`/admin/products/${productId}/descriptions/${id}`, data);
  },
  async deleteProductDescription(productId: string, id: string): Promise<void> {
    await apiClient.delete(`/admin/products/${productId}/descriptions/${id}`);
  },
  async setProductStatus(id: string, status: Product['status']): Promise<void> {
    await apiClient.patch(`/admin/products/${id}/status`, { status });
  },
  async listSkus(params: Record<string, unknown> = {}): Promise<Sku[]> {
    return (
      await apiClient.get<Envelope<Sku[]>>('/admin/skus', { params })
    ).data.data;
  },
  async saveSku(
    id: string | null,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (id) await apiClient.put(`/admin/skus/${id}`, data);
    else await apiClient.post('/admin/skus', data);
  },
  async setSkuStatus(id: string, status: Sku['status']): Promise<void> {
    await apiClient.patch(`/admin/skus/${id}/status`, { status });
  },
  async deleteSku(id: string): Promise<void> {
    await apiClient.delete(`/admin/skus/${id}`);
  },
  async listInventory(): Promise<Inventory[]> {
    return (
      await apiClient.get<Envelope<Inventory[]>>('/admin/inventory')
    ).data.data;
  },
  async inventoryReferences(): Promise<{
    warehouses: Array<{ id: string; warehouse_name: string }>;
    skus: Array<{
      id: string;
      product_name: string;
      sku_name: string;
      stock_unit: string;
      sale_type: string;
    }>;
  }> {
    return (
      await apiClient.get<Envelope<{
        warehouses: Array<{ id: string; warehouse_name: string }>;
        skus: Array<{
          id: string;
          product_name: string;
          sku_name: string;
          stock_unit: string;
          sale_type: string;
        }>;
      }>>('/admin/inventory/reference-data')
    ).data.data;
  },
  async adjustInventory(data: Record<string, unknown>): Promise<void> {
    await apiClient.post('/admin/inventory/adjustments', data);
  },
  async priceReferences(): Promise<PriceReferences> {
    return (
      await apiClient.get<Envelope<PriceReferences>>(
        '/admin/prices/reference-data',
      )
    ).data.data;
  },
  async listPrices(): Promise<PriceRules> {
    return (
      await apiClient.get<Envelope<PriceRules>>('/admin/prices')
    ).data.data;
  },
  async upsertLevelPrice(data: Record<string, unknown>): Promise<void> {
    await apiClient.put('/admin/prices/levels', data);
  },
  async upsertCustomerPrice(data: Record<string, unknown>): Promise<void> {
    await apiClient.put('/admin/prices/customers', data);
  },
  async createQuantityPrice(data: Record<string, unknown>): Promise<void> {
    await apiClient.post('/admin/prices/quantities', data);
  },
  async deletePrice(
    type: 'levels' | 'customers' | 'quantities',
    id: string,
  ): Promise<void> {
    await apiClient.delete(`/admin/prices/${type}/${id}`);
  },
  async calculatePrice(data: Record<string, unknown>): Promise<PriceResult> {
    return (
      await apiClient.post<Envelope<PriceResult>>(
        '/admin/prices/calculate',
        data,
      )
    ).data.data;
  },
};

export type PriceReferences = {
  skus: Array<{
    id: string;
    product_name: string;
    sku_name: string;
    sale_type: string;
    price_unit: string;
    base_price: string;
  }>;
  customers: Array<{ id: string; customer_name: string; level_id: string }>;
  levels: Array<{ id: string; name: string; level_code: string }>;
};

export type PriceRules = {
  level_prices: Array<{
    id: string;
    level_id: string;
    sku_id: string;
    price: string;
    status: string;
  }>;
  customer_prices: Array<{
    id: string;
    customer_id: string;
    sku_id: string;
    price: string;
    status: string;
  }>;
  quantity_prices: Array<{
    id: string;
    sku_id: string;
    min_quantity: string;
    max_quantity: string | null;
    price: string;
    status: string;
  }>;
};

export type PriceResult = {
  base_price: string;
  level_price: string | null;
  customer_price: string | null;
  quantity_price: string | null;
  price_source: string;
  final_unit_price: string;
  price_unit: string;
};
