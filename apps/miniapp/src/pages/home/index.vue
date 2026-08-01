<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';

import type { CatalogProduct, CatalogSku, HomeBanner, HomeCategoryEntry } from '@/api/catalog';
import { miniCatalogApi } from '@/api/catalog';
import { getAccessToken } from '@/api/token';
import {
  purchaseOrderApi,
  type PurchaseCart,
  type PurchaseCartItem,
  type PurchasedProduct,
} from '@/api/orders';
import HomeBannerView from '@/components/home/HomeBanner.vue';
import HomeCategoryGrid from '@/components/home/HomeCategoryGrid.vue';
import HomeProductTabs from '@/components/home/HomeProductTabs.vue';
import ProductCard from '@/components/home/ProductCard.vue';
import FrequentProducts from '@/components/home/FrequentProducts.vue';

const statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 20;
const keyword = ref('');
const banners = ref<HomeBanner[]>([]);
const categories = ref<HomeCategoryEntry[]>([]);
const hotProducts = ref<CatalogProduct[]>([]);
const newProducts = ref<CatalogProduct[]>([]);
const recommendProducts = ref<CatalogProduct[]>([]);
const activeTab = ref<'HOT' | 'NEW' | 'RECOMMEND'>('HOT');
const loading = ref(false);
const operatingSkuId = ref('');
const cart = ref<PurchaseCart | null>(null);
const frequentProducts = ref<PurchasedProduct[]>([]);
const activeProducts = computed(() => ({
  HOT: hotProducts.value,
  NEW: newProducts.value,
  RECOMMEND: recommendProducts.value,
})[activeTab.value]);

