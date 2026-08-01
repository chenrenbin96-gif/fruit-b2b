<script setup lang="ts">
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { ref } from 'vue';

import {
  purchaseOrderApi,
  type CustomerOrder,
} from '@/api/orders';

type OrderGroup = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

const groups: Array<{ value: OrderGroup; label: string }> = [
  { value: 'PENDING', label: '待审核' },
  { value: 'PROCESSING', label: '处理中' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
];
const activeGroup = ref<OrderGroup>('PENDING');
const loading = ref(false);
const orders = ref<CustomerOrder[]>([]);

const statusLabels: Record<string, string> = {
  CREATED: '已创建',
  WAITING_REVIEW: '待仓库审核',
  APPROVED: '审核通过',
  PICKING: '备货中',
  WEIGHING: '待称重',
  WAITING_DELIVERY: '待配送',
  DELIVERING: '配送中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

async function load(): Promise<void> {
  loading.value = true;
  try {
    orders.value = await purchaseOrderApi.orders(activeGroup.value);
  } catch {
    uni.showToast({ title: '订单加载失败', icon: 'none' });
  } finally {
    loading.value = false;
    uni.stopPullDownRefresh();
  }
}

async function switchGroup(group: OrderGroup): Promise<void> {
  activeGroup.value = group;
  await load();
}

async function cancel(order: CustomerOrder): Promise<void> {
  const result = await new Promise<UniApp.ShowModalRes>((resolve) => {
    uni.showModal({
      title: '取消订单',
      content: '取消后将释放本单预占库存，是否继续？',
      success: resolve,
    });
  });
  if (!result.confirm) return;

  try {
    await purchaseOrderApi.cancelOrder(order.id, '客户主动取消');
    uni.showToast({ title: '订单已取消', icon: 'success' });
    await load();
  } catch (error) {
    uni.showToast({
      title: (error as { message?: string }).message ?? '取消失败',
      icon: 'none',
    });
  }
}

function detail(order: CustomerOrder): void {
  uni.navigateTo({ url: `/pages/orders/detail?id=${order.id}` });
}

onShow(load);
onPullDownRefresh(load);
</script>

<template>
  <view class="orders-page">
    <scroll-view class="tabs" scroll-x>
      <view
        v-for="group in groups"
        :key="group.value"
        class="tab"
        :class="{ active: activeGroup === group.value }"
        @click="switchGroup(group.value)"
      >
        {{ group.label }}
      </view>
    </scroll-view>

    <view v-if="orders.length" class="order-list">
      <view v-for="order in orders" :key="order.id" class="order-card">
        <view class="order-heading">
          <view>
            <text class="order-no">{{ order.order_no }}</text>
            <text class="created-at">{{ order.created_at.replace('T', ' ').slice(0, 16) }}</text>
          </view>
          <text class="status">{{ statusLabels[order.status] ?? order.status }}</text>
        </view>

        <view class="items">
          <view v-for="item in order.items" :key="item.id" class="item">
            <view>
              <text class="product-name">{{ item.product_name }}</text>
              <text class="sku-name">{{ item.sku_name }}</text>
            </view>
            <view class="item-quantity">
              <text>{{ item.planned_quantity }} {{ item.unit }}</text>
              <text>¥{{ item.estimated_amount }}</text>
            </view>
          </view>
        </view>

        <view class="order-footer">
          <view class="amount">
            <text>{{ order.final_amount ? '订单金额' : '预计金额' }}</text>
            <strong>¥{{ order.final_amount ?? order.estimated_amount }}</strong>
          </view>
          <button
            v-if="order.status === 'WAITING_REVIEW'"
            size="mini"
            @click="cancel(order)"
          >
            取消订单
          </button>
          <button size="mini" @click="detail(order)">查看详情</button>
        </view>
      </view>
    </view>
    <view v-else-if="loading" class="empty">正在加载订单…</view>
    <view v-else class="empty">当前没有相关订单</view>
  </view>
</template>

<style scoped lang="scss">
.orders-page {
  min-height: 100vh;
  padding-bottom: 40rpx;
}

.tabs {
  position: sticky;
  z-index: 5;
  top: 0;
  box-sizing: border-box;
  width: 100%;
  padding: 20rpx 24rpx;
  white-space: nowrap;
  background: #fff;
}

.tab {
  display: inline-block;
  margin-right: 18rpx;
  padding: 14rpx 25rpx;
  border-radius: 28rpx;
  color: #77827b;
  background: #f0f4f1;
  font-size: 24rpx;

  &.active {
    color: #fff;
    background: #246e49;
  }
}

.order-list {
  padding: 22rpx;
}

.order-card {
  margin-bottom: 20rpx;
  padding: 26rpx;
  border-radius: 22rpx;
  background: #fff;
}

.order-heading,
.item,
.order-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.order-no,
.created-at,
.product-name,
.sku-name,
.item-quantity text,
.amount text,
.amount strong {
  display: block;
}

.order-no {
  color: #263a2d;
  font-size: 26rpx;
  font-weight: 700;
}

.created-at {
  margin-top: 7rpx;
  color: #969f99;
  font-size: 20rpx;
}

.status {
  color: #2a724a;
  font-size: 23rpx;
  font-weight: 700;
}

.items {
  margin-top: 22rpx;
  padding: 6rpx 0;
  border-top: 1rpx solid #edf1ee;
  border-bottom: 1rpx solid #edf1ee;
}

.item {
  padding: 17rpx 0;
}

.product-name {
  font-size: 25rpx;
}

.sku-name,
.item-quantity {
  color: #87918b;
  font-size: 21rpx;
}

.sku-name {
  margin-top: 5rpx;
}

.item-quantity {
  text-align: right;

  text:last-child {
    margin-top: 5rpx;
    color: #5f6b64;
  }
}

.order-footer {
  margin-top: 22rpx;

  button {
    margin: 0;
    border: 1rpx solid #d9e1dc;
    color: #8a5645;
    background: #fff;
  }
}

.amount {
  text {
    color: #8b958f;
    font-size: 20rpx;
  }

  strong {
    margin-top: 3rpx;
    color: #d85e2b;
    font-size: 31rpx;
  }
}

.empty {
  padding: 220rpx 20rpx;
  color: #8d9790;
  font-size: 25rpx;
  text-align: center;
}
</style>
