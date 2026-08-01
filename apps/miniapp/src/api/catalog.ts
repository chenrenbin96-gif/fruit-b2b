import { request, resolveAssetUrl } from './request';

export type CategoryNode = {
  id: string;
  parent_id: string | null;
  name: string;
  image: string | null;
  sort: number;
  children: CategoryNode[];
};

export type CatalogSku = {
  id: string;
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
  unit: string;
  grade: string;
  base_price: string;
  inventory: {
    stock_quantity: string;
    locked_quantity: string;
    available_quantity: string;
    stock_unit: string;
  };
  price: {
    base_price: string;
    level_price: string | null;
    customer_price: string | null;
    quantity_price: string | null;
    final_unit_price: string;
    price_source: string;
    price_unit: string;
  };
};

export type CatalogProduct = {
  id: string;
  product_code: string;
  category_id: string;
  name: string;
  main_image: string | null;
  origin: string | null;
  brand: string | null;
  description: string | null;
  status: string;
  category: { id: string; name: string; parent_id: string | null };
  skus: CatalogSku[];
  media: Array<{
    id: string;
    media_type: 'VIDEO' | 'IMAGE';
    url: string;
    thumbnail_url: string | null;
    sort: number;
    status: 'ENABLE' | 'DISABLE';
  }>;
  descriptions: Array<{
    id: string;
    content_json:
      | { type: 'TEXT'; text: string }
      | { type: 'IMAGE'; url: string };
    sort: number;
  }>;
  delivery: unknown | null;
  logistics: unknown | null;
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
};

export type HomeCategoryEntry = {
  id: string;
  category_id: string;
  title: string;
  image_url: string | null;
  category_name: string;
  parent_name: string | null;
};

export type HomeConfig = {
  banner: HomeBanner[];
  categories: HomeCategoryEntry[];
  hotProducts: CatalogProduct[];
  newProducts: CatalogProduct[];
  recommendProducts: CatalogProduct[];
};

export type HomeContent = {
  banners: HomeBanner[];
  recommended_products: CatalogProduct[];
  hot_products: CatalogProduct[];
  new_products: CatalogProduct[];
  special_products: CatalogProduct[];
  frequent_products: CatalogProduct[];
};

export type CatalogFilters = {
  levels: string[];
  origins: string[];
  brands: string[];
  specifications: string[];
  price_ranges: Array<{ label: string; min: number; max: number | null }>;
  stock_options: Array<{ label: string; value: 'AVAILABLE' | 'LOW' | 'OUT' }>;
};

export const miniCatalogApi = {
  async homeConfig(): Promise<HomeConfig> {
    const data = (await request<HomeConfig>({ url: '/home/config' })).data;
    return {
      ...data,
      banner: arrayOrEmpty(data?.banner).map((item) => ({
        ...item,
        image_url: resolveAssetUrl(item.image_url),
      })),
      categories: arrayOrEmpty(data?.categories).map((item) => ({
        ...item,
        image_url: resolveAssetUrl(item.image_url),
      })),
      hotProducts: arrayOrEmpty(data?.hotProducts).map(normalizeProduct),
      newProducts: arrayOrEmpty(data?.newProducts).map(normalizeProduct),
      recommendProducts: arrayOrEmpty(data?.recommendProducts).map(normalizeProduct),
    };
  },
  async home(): Promise<HomeContent> {
    const data = (await request<HomeContent>({ url: '/catalog/home' })).data;
    return {
      ...data,
      banners: arrayOrEmpty(data?.banners).map((item) => ({
        ...item,
        image_url: resolveAssetUrl(item.image_url),
      })),
      recommended_products: arrayOrEmpty(data?.recommended_products).map(normalizeProduct),
      hot_products: arrayOrEmpty(data?.hot_products).map(normalizeProduct),
      new_products: arrayOrEmpty(data?.new_products).map(normalizeProduct),
      special_products: arrayOrEmpty(data?.special_products).map(normalizeProduct),
      frequent_products: arrayOrEmpty(data?.frequent_products).map(normalizeProduct),
    };
  },
  async categories(): Promise<CategoryNode[]> {
    const rows = (await request<CategoryNode[]>({
      url: '/catalog/categories/tree',
    })).data;
    return arrayOrEmpty(rows).map(normalizeCategory);
  },
  async filters(categoryId?: string): Promise<CatalogFilters> {
    const query = categoryId
      ? `?category_id=${encodeURIComponent(categoryId)}`
      : '';
    const data = (
      await request<CatalogFilters>({ url: `/catalog/filters${query}` })
    ).data;
    return normalizeFilters(data);
  },
  async products(params: {
    category_id?: string;
    keyword?: string;
    page?: number;
    page_size?: number;
  }): Promise<{
    items: CatalogProduct[];
    pagination: { page: number; total: number; total_pages: number };
  }> {
    const query = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join('&');
    const data = (
      await request<{
        items: CatalogProduct[];
        pagination: { page: number; total: number; total_pages: number };
      }>({
        url: `/catalog/products${query ? `?${query}` : ''}`,
      })
    ).data;
    return {
      ...data,
      items: arrayOrEmpty(data?.items).map(normalizeProduct),
      pagination: {
        page: Number(data?.pagination?.page ?? params.page ?? 1),
        total: Number(data?.pagination?.total ?? 0),
        total_pages: Math.max(
          1,
          Number(data?.pagination?.total_pages ?? 1),
        ),
      },
    };
  },
  async product(id: string): Promise<CatalogProduct> {
    return normalizeProduct((await request<CatalogProduct>({
      url: `/catalog/products/${id}`,
    })).data);
  },
  async recommendations(): Promise<{
    hot_selling: CatalogProduct[];
    new_arrivals: CatalogProduct[];
    recently_purchased: CatalogProduct[];
  }> {
    const data = (
      await request<{
        hot_selling: CatalogProduct[];
        new_arrivals: CatalogProduct[];
        recently_purchased: CatalogProduct[];
      }>({ url: '/catalog/products/recommendations' })
    ).data;
    return {
      hot_selling: arrayOrEmpty(data?.hot_selling).map(normalizeProduct),
      new_arrivals: arrayOrEmpty(data?.new_arrivals).map(normalizeProduct),
      recently_purchased: arrayOrEmpty(data?.recently_purchased).map(normalizeProduct),
    };
  },
};