async function load(): Promise<void> {
  if (!getAccessToken()) return;
  loading.value = true;
  try {
    const [home, currentCart, frequent] = await Promise.all([
      miniCatalogApi.homeConfig(),
      purchaseOrderApi.cart(),
      purchaseOrderApi.frequentProducts(),
    ]);
    banners.value = home.banner;
    categories.value = home.categories;
    hotProducts.value = home.hotProducts;
    newProducts.value = home.newProducts;
    recommendProducts.value = home.recommendProducts;
    cart.value = currentCart;
    frequentProducts.value = frequent;
  } catch (error) {
    uni.showToast({ title: (error as { message?: string }).message ?? '首页加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function search(): void {
  const value = keyword.value.trim();
  if (value) uni.setStorageSync('catalog_search_keyword', value);
  uni.switchTab({ url: '/pages/sourcing/index' });
}
function updateKeyword(event: Event): void {
  keyword.value = (event as unknown as { detail: { value: string } }).detail.value;
}
function openUser(): void {
  if (!getAccessToken()) uni.navigateTo({ url: '/pages/login/index' });
  else uni.switchTab({ url: '/pages/profile/index' });
}
function openProduct(id: string): void {
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` });
}
function openCategory(id: string): void {
  uni.setStorageSync('catalog_category_id', id);
  uni.switchTab({ url: '/pages/sourcing/index' });
}
function openBanner(item: HomeBanner): void {
  const target = item.link_id || item.link_value;
  if (!target || item.link_type === 'NONE') return;
  if (item.link_type === 'PRODUCT') openProduct(target);
  if (item.link_type === 'CATEGORY') openCategory(target);
}
function firstSku(product: CatalogProduct): CatalogSku | undefined {
  return product.skus[0];
}
function findCartItem(skuId: string): PurchaseCartItem | undefined {
  return cart.value?.items.find((item) => item.sku_id === skuId);
}
function cartQuantity(product: CatalogProduct): number {
  const sku = firstSku(product);
  const item = sku ? findCartItem(sku.id) : undefined;
  return Number(item?.quantity ?? 0);
}
function add(product: CatalogProduct): void {
  const sku = firstSku(product);
  if (!sku || Number(sku.inventory.available_quantity) <= 0) {
    uni.showToast({ title: '库存不足', icon: 'none' });
    return;
  }
  void addPiece(sku);
}
async function addPiece(sku: CatalogSku): Promise<void> {
  operatingSkuId.value = sku.id;
  try {
    cart.value = await purchaseOrderApi.addItem({ sku_id: sku.id, quantity: 1 });
    uni.showToast({ title: '已加入进货单', icon: 'success' });
  } catch (error) {
    showError(error);
  } finally {
    operatingSkuId.value = '';
  }
}
async function decrease(product: CatalogProduct): Promise<void> {
  const sku = firstSku(product);
  const item = sku ? findCartItem(sku.id) : undefined;
  if (!sku || !item) return;
  const current = cartQuantity(product);
  operatingSkuId.value = sku.id;
  try {
    cart.value = current <= 1
      ? await purchaseOrderApi.removeItem(item.id)
      : await purchaseOrderApi.updateItem(item.id, { quantity: current - 1 });
  } catch (error) {
    showError(error);
  } finally {
    operatingSkuId.value = '';
  }
}
function showError(error: unknown): void {
  uni.showToast({ title: (error as { message?: string }).message ?? '加入进货单失败', icon: 'none' });
}

async function addFrequent(item: PurchasedProduct): Promise<void> {
  operatingSkuId.value = item.sku_id;
  try {
    cart.value = await purchaseOrderApi.addItem({
      sku_id: item.sku_id,
      quantity: Math.max(1, Math.round(Number(item.last_quantity) || 1)),
    });
    uni.showToast({ title: '已加入进货单', icon: 'success' });
  } catch (error) {
    showError(error);
  } finally {
    operatingSkuId.value = '';
  }
}

onShow(load);
</script>

<template>
  <view class="home-page">
    <view class="hero">
      <HomeBannerView :items="banners" @select="openBanner" />
      <view class="custom-nav" :style="{ paddingTop: `${statusBarHeight}px` }">
        <view class="nav-row">
          <view class="brand"><text>鲜</text><view><strong>鲜链云</strong><small>水果供应链</small></view></view>
          <view class="search-box"><text>⌕</text><input :value="keyword" confirm-type="search" placeholder="搜索水果、商品、产地" @input="updateKeyword" @confirm="search" /></view>
          <view class="user-entry" @click="openUser">我的</view>
        </view>
      </view>
    </view>

    <view v-if="!getAccessToken()" class="login-card">
      <view><strong>登录查看批发客户价</strong><text>库存、价格与采购单按客户实时展示</text></view>
      <button @click="openUser">立即登录</button>
    </view>
    <template v-else>
      <view class="category-panel">
        <view class="section-heading"><strong>快速找货</strong><text>产地货源一键直达</text></view>
        <HomeCategoryGrid :items="categories" @select="openCategory" />
      </view>
      <view class="product-panel">
        <HomeProductTabs v-model="activeTab" />
        <view class="product-grid">
          <ProductCard
            v-for="product in activeProducts"
            :key="product.id"
            :product="product"
            :quantity="cartQuantity(product)"
            :loading="operatingSkuId === firstSku(product)?.id"
            @open="openProduct(product.id)"
            @add="add(product)"
            @increase="add(product)"
            @decrease="decrease(product)"
          />
        </view>
        <view v-if="loading" class="loading">正在同步今日货源…</view>
      </view>
      <FrequentProducts
        :items="frequentProducts"
        :loading-sku-id="operatingSkuId"
        @open="openProduct"
        @add="addFrequent"
      />
    </template>
  </view>
</template>

<style scoped lang="scss">
.home-page { min-height:100vh; padding-bottom:44rpx; background:#f3f5f1; }
.hero { position:relative; height:560rpx; }
.custom-nav { position:absolute; top:0; right:0; left:0; z-index:5; box-sizing:border-box; padding-right:20rpx; padding-left:20rpx; }
.nav-row { display:flex; height:92rpx; align-items:center; gap:12rpx; }
.brand { display:flex; color:#fff; align-items:center; gap:9rpx; text-shadow:0 2rpx 8rpx rgba(0,0,0,.24); }
.brand > text { display:grid; width:48rpx; height:48rpx; border-radius:14rpx; color:#294023; background:#f9c800; font-size:25rpx; font-weight:900; text-shadow:none; place-items:center; }
.brand view,.brand strong,.brand small { display:block; }
.brand strong { font-size:24rpx; white-space:nowrap; }
.brand small { margin-top:1rpx; font-size:13rpx; letter-spacing:1rpx; white-space:nowrap; }
.search-box { display:flex; height:64rpx; padding:0 18rpx; border:1rpx solid rgba(255,255,255,.5); border-radius:34rpx; background:rgba(255,255,255,.88); align-items:center; backdrop-filter:blur(12rpx); flex:1; }
.search-box > text { margin-right:7rpx; color:#597061; font-size:28rpx; }
.search-box input { height:62rpx; color:#2f4035; font-size:20rpx; flex:1; }
.user-entry { display:grid; width:58rpx; height:58rpx; border:1rpx solid rgba(255,255,255,.55); border-radius:50%; color:#fff; background:rgba(24,66,42,.45); font-size:17rpx; place-items:center; backdrop-filter:blur(10rpx); }
.login-card { display:flex; margin:-20rpx 20rpx 20rpx; padding:28rpx; border-radius:22rpx; background:#fff; align-items:center; justify-content:space-between; box-shadow:0 12rpx 32rpx rgba(32,65,43,.1); }
.login-card view,.login-card strong,.login-card text { display:block; }
.login-card strong { color:#264432; font-size:27rpx; }
.login-card text { margin-top:5rpx; color:#859088; font-size:19rpx; }
.login-card button { margin:0; color:#fff; background:#276c47; font-size:21rpx; }
.category-panel { position:relative; z-index:6; margin:-28rpx 18rpx 18rpx; border-radius:26rpx; background:#fff; box-shadow:0 14rpx 34rpx rgba(30,67,43,.1); }
.section-heading { display:flex; padding:25rpx 26rpx 0; align-items:baseline; gap:13rpx; }
.section-heading strong { color:#263e2f; font-size:29rpx; }
.section-heading text { color:#9a9f99; font-size:18rpx; }
.product-panel { overflow:hidden; margin:0 18rpx; border-radius:24rpx; background:#fff; }
.product-grid { display:grid; padding:20rpx; background:#f7f8f5; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14rpx; align-items:start; }
.loading { padding:30rpx; color:#8e9891; text-align:center; }
</style>
