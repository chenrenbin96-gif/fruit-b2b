<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';

import {
  miniCatalogApi,
  type CatalogProduct,
  type CatalogSku,
} from '@/api/catalog';
import { purchaseOrderApi } from '@/api/orders';
import { getAccessToken } from '@/api/token';

const loading = ref(true);
const product = ref<CatalogProduct | null>(null);
const purchaseValues = ref<Record<string, number>>({});
const addingSkuId = ref('');
const selectedSkuId = ref('');
const tags = ref<string[]>([]);
const selectedSku = computed(() =>
  product.value?.skus.find((item) => item.id === selectedSkuId.value),
);
const imageMedia = computed(() =>
  product.value?.media?.filter((item) => item.media_type === 'IMAGE') ?? [],
);
const mediaItems = computed(() => {
  const rows = [...(product.value?.media ?? [])].sort((a, b) => {
    if (a.media_type !== b.media_type) return a.media_type === 'VIDEO' ? -1 : 1;
    return a.sort - b.sort;
  });
  if (!rows.length && product.value?.main_image) {
    return [{
      id: 'main',
      media_type: 'IMAGE' as const,
      url: product.value.main_image,
      thumbnail_url: null,
      sort: 0,
      status: 'ENABLE' as const,
    }];
  }
  return rows;
});

function previewImage(url: string): void {
  const urls = imageMedia.value.map((item) => item.url);
  uni.previewImage({ current: url, urls });
}

function purchaseValue(sku: CatalogSku): number {
  return purchaseValues.value[sku.id] ?? 1;
}

function setPurchaseValue(sku: CatalogSku, value: string | number): void {
  purchaseValues.value[sku.id] = Number(value);
}

function setPurchaseValueFromInput(sku: CatalogSku, event: Event): void {
  const inputEvent = event as unknown as { detail: { value: string } };
  setPurchaseValue(sku, inputEvent.detail.value);
}

async function addToPurchaseCart(
  sku: CatalogSku,
  checkout = false,
): Promise<void> {
  if (!getAccessToken()) {
    uni.navigateTo({ url: '/pages/login/index' });
    return;
  }

  const value = purchaseValue(sku);
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    !Number.isInteger(value)
  ) {
    uni.showToast({
      title: '请输入正整数购买数量',
      icon: 'none',
    });
    return;
  }

  addingSkuId.value = sku.id;
  try {
    await purchaseOrderApi.addItem({ sku_id: sku.id, quantity: value });
    uni.showToast({ title: '已加入采购单', icon: 'success' });
    if (checkout) {
      setTimeout(
        () => uni.navigateTo({ url: '/pages/order-confirm/index' }),
        350,
      );
    }
  } catch (error) {
    uni.showToast({
      title: (error as { message?: string }).message ?? '加入采购单失败',
      icon: 'none',
    });
  } finally {
    addingSkuId.value = '';
  }
}

