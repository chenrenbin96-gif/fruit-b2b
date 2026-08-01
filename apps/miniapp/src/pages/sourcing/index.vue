<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';

import BannerSwiper from '@/components/sourcing/BannerSwiper.vue';
import CartSummaryBar from '@/components/catalog/CartSummaryBar.vue';
import CategorySide from '@/components/sourcing/CategorySide.vue';
import CategoryTop from '@/components/sourcing/CategoryTop.vue';
import FilterBar from '@/components/sourcing/FilterBar.vue';
import ProductCard from '@/components/sourcing/ProductCard.vue';
import SearchBar from '@/components/sourcing/SearchBar.vue';
import {
  miniCatalogApi,
  type CatalogProduct,
  type CatalogSku,
  type CatalogFilters,
  type CategoryNode,
  type HomeBanner,
} from '@/api/catalog';
import {
  purchaseOrderApi,
  type PurchaseCart,
  type PurchaseCartItem,
} from '@/api/orders';
import { getAccessToken } from '@/api/token';

type ProductFilters = {
  level: string;
  origin: string;
  specification: string;
  priceRange: string;
  stock: '' | 'AVAILABLE' | 'LOW' | 'OUT';
};

const loading = ref(false);
const loadingMore = ref(false);
const filtersLoading = ref(false);
const loadError = ref('');
const keyword = ref('');
const categories = ref<CategoryNode[]>([]);
const activeRootId = ref('');
const activeChildId = ref('');
const products = ref<CatalogProduct[]>([]);
const banners = ref<HomeBanner[]>([]);
const cart = ref<PurchaseCart | null>(null);
const page = ref(1);
const totalPages = ref(1);
const operatingSkuId = ref('');
const batchMode = ref(false);
const selectedSkuIds = ref<Set<string>>(new Set());
const batchAdding = ref(false);
const filters = ref<ProductFilters>({
  level: '',
  origin: '',
  specification: '',
  priceRange: '',
  stock: '',
});
const filterMeta = ref<CatalogFilters>({
  levels: [],
  origins: [],
  brands: [],
  specifications: [],
  price_ranges: [],
  stock_options: [],
});

const activeRoot = computed(() =>
  categories.value.find((item) => item.id === activeRootId.value),
);
const filterOptions = computed(() => ({
  origins:
    filterMeta.value.origins.length > 0
      ? filterMeta.value.origins
      : unique(products.value.map((item) => item.origin)),
  brands: filterMeta.value.brands,
  specifications:
    filterMeta.value.specifications.length > 0
      ? filterMeta.value.specifications
      : unique(
          products.value.flatMap((item) =>
            item.skus.map((sku) => sku.specification || sku.sku_name),
          ),
        ),
}));
const displayedProducts = computed(() =>
  products.value.filter((product) => {
    const sku = product.skus[0];
    return (
      (!filters.value.origin || product.origin === filters.value.origin) &&
      (!filters.value.level ||
        product.skus.some((item) => item.grade === filters.value.level)) &&
      (!filters.value.specification ||
        product.skus.some(
          (item) =>
            (item.specification || item.sku_name) ===
            filters.value.specification,
        )) &&
      matchesPrice(sku) &&
      matchesStock(sku)
    );
  }),
);
const cartCount = computed(() => cart.value?.items?.length ?? 0);
const cartAmount = computed(
  () => cart.value?.summary?.estimated_amount ?? '0.00',
);

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((item): item is string => Boolean(item)))];
}

function matchesPrice(sku?: CatalogSku): boolean {
  if (!sku || !filters.value.priceRange) return true;
  const range = filterMeta.value.price_ranges.find(
    (item) => item.label === filters.value.priceRange,
  );
  if (!range) return true;
  const price = Number(sku.price.final_unit_price);
  return price >= range.min && (range.max === null || price < range.max);
}

