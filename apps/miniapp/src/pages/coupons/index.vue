<script setup lang="ts">
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';

import { purchaseOrderApi, type CustomerCoupon } from '@/api/orders';

const loading = ref(false);
const coupons = ref<CustomerCoupon[]>([]);
const available = computed(() =>
  coupons.value.filter((item) => item.status === 'AVAILABLE'),
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    coupons.value = await purchaseOrderApi.coupons();
  } catch {
    uni.showToast({ title: '优惠券加载失败', icon: 'none' });
  } finally {
    loading.value = false;
    uni.stopPullDownRefresh();
  }
}

onShow(load);
onPullDownRefresh(load);
</script>

<template>
  <view class="coupon-page">
    <view class="coupon-page__summary">
      <text>可用优惠券</text>
      <strong>{{ available.length }}</strong>
      <text>张</text>
    </view>
    <view
      v-for="item in coupons"
      :key="item.id"
      class="coupon-card"
      :class="{ 'coupon-card--muted': item.status !== 'AVAILABLE' }"
    >
      <view>
        <strong>¥{{ item.coupon.discount_amount }}</strong>
        <text>满 ¥{{ item.coupon.min_amount }} 可用</text>
      </view>
      <view>
        <text class="coupon-card__name">{{ item.coupon.name }}</text>
        <text>{{ item.coupon.start_time.slice(0, 10) }} 至 {{ item.coupon.end_time.slice(0, 10) }}</text>
      </view>
      <text class="coupon-card__status">
        {{ item.status === "AVAILABLE" ? "可用" : item.status === "LOCKED" ? "已预占" : "不可用" }}
      </text>
    </view>
    <view v-if="!loading && coupons.length === 0" class="coupon-page__empty">
      暂无优惠券
    </view>
  </view>
</template>

<style scoped lang="scss">
.coupon-page { min-height: 100vh; padding: 28rpx; background: #f4f7f5; }
.coupon-page__summary { display: flex; padding: 30rpx; border-radius: 22rpx; color: #fff; background: #1f6a43; align-items: baseline; gap: 12rpx; }
.coupon-page__summary strong { font-size: 48rpx; }
.coupon-card { position: relative; display: grid; margin-top: 20rpx; padding: 28rpx; border-left: 8rpx solid #e15f2d; border-radius: 18rpx; background: #fff; grid-template-columns: 180rpx 1fr; gap: 22rpx; }
.coupon-card view text { display: block; margin-top: 8rpx; color: #8a948d; font-size: 21rpx; }
.coupon-card strong { color: #e15f2d; font-size: 38rpx; }
.coupon-card__name { color: #263a2e !important; font-size: 27rpx !important; font-weight: 700; }
.coupon-card__status { position: absolute; top: 20rpx; right: 24rpx; color: #1f6a43; font-size: 22rpx; }
.coupon-card--muted { border-left-color: #aab2ac; opacity: .65; }
.coupon-page__empty { padding: 120rpx 0; color: #929c95; text-align: center; }
</style>
