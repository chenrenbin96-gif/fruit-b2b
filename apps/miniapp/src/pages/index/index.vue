<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';

import BannerSwiper from '@/components/sourcing/BannerSwiper.vue';
import HomeHeader from '@/components/home/HomeHeader.vue';
import WholesaleProductCard from '@/components/catalog/WholesaleProductCard.vue';
import {
  miniCatalogApi,
  type CatalogProduct,
  type CatalogSku,
  type CategoryNode,
  type HomeBanner,
} from '@/api/catalog';
import {
  purchaseOrderApi,
  type PurchaseCart,
  type PurchaseCartItem,
} from '@/api/orders';
import { getAccessToken } from '@/api/token';

const keyword = ref('');
const loading = ref(false);
const banners = ref<HomeBanner[]>([]);
const categories = ref<CategoryNode[]>([]);
const hot = ref<CatalogProduct[]>([]);
const newest = ref<CatalogProduct[]>([]);
const recommended = ref<CatalogProduct[]>([]);
const cart = ref<PurchaseCart | null>(null);
const operatingSkuId = ref('');
const activeProductTab = ref<'HOT' | 'NEW' | 'RECOMMENDED'>('HOT');
const productTabs = [
  { value: 'HOT' as const, label: '爆款' },
  { value: 'NEW' as const, label: '新品' },
  { value: 'RECOMMENDED' as const, label: '推荐' },
];
const quickCategories = computed(() => {
  const flattened = categories.value.flatMap((item) =>
    item.children.length ? item.children : [item],
  );
  return flattened.slice(0, 12);
});
const activeProducts = computed(() => {
  const selected = {
    HOT: hot.value,
    NEW: newest.value,
    RECOMMENDED: recommended.value,
  }[activeProductTab.value];
  return selected.length ? selected : recommended.value;
});