function matchesStock(sku?: CatalogSku): boolean {
  if (!sku || !filters.value.stock) return true;
  const available = Number(sku.inventory.available_quantity);
  const warning = 10;
  if (filters.value.stock === 'OUT') return available <= 0;
  if (filters.value.stock === 'LOW') return available > 0 && available <= warning;
  return available > warning;
}

async function initialize(): Promise<void> {
  if (!getAccessToken()) {
    uni.navigateTo({ url: '/pages/login/index' });
    return;
  }
  loading.value = true;
  loadError.value = '';
  try {
    const pendingKeyword = String(
      uni.getStorageSync('catalog_search_keyword') || '',
    );
    const pendingCategoryId = String(
      uni.getStorageSync('catalog_category_id') || '',
    );
    if (pendingKeyword) {
      keyword.value = pendingKeyword;
      uni.removeStorageSync('catalog_search_keyword');
    }

    const categoryTree = await miniCatalogApi.categories();
    categories.value = categoryTree;

    const [home, currentCart] = await Promise.all([
      miniCatalogApi.home().catch(() => null),
      purchaseOrderApi.cart().catch(() => null),
    ]);
    banners.value = home?.banners ?? [];
    cart.value = currentCart;

    const pendingRoot =
      categories.value.find((item) => item.id === pendingCategoryId) ??
      categories.value.find((item) =>
        (item.children ?? []).some((child) => child.id === pendingCategoryId),
      );
    const root =
      pendingRoot ??
      categories.value.find((item) => item.id === activeRootId.value) ??
      categories.value[0];
    activeRootId.value = root?.id ?? '';
    const currentChild =
      root?.children?.find((item) => item.id === pendingCategoryId) ??
      root?.children?.find((item) => item.id === activeChildId.value);
    activeChildId.value = currentChild?.id ?? root?.children[0]?.id ?? '';
    if (pendingCategoryId) uni.removeStorageSync('catalog_category_id');
    await loadFilters(activeChildId.value || activeRootId.value);
    await loadProducts(true);
  } catch (error) {
    loadError.value = '商品加载失败，请重新刷新';
    uni.showToast({
      title: loadError.value,
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

async function selectRoot(id: string): Promise<void> {
  loading.value = true;
  loadError.value = '';
  activeRootId.value = id;
  try {
    const root = categories.value.find((item) => item.id === id);
    activeChildId.value = root?.children?.[0]?.id ?? '';
    resetFilters();
    selectedSkuIds.value = new Set();
    await loadFilters(activeChildId.value || id);
    await loadProducts(true);
  } catch {
    loadError.value = '商品加载失败，请重新刷新';
    uni.showToast({ title: loadError.value, icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function selectChild(id: string): Promise<void> {
  loading.value = true;
  loadError.value = '';
  try {
    activeChildId.value = id;
    resetFilters();
    selectedSkuIds.value = new Set();
    await loadFilters(id);
    await loadProducts(true);
  } catch {
    loadError.value = '商品加载失败，请重新刷新';
    uni.showToast({ title: loadError.value, icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function loadFilters(categoryId?: string): Promise<void> {
  filtersLoading.value = true;
  try {
    filterMeta.value = await miniCatalogApi.filters(categoryId);
  } catch (error) {
    filterMeta.value = {
      levels: [],
      origins: [],
      brands: [],
      specifications: [],
      price_ranges: [],
      stock_options: [],
    };
    console.warn('[sourcing] filter metadata request failed', error);
  } finally {
    filtersLoading.value = false;
  }
}

async function loadProducts(reset = true): Promise<void> {
  if (reset) {
    page.value = 1;
    loading.value = true;
    loadError.value = '';
  } else {
    if (loadingMore.value || page.value >= totalPages.value) return;
    page.value += 1;
    loadingMore.value = true;
  }
  try {
    const result = await miniCatalogApi.products({
      category_id: activeChildId.value || activeRootId.value || undefined,
      keyword: keyword.value.trim() || undefined,
      page: page.value,
      page_size: 20,
    });
    products.value = reset
      ? result.items
      : [...products.value, ...result.items];
    totalPages.value = result.pagination.total_pages;
  } catch (error) {
    if (!reset) page.value -= 1;
    loadError.value = '商品加载失败，请重新刷新';
    uni.showToast({
      title: loadError.value,
      icon: 'none',
    });
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function search(): void {
  void loadProducts(true);
}

function retryLoad(): void {
  void initialize();
}

function resetFilters(): void {
  filters.value = {
    level: '',
    origin: '',
    specification: '',
    priceRange: '',
    stock: '',
  };
}

function openProduct(id: string): void {
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` });
}

function openBanner(item: HomeBanner): void {
  if (!item.link_value || item.link_type === 'NONE') return;
  if (item.link_type === 'PRODUCT') openProduct(item.link_value);
  if (item.link_type === 'CATEGORY') void selectRoot(item.link_value);
}

function openCart(): void {
  uni.switchTab({ url: '/pages/purchase-list/index' });
}

function toggleBatchMode(): void {
  batchMode.value = !batchMode.value;
  if (!batchMode.value) selectedSkuIds.value = new Set();
}

function toggleBatchProduct(product: CatalogProduct): void {
  const sku = firstSku(product);
  if (!sku) return;
  const next = new Set(selectedSkuIds.value);
  if (next.has(sku.id)) next.delete(sku.id);
  else if (Number(sku.inventory.available_quantity) > 0) next.add(sku.id);
  selectedSkuIds.value = next;
}

async function batchAdd(): Promise<void> {
  const selected = displayedProducts.value
    .map((product) => ({ product, sku: firstSku(product) }))
    .filter(
      (item): item is { product: CatalogProduct; sku: CatalogSku } =>
        Boolean(item.sku && selectedSkuIds.value.has(item.sku.id)),
    );
  if (!selected.length) {
    uni.showToast({ title: '请先选择商品', icon: 'none' });
    return;
  }
  batchAdding.value = true;
  try {
    cart.value = await purchaseOrderApi.batchAdd(
      selected.map(({ sku }) => ({ sku_id: sku.id, quantity: 1 })),
    );
    selectedSkuIds.value = new Set();
    batchMode.value = false;
    uni.showToast({ title: `已加入${selected.length}种商品`, icon: 'success' });
  } catch (error) {
    showCartError(error);
  } finally {
    batchAdding.value = false;
  }
}

function firstSku(product: CatalogProduct): CatalogSku | undefined {
  return product.skus[0];
}

function cartItem(skuId: string): PurchaseCartItem | undefined {
  return cart.value?.items.find((item) => item.sku_id === skuId);
}

function cartQuantity(product: CatalogProduct): number {
  const sku = firstSku(product);
  if (!sku) return 0;
  const item = cartItem(sku.id);
  return Number(item?.quantity ?? 0);
}

function requestAdd(product: CatalogProduct): void {
  const sku = firstSku(product);
  if (!sku) return;
  if (Number(sku.inventory.available_quantity) <= 0) {
    uni.showToast({ title: '库存不足', icon: 'none' });
    return;
  }
  void addPiece(sku);
}

async function addPiece(sku: CatalogSku): Promise<void> {
  operatingSkuId.value = sku.id;
  try {
    cart.value = await purchaseOrderApi.addItem({
      sku_id: sku.id,
      quantity: 1,
    });
    uni.showToast({ title: '加入成功', icon: 'success' });
  } catch (error) {
    showCartError(error);
  } finally {
    operatingSkuId.value = '';
  }
}

async function decrease(product: CatalogProduct): Promise<void> {
  const sku = firstSku(product);
  if (!sku) return;
  const item = cartItem(sku.id);
  if (!item) return;
  const current = cartQuantity(product);
  operatingSkuId.value = sku.id;
  try {
    if (current <= 1) {
      cart.value = await purchaseOrderApi.removeItem(item.id);
    } else {
      cart.value = await purchaseOrderApi.updateItem(
        item.id,
        { quantity: current - 1 },
      );
    }
  } catch (error) {
    showCartError(error);
  } finally {
    operatingSkuId.value = '';
  }
}

function showCartError(error: unknown): void {
  const apiError = error as { code?: string; message?: string };
  uni.showToast({
    title:
      apiError.code === 'INSUFFICIENT_AVAILABLE_STOCK'
        ? '库存不足'
        : apiError.message ?? '加入采购单失败',
    icon: 'none',
  });
}

onShow(initialize);
</script>

<template>
  <view class="sourcing-page">
    <SearchBar v-model="keyword" @search="search" />
    <CategoryTop
      :items="categories"
      :active-id="activeRootId"
      @select="selectRoot"
    />

    <view class="catalog-body">
      <CategorySide
        :items="activeRoot?.children ?? []"
        :active-id="activeChildId"
        @select="selectChild"
      />

      <scroll-view
        class="supply-panel"
        scroll-y
        lower-threshold="120"
        @scrolltolower="loadProducts(false)"
      >
        <BannerSwiper :items="banners" @select="openBanner" />
        <FilterBar
          v-model="filters"
          :levels="filterMeta.levels"
          :origins="filterOptions.origins"
          :specifications="filterOptions.specifications"
          :price-ranges="filterMeta.price_ranges"
          :stock-options="filterMeta.stock_options"
        />

        <view class="result-heading">
          <strong>{{ activeRoot?.children.find((item) => item.id === activeChildId)?.name || activeRoot?.name || '全部商品' }}</strong>
          <view><text>{{ displayedProducts.length }} 个商品</text><button @click="toggleBatchMode">{{ batchMode ? '取消批量' : '批量采购' }}</button></view>
        </view>

        <view
          v-for="product in displayedProducts"
          :key="product.id"
          class="selectable-product"
          :class="{ selected: batchMode && selectedSkuIds.has(firstSku(product)?.id || '') }"
        >
          <view
            v-if="batchMode"
            class="batch-checkbox"
            @click.stop="toggleBatchProduct(product)"
          >
            {{ selectedSkuIds.has(firstSku(product)?.id || '') ? '✓' : '' }}
          </view>
          <ProductCard
            :product="product"
            :quantity="cartQuantity(product)"
            :loading="operatingSkuId === firstSku(product)?.id"
            @open="batchMode ? toggleBatchProduct(product) : openProduct(product.id)"
            @add="requestAdd(product)"
            @increase="requestAdd(product)"
            @decrease="decrease(product)"
          />
        </view>

        <view v-if="loading" class="state">正在加载批发货源…</view>
        <view v-else-if="loadError" class="state error-state">
          <text>{{ loadError }}</text>
          <button @click="retryLoad">重新加载</button>
        </view>
        <view v-else-if="displayedProducts.length === 0" class="state">
          当前条件暂无在售商品
        </view>
        <view v-else-if="loadingMore" class="state small">正在加载更多…</view>
        <view
          v-else-if="products.length && page >= totalPages"
          class="state small"
        >
          已加载全部商品
        </view>
      </scroll-view>
    </view>

    <CartSummaryBar
      v-if="!batchMode"
      :count="cartCount"
      :amount="cartAmount"
      @open="openCart"
    />
    <view v-else class="batch-bar">
      <text>已选 {{ selectedSkuIds.size }} 种商品</text>
      <button :loading="batchAdding" @click="batchAdd">批量加入进货单</button>
    </view>

  </view>
</template>

<style scoped lang="scss">
.sourcing-page {
  height: calc(100vh - 50px);
  overflow: hidden;
  background: #fff;
}

.catalog-body {
  display: flex;
  height: calc(100vh - 222rpx - 50px);
}

.supply-panel {
  height: 100%;
  background: #fff;
  flex: 1;
}

.result-heading {
  display: flex;
  padding: 16rpx 20rpx 12rpx;
  align-items: center;
  justify-content: space-between;

  strong {
    color: #222620;
    font-size: 26rpx;
  }

  text {
    color: #969c96;
    font-size: 18rpx;
  }
}
.result-heading > view { display:flex; align-items:center; gap:10rpx; }
.result-heading button { height:48rpx; margin:0; padding:0 14rpx; border-radius:24rpx; color:#2d6747; background:#e7f1e9; font-size:18rpx; line-height:48rpx; }
.selectable-product { position:relative; }
.selectable-product.selected { background:#fffbed; }
.batch-checkbox { position:absolute; z-index:8; top:20rpx; left:20rpx; display:grid; width:38rpx; height:38rpx; border:2rpx solid #d0d6d1; border-radius:50%; color:#443700; background:#fff; font-size:20rpx; place-items:center; }
.selectable-product.selected .batch-checkbox { border-color:#f9c800; background:#f9c800; }
.batch-bar { position:fixed; z-index:40; right:0; bottom:50px; left:0; display:flex; height:104rpx; padding:0 24rpx; border-top:1rpx solid #e4e9e5; background:#fff; align-items:center; }
.batch-bar text { color:#405046; font-size:23rpx; flex:1; }
.batch-bar button { width:270rpx; margin:0; border-radius:42rpx; color:#433700; background:#f9c800; font-size:24rpx; font-weight:800; }

.state {
  padding: 90rpx 20rpx;
  color: #979d98;
  font-size: 23rpx;
  text-align: center;

  &.small {
    padding: 24rpx 20rpx 46rpx;
    font-size: 19rpx;
  }
}

.error-state {
  text {
    display: block;
  }

  button {
    width: 180rpx;
    height: 62rpx;
    margin: 24rpx auto 0;
    border: 0;
    border-radius: 31rpx;
    color: #4c3e00;
    background: #f9c800;
    font-size: 22rpx;
    line-height: 62rpx;

    &::after {
      border: 0;
    }
  }
}

.dialog-mask {
  position: fixed;
  z-index: 60;
  inset: 0;
  display: grid;
  padding: 36rpx;
  background: rgb(0 0 0 / 45%);
  place-items: center;
}

.weight-dialog {
  width: 100%;
  padding: 36rpx;
  border-radius: 26rpx;
  background: #fff;
}

.dialog-title,
.dialog-product,
.dialog-copy,
.available {
  display: block;
}

.dialog-title {
  color: #222620;
  font-size: 32rpx;
  font-weight: 900;
  text-align: center;
}

.dialog-product {
  margin-top: 20rpx;
  color: #353b36;
  font-size: 26rpx;
  font-weight: 700;
}

.dialog-copy {
  margin-top: 9rpx;
  color: #8d948e;
  font-size: 21rpx;
}

.weight-input {
  display: flex;
  height: 92rpx;
  margin-top: 22rpx;
  padding: 0 24rpx;
  border: 2rpx solid #f0cb38;
  border-radius: 14rpx;
  background: #fffdf2;
  align-items: center;

  input {
    height: 88rpx;
    font-size: 34rpx;
    flex: 1;
  }

  text {
    color: #4d544e;
    font-size: 25rpx;
    font-weight: 700;
  }
}

.available {
  margin-top: 10rpx;
  color: #7b837c;
  font-size: 19rpx;
}

.dialog-actions {
  display: grid;
  margin-top: 30rpx;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;

  button {
    height: 78rpx;
    margin: 0;
    border: 0;
    border-radius: 14rpx;
    color: #555d56;
    background: #f1f2ef;
    font-size: 25rpx;
    line-height: 78rpx;

    &::after { border: 0; }
  }

  .confirm {
    color: #302700;
    background: #f9c800;
    font-weight: 800;
  }
}
</style>
