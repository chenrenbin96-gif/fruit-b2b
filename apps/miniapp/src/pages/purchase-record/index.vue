<script setup lang="ts">
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';

import {
  purchaseOrderApi,
  type PurchaseSummary,
  type PurchasedProduct,
} from '@/api/orders';

const summary = ref<PurchaseSummary | null>(null);
const recent = ref<PurchasedProduct[]>([]);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    [summary.value, recent.value] = await Promise.all([
      purchaseOrderApi.purchaseSummary(),
      purchaseOrderApi.purchasedProducts(),
    ]);
  } catch (error) {
    uni.showToast({
      title: (error as { message?: string }).message ?? '采购统计加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
    uni.stopPullDownRefresh();
  }
}

function openOrders(): void {
  uni.navigateTo({ url: '/pages/orders/index' });
}

onShow(load);
onPullDownRefresh(load);
</script>

<template>
  <view class="record-page">
    <view class="hero">
      <text>本月采购</text>
      <strong>¥{{ summary?.month.purchase_amount ?? '0.00' }}</strong>
      <view>
        <text>采购次数 {{ summary?.month.purchase_count ?? 0 }}次</text>
        <text>购买最多 {{ summary?.most_purchased?.product_name ?? '—' }}</text>
      </view>
    </view>
    <view class="heading"><strong>历史采购商品</strong><text @click="openOrders">查看订单 ›</text></view>
    <view v-for="item in recent.slice(0, 20)" :key="item.sku_id" class="row">
      <image v-if="item.main_image" :src="item.main_image" mode="aspectFill" />
      <view v-else class="placeholder">{{ item.product_name.slice(0, 1) }}</view>
      <view><strong>{{ item.product_name }}</strong><text>{{ item.sku_name }} · 共采购{{ item.purchase_count }}次</text></view>
      <text>{{ item.last_purchase_time.slice(0, 10) }}</text>
    </view>
    <view v-if="loading" class="loading">正在统计采购记录…</view>
  </view>
</template>

<style scoped lang="scss">
.record-page { min-height:100vh; padding:22rpx; background:#f4f5f2; }
.hero { padding:34rpx; border-radius:24rpx; color:#fff; background:linear-gradient(135deg,#1d563a,#397d58); }
.hero > text,.hero > strong { display:block; }
.hero > text { color:#d1e1d7; font-size:22rpx; }
.hero > strong { margin-top:8rpx; font-size:48rpx; }
.hero > view { display:flex; margin-top:24rpx; color:#dce8e0; font-size:21rpx; justify-content:space-between; }
.heading { display:flex; padding:28rpx 8rpx 16rpx; align-items:center; justify-content:space-between; }
.heading strong { color:#2b3e32; font-size:28rpx; }
.heading text { color:#718078; font-size:20rpx; }
.row { display:flex; margin-bottom:12rpx; padding:17rpx; border-radius:16rpx; background:#fff; align-items:center; gap:13rpx; }
.row image,.placeholder { display:grid; width:86rpx; height:86rpx; border-radius:12rpx; color:#2b6846; background:#e5eee2; font-size:30rpx; font-weight:900; place-items:center; }
.row > view:nth-child(2) { min-width:0; flex:1; }
.row strong,.row view text { display:block; }
.row strong { color:#2e3a32; font-size:23rpx; }
.row view text,.row > text { margin-top:5rpx; color:#89938c; font-size:17rpx; }
.loading { padding:60rpx; color:#88938c; text-align:center; }
</style>
