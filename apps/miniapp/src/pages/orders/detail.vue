<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';

import { purchaseOrderApi, type CustomerOrder } from '@/api/orders';

const order = ref<CustomerOrder | null>(null);
const loading = ref(true);
const reordering = ref(false);
const orderItems = computed(() =>
  Array.isArray(order.value?.items) ? order.value.items : [],
);
const deliveryProgress = computed(() => {
  if (Array.isArray(order.value?.delivery_progress)) {
    return order.value.delivery_progress;
  }
  return Array.isArray(order.value?.fulfillment_progress)
    ? order.value.fulfillment_progress
    : [];
});
const statusText: Record<string, string> = {
  WAITING_REVIEW: '待仓库审核',
  APPROVED: '审核通过',
  PICKING: '备货中',
  WEIGHING: '称重中',
  WAITING_DELIVERY: '待配送',
  DELIVERING: '配送中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};
const deliveryText: Record<string, string> = {
  WAITING: '待配送',
  DELIVERING: '配送中',
  DELIVERED: '已送达',
  FAILED: '配送异常',
};

function formatProgressTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

async function reorder(): Promise<void> {
  if (!order.value) return;
  reordering.value = true;
  try {
    await purchaseOrderApi.reorder(order.value.id);
    uni.showToast({ title: '已按当前商品状态加入进货单', icon: 'success' });
    setTimeout(
      () => uni.switchTab({ url: '/pages/purchase-list/index' }),
      450,
    );
  } catch (error) {
    uni.showToast({
      title: (error as { message?: string }).message ?? '再次购买失败',
      icon: 'none',
    });
  } finally {
    reordering.value = false;
  }
}

function applyAfterSale(): void {
  if (!order.value) return;
  uni.navigateTo({ url: `/pages/after-sale/apply?order_id=${order.value.id}` });
}

onLoad(async (options) => {
  const orderId = String(options?.id ?? '').trim();
  if (!orderId) {
    loading.value = false;
    uni.showToast({ title: '订单参数无效', icon: 'none' });
    return;
  }
  try {
    order.value = await purchaseOrderApi.order(orderId);
  } catch (error) {
    uni.showToast({
      title: (error as { message?: string }).message ?? '订单加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <view v-if="order" class="detail-page">
    <view class="status-card">
      <text class="status">{{ statusText[order.status] ?? order.status }}</text>
      <text class="order-no">{{ order.order_no }}</text>
    </view>

    <view class="panel">
      <text class="panel-title">商品明细</text>
      <view v-for="item in orderItems" :key="item.id" class="item">
        <view>
          <text class="product">{{ item.product_name }}</text>
          <text class="sku">{{ item.sku_name }}</text>
        </view>
        <view class="item-value">
          <text>购买 {{ item.actual_quantity ?? item.planned_quantity }} {{ item.unit }}</text>
          <template v-if="item.sale_type === 'WEIGHT'">
            <text>预计 ¥{{ item.estimated_amount }}</text>
            <text v-if="item.actual_gross_weight">
              毛重 {{ item.actual_gross_weight }} {{ item.weight_unit }}
            </text>
            <text v-if="item.actual_net_weight">
              净重 {{ item.actual_net_weight }} {{ item.weight_unit }}
            </text>
          </template>
          <text>¥{{ item.final_amount ?? item.estimated_amount }}</text>
        </view>
      </view>
    </view>
    <view class="bottom-space" />
    <view class="reorder-bar">
      <text>商品将按当前价格和库存重新核算</text>
      <button v-if="order.status === 'COMPLETED'" class="after-sale-button" @click="applyAfterSale">申请售后</button>
      <button :loading="reordering" @click="reorder">再次购买</button>
    </view>

    <view class="panel amount-panel">
      <view><text>商品金额</text><text>¥{{ order.final_product_amount ?? order.estimated_product_amount }}</text></view>
      <view><text>优惠金额</text><text>-¥{{ order.final_amount ? order.discount_amount : order.estimated_discount_amount }}</text></view>
      <view><text>运费</text><text>¥{{ order.shipping_fee }}</text></view>
      <view v-if="order.amount_adjustment_type !== 'NONE'">
        <text>{{ order.amount_adjustment_type === 'REFUND' ? '退款' : '补款' }}</text>
        <text>¥{{ order.amount_adjustment }}</text>
      </view>
      <view class="total"><text>{{ order.final_amount ? '最终金额' : '预计金额' }}</text><text>¥{{ order.final_amount ?? order.estimated_amount }}</text></view>
    </view>

    <view class="panel">
      <text class="panel-title">物流进度</text>
      <view class="progress-list">
        <view
          v-for="step in deliveryProgress"
          :key="step.code"
          class="progress-step"
          :class="{ completed: step.completed, current: step.current }"
        >
          <view class="progress-dot">{{ step.completed ? '✓' : '' }}</view>
          <view>
            <text>{{ step.label }}</text>
            <text v-if="formatProgressTime(step.time)">{{ formatProgressTime(step.time) }}</text>
            <text v-else-if="step.current">当前环节</text>
          </view>
        </view>
      </view>
    </view>

    <view class="panel">
      <text class="panel-title">配送信息</text>
      <template v-if="order.delivery">
        <view class="delivery-row">
          <text>配送单</text><text>{{ order.delivery.delivery_no }}</text>
        </view>
        <view class="delivery-row">
          <text>配送状态</text><text>{{ deliveryText[order.delivery.status] ?? order.delivery.status }}</text>
        </view>
        <view v-if="order.delivery.signed_by" class="delivery-row">
          <text>签收人</text><text>{{ order.delivery.signed_by }}</text>
        </view>
      </template>
      <text v-else class="muted">仓库履约完成后生成配送单</text>
    </view>
  </view>
  <view v-else class="loading">{{ loading ? '正在加载…' : '订单不存在' }}</view>
</template>

<style scoped lang="scss">
.detail-page { min-height: 100vh; padding: 22rpx; }
.status-card { padding: 34rpx; border-radius: 22rpx; color: #fff; background: linear-gradient(140deg, #17462f, #2b7951); }
.status, .order-no, .panel-title, .product, .sku, .item-value text { display: block; }
.status { font-size: 34rpx; font-weight: 800; }
.order-no { margin-top: 10rpx; color: #cde0d3; font-size: 22rpx; }
.panel { margin-top: 20rpx; padding: 28rpx; border-radius: 22rpx; background: #fff; }
.panel-title { margin-bottom: 14rpx; font-size: 29rpx; font-weight: 800; }
.item, .amount-panel view, .delivery-row { display: flex; padding: 18rpx 0; border-bottom: 1rpx solid #edf1ee; align-items: center; justify-content: space-between; }
.product { font-size: 25rpx; }
.sku, .muted { margin-top: 5rpx; color: #8a948e; font-size: 21rpx; }
.item-value { color: #637068; font-size: 22rpx; text-align: right; }
.item-value text:last-child { margin-top: 5rpx; color: #d65e2c; }
.amount-panel view { color: #69756d; font-size: 24rpx; }
.amount-panel .total { color: #263a2d; font-size: 28rpx; font-weight: 800; }
.amount-panel .total text:last-child { color: #d65e2c; }
.delivery-row { color: #657168; font-size: 24rpx; }
.progress-step { position:relative; display:flex; min-height:78rpx; color:#9aa39d; gap:18rpx; }
.progress-step::before { position:absolute; top:28rpx; bottom:-6rpx; left:15rpx; width:2rpx; content:''; background:#e0e5e1; }
.progress-step:last-child::before { display:none; }
.progress-dot { position:relative; z-index:1; display:grid; width:32rpx; height:32rpx; border:2rpx solid #d8ded9; border-radius:50%; background:#fff; font-size:18rpx; place-items:center; }
.progress-step.completed,.progress-step.current { color:#2d6d49; }
.progress-step.completed .progress-dot { color:#443700; border-color:#f9c800; background:#f9c800; }
.progress-step.current .progress-dot { border:8rpx solid #f9c800; }
.progress-step text { display:block; font-size:22rpx; }
.progress-step text + text { margin-top:4rpx; color:#a0a8a2; font-size:18rpx; }
.loading { padding: 220rpx 20rpx; color: #8a948e; text-align: center; }
.bottom-space { height:110rpx; }
.reorder-bar { position:fixed; right:0; bottom:0; left:0; display:flex; padding:18rpx 22rpx calc(18rpx + env(safe-area-inset-bottom)); border-top:1rpx solid #e5eae6; background:#fff; align-items:center; gap:18rpx; }
.reorder-bar text { color:#7a857e; font-size:19rpx; flex:1; }
.reorder-bar button { width:240rpx; margin:0; border-radius:40rpx; color:#433600; background:#f9c800; font-size:25rpx; font-weight:800; }
.reorder-bar .after-sale-button { width:180rpx; color:#496056; border:1rpx solid #cbd4ce; background:#fff; }
</style>