onLoad(async (options) => {
  const id = String(options?.id ?? '');
  if (!id) {
    uni.showToast({ title: '商品参数错误', icon: 'none' });
    return;
  }
  try {
    product.value = await miniCatalogApi.product(id);
    selectedSkuId.value = product.value.skus[0]?.id ?? '';
    const config = await miniCatalogApi.homeConfig().catch(() => null);
    tags.value = [
      config?.hotProducts.some((item) => item.id === id) ? '爆款' : '',
      config?.newProducts.some((item) => item.id === id) ? '新品' : '',
      config?.recommendProducts.some((item) => item.id === id) ? '推荐' : '',
    ].filter(Boolean);
  } catch {
    uni.showToast({ title: '商品加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <view v-if="product" class="detail-page">
    <swiper
      v-if="mediaItems.length"
      class="hero-swiper"
      indicator-dots
      circular
    >
      <swiper-item
        v-for="item in mediaItems"
        :key="item.id"
      >
        <video
          v-if="item.media_type === 'VIDEO'"
          class="hero-video"
          :src="item.url"
          :poster="item.thumbnail_url || undefined"
          controls
          show-fullscreen-btn
          show-play-btn
        />
        <image
          v-else
          class="hero-image"
          :src="item.url"
          mode="aspectFill"
          @click="previewImage(item.url)"
        />
      </swiper-item>
    </swiper>
    <view v-else class="hero-image hero-placeholder">鲜链云</view>

    <view class="product-panel">
      <text class="category">{{ product.category.name }}</text>
      <text class="title">{{ product.name }}</text>
      <view class="tags">
        <text v-for="tag in tags.length ? tags : ['产地直供']" :key="tag">{{ tag }}</text>
      </view>
      <text class="meta">
        {{ product.origin || '产地待补充' }}
        <template v-if="product.brand"> · {{ product.brand }}</template>
      </text>
      <text v-if="product.description" class="description">
        {{ product.description }}
      </text>
    </view>

    <view class="sku-section">
      <text class="section-title">可采购规格</text>
      <view
        v-for="sku in product.skus"
        :key="sku.id"
        class="sku-card"
        :class="{ selected: selectedSkuId === sku.id }"
        @click="selectedSkuId = sku.id"
      >
        <view class="sku-heading">
          <view>
            <text class="sku-name">{{ sku.sku_name }}</text>
            <text class="specification">{{ sku.specification || sku.unit }}</text>
          </view>
          <text :class="sku.sale_type === 'PIECE' ? 'mode piece' : 'mode weight'">
            {{ sku.sale_type === 'PIECE' ? '按件销售' : '称重销售' }}
          </text>
        </view>
        <view class="sku-footer">
          <view class="price">
            <text>¥{{ sku.price.final_unit_price }}</text>
            <text>/{{ sku.price_unit }}</text>
            <text v-if="sku.sale_type === 'PIECE' && sku.price.level_price" class="member">
              等级价 ¥{{ sku.price.level_price }}
            </text>
            <text
              v-if="sku.sale_type === 'PIECE' && Number(sku.base_price) > Number(sku.price.final_unit_price)"
              class="market"
            >
              市场价 ¥{{ sku.base_price }}
            </text>
          </view>
          <text class="stock">
            可售 {{ sku.inventory.available_quantity }} {{ sku.stock_unit }}
          </text>
        </view>
        <view class="purchase-row">
          <view class="purchase-input">
            <input
              :value="purchaseValue(sku)"
              type="digit"
              @input="setPurchaseValueFromInput(sku, $event)"
            />
            <text>{{ sku.piece_unit }}</text>
          </view>
        </view>
        <view v-if="sku.sale_type === 'WEIGHT'" class="weight-pricing">
          <text>标准规格：{{ sku.standard_weight }}{{ sku.weight_unit }}装</text>
          <text>计价：实际称重结算</text>
          <text>毛重单价：¥{{ sku.gross_weight_unit_price }}/{{ sku.weight_unit }}</text>
          <text>净重单价：¥{{ sku.net_weight_unit_price }}/{{ sku.weight_unit }}</text>
        </view>
      </view>
    </view>
    <view v-if="product.descriptions.length" class="product-description-panel">
      <text class="section-title">商品详情说明</text>
      <template v-for="item in product.descriptions" :key="item.id">
        <text v-if="item.content_json.type === 'TEXT'" class="description-node">
          {{ item.content_json.text }}
        </text>
        <image
          v-else
          class="description-image"
          :src="item.content_json.url"
          mode="widthFix"
          @click="previewImage(item.content_json.url)"
        />
      </template>
    </view>
    <view class="detail-bottom-space" />
    <view v-if="selectedSku" class="detail-actions">
      <view class="selected-amount">
        <text>采购数量</text>
        <view>
          <button @click="setPurchaseValue(selectedSku, Math.max(1, purchaseValue(selectedSku) - 1))">−</button>
          <input
            :value="purchaseValue(selectedSku)"
            type="digit"
            @input="setPurchaseValueFromInput(selectedSku, $event)"
          />
          <text>{{ selectedSku.unit }}</text>
          <button @click="setPurchaseValue(selectedSku, purchaseValue(selectedSku) + 1)">+</button>
        </view>
      </view>
      <button class="cart-button" @click="addToPurchaseCart(selectedSku)">加入进货单</button>
      <button class="buy-button" @click="addToPurchaseCart(selectedSku, true)">立即采购</button>
    </view>
  </view>
  <view v-else-if="loading" class="state">正在加载商品…</view>
  <view v-else class="state">商品不存在或已下架</view>
</template>

<style scoped lang="scss">
.detail-page {
  padding-bottom: 150rpx;
}

.hero-swiper,
.hero-image {
  display: grid;
  width: 100%;
  height: 520rpx;
  place-items: center;
}
.hero-video { display:block; width:100%; height:520rpx; background:#000; }
.tags { display:flex; margin-top:12rpx; gap:8rpx; }
.tags text { padding:5rpx 10rpx; border-radius:7rpx; color:#8a6300; background:#fff3b5; font-size:19rpx; }

.hero-placeholder {
  color: #2f6746;
  background:
    radial-gradient(circle at 72% 25%, #f3f0ad, transparent 28%),
    linear-gradient(150deg, #d5ebc7, #a9d0b4);
  font-size: 64rpx;
  font-weight: 800;
}

.product-panel,
.sku-section {
  margin: 20rpx;
  padding: 28rpx;
  border-radius: 22rpx;
  background: #fff;
}

.category,
.title,
.meta,
.description,
.section-title,
.sku-name,
.specification {
  display: block;
}

.category {
  color: #3c7954;
  font-size: 22rpx;
  font-weight: 700;
}

.title {
  margin-top: 10rpx;
  font-size: 40rpx;
  font-weight: 800;
}

.meta,
.description {
  margin-top: 12rpx;
  color: #7c8780;
  font-size: 25rpx;
}

.description {
  line-height: 1.7;
}

.section-title {
  margin-bottom: 20rpx;
  font-size: 31rpx;
  font-weight: 800;
}

.sku-card {
  margin-top: 16rpx;
  padding: 24rpx;
  border: 1rpx solid #e3eae5;
  border-radius: 16rpx;
}
.sku-card.selected { border:2rpx solid #f9c800; background:#fffdf2; }
.member,.market { display:block; margin-top:4rpx; font-size:18rpx !important; }
.member { color:#9c7221; }
.market { color:#9ba29d; text-decoration:line-through; }
.detail-actions { position:fixed; z-index:30; right:0; bottom:0; left:0; display:flex; min-height:116rpx; padding:12rpx 18rpx calc(12rpx + env(safe-area-inset-bottom)); border-top:1rpx solid #e6ebe7; background:#fff; align-items:center; gap:10rpx; }
.selected-amount { min-width:220rpx; flex:1; }
.selected-amount > text { display:block; color:#7e8982; font-size:17rpx; }
.selected-amount > view { display:flex; margin-top:5rpx; align-items:center; }
.selected-amount button { width:42rpx; height:42rpx; margin:0; padding:0; border-radius:50%; color:#fff; background:#26714a; font-size:22rpx; line-height:42rpx; }
.selected-amount input { width:58rpx; text-align:center; }
.selected-amount view > text { font-size:18rpx; }
.detail-actions > .cart-button,.detail-actions > .buy-button { width:170rpx; margin:0; padding:0; border-radius:38rpx; font-size:22rpx; }
.cart-button { color:#276143; background:#e6f0e8; }
.buy-button { color:#443700; background:#f9c800; }

.sku-heading,
.sku-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sku-name {
  font-size: 28rpx;
  font-weight: 700;
}

.specification {
  margin-top: 7rpx;
  color: #929b95;
  font-size: 22rpx;
}

.mode {
  padding: 7rpx 12rpx;
  border-radius: 8rpx;
  font-size: 21rpx;
}

.piece {
  color: #256f47;
  background: #eaf5ee;
}

.weight {
  color: #8c5d17;
  background: #fff3dc;
}

.sku-footer {
  margin-top: 22rpx;
}

.price {
  color: #d95f2c;

  text:first-child {
    font-size: 35rpx;
    font-weight: 800;
  }

  text:last-child {
    font-size: 22rpx;
  }
}

.stock {
  color: #7d8881;
  font-size: 22rpx;
}
.weight-pricing{display:grid;margin-top:16rpx;padding:14rpx;border-radius:12rpx;color:#71511f;background:#fff7df;gap:6rpx;font-size:21rpx}.product-description-panel{margin:20rpx;padding:28rpx;border-radius:22rpx;background:#fff}.description-node{display:block;margin-bottom:18rpx;color:#4c5b52;font-size:25rpx;line-height:1.8;white-space:pre-wrap}.description-image{display:block;width:100%;margin-bottom:18rpx;border-radius:12rpx}

.purchase-row {
  display: flex;
  margin-top: 22rpx;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;

  button {
    margin: 0;
    border-radius: 12rpx;
    color: #fff;
    background: #246e49;
    font-size: 23rpx;
  }
}

.purchase-input {
  display: flex;
  height: 66rpx;
  padding: 0 18rpx;
  border: 1rpx solid #dfe8e1;
  border-radius: 12rpx;
  background: #f7faf8;
  align-items: center;
  gap: 10rpx;

  input {
    width: 120rpx;
    font-size: 26rpx;
  }

  text {
    color: #6e7a72;
    font-size: 23rpx;
  }
}

.state {
  padding: 200rpx 20rpx;
  color: #8b958f;
  text-align: center;
}
</style>