async function load(): Promise<void> {
  if (!getAccessToken()) return;
  loading.value = true;
  try {
    const [home, categoryTree, currentCart] = await Promise.all([
      miniCatalogApi.home(),
      miniCatalogApi.categories(),
      purchaseOrderApi.cart(),
    ]);
    banners.value = home.banners;
    categories.value = categoryTree;
    hot.value = home.hot_products;
    newest.value = home.new_products;
    recommended.value = home.recommended_products;
    cart.value = currentCart;
  } catch (error) {
    uni.showToast({
      title: (error as { message?: string }).message ?? '首页货源加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

function search(): void {
  const value = keyword.value.trim();
  if (value) uni.setStorageSync('catalog_search_keyword', value);
  uni.switchTab({ url: '/pages/sourcing/index' });
}

function openProduct(id: string): void {
  uni.navigateTo({ url: `/pages/product/detail?id=${id}` });
}

function openBanner(item: HomeBanner): void {
  if (!item.link_value || item.link_type === 'NONE') return;
  if (item.link_type === 'PRODUCT') openProduct(item.link_value);
  if (item.link_type === 'CATEGORY') {
    uni.setStorageSync('catalog_category_id', item.link_value);
    uni.switchTab({ url: '/pages/sourcing/index' });
  }
}

function openCategory(id: string): void {
  uni.setStorageSync('catalog_category_id', id);
  uni.switchTab({ url: '/pages/sourcing/index' });
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
  const item = sku ? findCartItem(sku.id) : undefined;
  if (!sku || !item) return;
  const current = cartQuantity(product);
  operatingSkuId.value = sku.id;
  try {
    cart.value =
      current <= 1
        ? await purchaseOrderApi.removeItem(item.id)
        : await purchaseOrderApi.updateItem(
            item.id,
            { quantity: current - 1 },
          );
  } catch (error) {
    showCartError(error);
  } finally {
    operatingSkuId.value = '';
  }
}

function showCartError(error: unknown): void {
  uni.showToast({
    title: (error as { message?: string }).message ?? '加入进货单失败',
    icon: 'none',
  });
}

function login(): void {
  uni.navigateTo({ url: '/pages/login/index' });
}

onShow(load);
</script>

<template>
  <view class="home-page">
    <HomeHeader v-model="keyword" @search="search" />

    <view v-if="!getAccessToken()" class="login-panel">
      <view>
        <strong>登录查看客户批发价</strong>
        <text>实时库存、专属价格和历史采购均按客户展示</text>
      </view>
      <button @click="login">客户登录</button>
    </view>

    <template v-else>
      <BannerSwiper :items="banners" @select="openBanner" />

      <view class="category-section">
        <view class="section-title"><strong>快速分类</strong><text>按品类找货</text></view>
        <scroll-view class="category-scroll" scroll-x>
          <view class="category-row">
            <view
              v-for="category in quickCategories"
              :key="category.id"
              class="category-card"
              @click="openCategory(category.id)"
            >
              <image v-if="category.image" :src="category.image" mode="aspectFill" />
              <view v-else>{{ category.name.slice(0, 1) }}</view>
              <text>{{ category.name }}</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="product-module">
        <view class="product-tabs">
          <view
            v-for="tab in productTabs"
            :key="tab.value"
            :class="{ active: activeProductTab === tab.value }"
            @click="activeProductTab = tab.value"
          >
            {{ tab.label }}
          </view>
        </view>
        <view class="product-grid">
          <WholesaleProductCard
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
        <view v-if="!activeProducts.length" class="empty-section">运营货源配置中</view>
      </view>
      <view v-if="loading" class="loading">正在同步供应链货源…</view>
    </template>

  </view>
</template>

<style scoped lang="scss">
.home-page { min-height:100vh; padding-bottom:40rpx; background:#f4f5f2; }
.login-panel { display:flex; margin:24rpx; padding:32rpx; border-radius:20rpx; background:#fff; align-items:center; justify-content:space-between; }
.login-panel view,.login-panel strong,.login-panel text { display:block; }
.login-panel strong { color:#23382b; font-size:28rpx; }
.login-panel text { max-width:420rpx; margin-top:7rpx; color:#89938c; font-size:20rpx; }
.login-panel button { margin:0; color:#fff; background:#226b47; font-size:23rpx; }
.category-section,.product-module { margin-top:16rpx; padding:22rpx 0; background:#fff; }
.section-title { display:flex; padding:0 22rpx 18rpx; align-items:baseline; gap:12rpx; }
.section-title strong { color:#23352a; font-size:30rpx; }
.section-title text { color:#909991; font-size:19rpx; }
.category-scroll { width:100%; }
.category-row { display:flex; width:max-content; padding:0 22rpx; gap:14rpx; }
.category-card { display:flex; width:132rpx; padding:15rpx 10rpx; border:1rpx solid #e8ece8; border-radius:16rpx; background:#fafbf9; align-items:center; flex:none; flex-direction:column; }
.category-card image,.category-card > view { display:grid; width:76rpx; height:76rpx; border-radius:17rpx; color:#2e6847; background:#e7efe5; font-size:30rpx; font-weight:800; place-items:center; }
.category-card text { display:block; overflow:hidden; width:100%; margin-top:9rpx; color:#3f4b43; font-size:21rpx; text-align:center; text-overflow:ellipsis; white-space:nowrap; }
.product-tabs { display:flex; margin:0 22rpx 20rpx; border-bottom:1rpx solid #ecefeb; gap:44rpx; }
.product-tabs > view { position:relative; padding:5rpx 4rpx 18rpx; color:#7f8982; font-size:28rpx; }
.product-tabs > view.active { color:#1f3929; font-weight:800; }
.product-tabs > view.active::after { position:absolute; right:3rpx; bottom:0; left:3rpx; height:7rpx; border-radius:6rpx; background:#f9c800; content:""; }
.product-grid { display:grid; padding:0 22rpx; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14rpx; align-items:start; }
.empty-section { padding:44rpx; color:#9ba39d; font-size:22rpx; text-align:center; }
.loading { padding:40rpx; color:#8e9891; text-align:center; }
</style>
