<script setup lang="ts">
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';

import {
  purchaseOrderApi,
  type PurchasedProduct,
} from '@/api/orders';
import { getAccessToken } from '@/api/token';

const items = ref<PurchasedProduct[]>([]);
const loading = ref(false);
const addingSkuId = ref('');

async function load(): Promise<void> {
  if (!getAccessToken()) return;
  loading.value = true;
  try {
    items.value = await purchaseOrderApi.purchasedProducts();
  } catch (error) {
    uni.showToast({
      title: (error as { message?: string }).message ?? '采购记录加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
    uni.stopPullDownRefresh();
  }
}

async function buyAgain(item: PurchasedProduct): Promise<void> {
  if (!item.purchasable) {
    uni.showToast({ title: '商品已下架或库存不足', icon: 'none' });
    return;
  }
  addingSkuId.value = item.sku_id;
  try {
    await purchaseOrderApi.addItem({
      sku_id: item.sku_id,
      quantity: Math.max(1, Math.round(Number(item.last_quantity))),
    });
    uni.showToast({ title: '已按上次数量加入', icon: 'success' });
  } catch (error) {
    uni.showToast({
      title: (error as { message?: string }).message ?? '再次购买失败',
      icon: 'none',
    });
  } finally {
    addingSkuId.value = '';
  }
}

function openCart(): void {
  uni.switchTab({ url: '/pages/purchase-list/index' });
}

onShow(load);
onPullDownRefresh(load);
</script>

<template>
  <view class="purchased-page">
    <view class="heading">
      <view><text>PURCHASE HISTORY</text><strong>买过商品</strong></view>
      <button @click="openCart">查看进货单</button>
    </view>
    <view class="tip">使用当前价格与库存重新加入，不复制历史成交价</view>

    <view v-if="items.length" class="list">
      <view v-for="item in items" :key="item.sku_id" class="record">
        <image v-if="item.main_image" :src="item.main_image" mode="aspectFill" />
        <view v-else class="visual">{{ item.product_name.slice(0, 1) }}</view>
        <view class="content">
          <strong>{{ item.product_name }}</strong>
          <text>{{ item.specification || item.sku_name }}</text>
          <text>
            上次购买 {{ Number(item.last_quantity) }}{{ item.unit }}
            · ¥{{ item.last_unit_price }}/{{ item.price_unit }}
          </text>
          <small>{{ item.last_purchase_time.slice(0, 10) }} · 已采购{{ item.purchase_count }}次</small>
          <text class="current">当前客户价 ¥{{ item.current_price }}/{{ item.price_unit }}</text>
        </view>
        <button
          class="reorder"
          :disabled="!item.purchasable"
          :loading="addingSkuId === item.sku_id"
          @click="buyAgain(item)"
        >
          {{ item.purchasable ? '再次购买' : '暂不可购' }}
        </button>
      </view>
    </view>
    <view v-else-if="loading" class="empty">正在读取采购记录…</view>
    <view v-else class="empty"><strong>暂无历史采购商品</strong></view>
  </view>
</template>

<style scoped lang="scss">
.purchased-page { min-height:100vh; padding:24rpx 22rpx 50rpx; background:#f4f5f2; }
.heading { display:flex; padding:12rpx 4rpx 20rpx; align-items:center; justify-content:space-between; }
.heading view,.heading text,.heading strong { display:block; }
.heading text { color:#64806d; font-size:17rpx; font-weight:700; letter-spacing:3rpx; }
.heading strong { margin-top:3rpx; color:#1e3025; font-size:40rpx; }
.heading button { height:60rpx; margin:0; padding:0 22rpx; border-radius:30rpx; color:#2f6144; background:#e8f0ea; font-size:21rpx; line-height:60rpx; }
.tip { padding:18rpx 22rpx; border-left:7rpx solid #f9c800; color:#776c40; background:#fff9dd; font-size:21rpx; }
.list { margin-top:18rpx; }
.record { display:flex; margin-bottom:14rpx; padding:18rpx; border-radius:18rpx; background:#fff; align-items:center; gap:14rpx; }
.record image,.visual { display:grid; width:116rpx; height:116rpx; border-radius:16rpx; color:#2f6747; background:#e4eee1; font-size:40rpx; font-weight:900; flex:none; place-items:center; }
.content { min-width:0; flex:1; }
.content strong,.content text,.content small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.content strong { color:#27352c; font-size:25rpx; }
.content text { margin-top:5rpx; color:#7e8982; font-size:18rpx; }
.content small { margin-top:6rpx; color:#a1a8a2; font-size:16rpx; }
.content .current { color:#d9513f; font-weight:700; }
.reorder { height:62rpx; margin:0; padding:0 15rpx; border-radius:31rpx; color:#fff; background:#26714a; font-size:19rpx; line-height:62rpx; white-space:nowrap; }
.empty { margin-top:100rpx; padding:70rpx; border-radius:20rpx; color:#849089; background:#fff; text-align:center; }
</style>