function normalizeProduct(product: CatalogProduct): CatalogProduct {
  const basePrice = '0.0000';
  return {
    ...product,
    main_image: resolveAssetUrl(product.main_image),
    category: product.category ?? {
      id: product.category_id ?? '',
      name: '',
      parent_id: null,
    },
    skus: arrayOrEmpty(product.skus).map((sku) => ({
      ...sku,
      inventory: {
        stock_quantity: sku.inventory?.stock_quantity ?? '0.000',
        locked_quantity: sku.inventory?.locked_quantity ?? '0.000',
        available_quantity: sku.inventory?.available_quantity ?? '0.000',
        stock_unit: sku.inventory?.stock_unit ?? sku.stock_unit ?? '',
      },
      price: {
        base_price: sku.price?.base_price ?? sku.base_price ?? basePrice,
        level_price: sku.price?.level_price ?? null,
        customer_price: sku.price?.customer_price ?? null,
        quantity_price: sku.price?.quantity_price ?? null,
        final_unit_price:
          sku.price?.final_unit_price ?? sku.base_price ?? basePrice,
        price_source: sku.price?.price_source ?? 'BASE',
        price_unit: sku.price?.price_unit ?? sku.price_unit ?? '',
      },
    })),
    media: arrayOrEmpty(product.media).map((item) => ({
      ...item,
      url: resolveAssetUrl(item.url) ?? item.url,
      thumbnail_url: resolveAssetUrl(item.thumbnail_url),
    })),
    descriptions: arrayOrEmpty(product.descriptions)
      .filter((item) => Boolean(item?.content_json))
      .map((item) => ({
        ...item,
        content_json:
          item.content_json.type === 'IMAGE'
            ? {
                ...item.content_json,
                url:
                  resolveAssetUrl(item.content_json.url) ??
                  item.content_json.url,
              }
            : item.content_json,
      })),
    delivery: product.delivery ?? null,
    logistics: product.logistics ?? null,
  };
}

function normalizeCategory(category: CategoryNode): CategoryNode {
  return {
    ...category,
    image: resolveAssetUrl(category.image),
    children: arrayOrEmpty(category.children).map(normalizeCategory),
  };
}

function normalizeFilters(filters: CatalogFilters | null | undefined): CatalogFilters {
  return {
    levels: arrayOrEmpty(filters?.levels),
    origins: arrayOrEmpty(filters?.origins),
    brands: arrayOrEmpty(filters?.brands),
    specifications: arrayOrEmpty(filters?.specifications),
    price_ranges: arrayOrEmpty(filters?.price_ranges),
    stock_options: arrayOrEmpty(filters?.stock_options),
  };
}

function arrayOrEmpty<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}
