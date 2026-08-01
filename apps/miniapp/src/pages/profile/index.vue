<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';

import { getCustomerProfile, type CustomerProfile } from '@/api/customer';
import {
  customerFinanceApi,
  type CustomerReceivable,
  type FinanceSummary,
} from '@/api/finance';
import {
  purchaseOrderApi,
  type CustomerCoupon,
  type CustomerOrder,
} from '@/api/orders';
import { useAuthStore } from '@/stores/auth';
import { getAccessToken } from '@/api/token';

const auth = useAuthStore();
const customer = ref<CustomerProfile | null>(null);
const finance = ref<FinanceSummary | null>(null);
const orders = ref<CustomerOrder[]>([]);
const coupons = ref<CustomerCoupon[]>([]);
const receivables = ref<CustomerReceivable[]>([]);
const loadWarning = ref('');

const availableCoupons = computed(
  () => coupons.value.filter((item) => item.status === 'AVAILABLE').length,
);
const orderMetrics = computed(() => [
  {
    label: '待付款',
    count: receivables.value.filter((item) => Number(item.remaining_amount) > 0)
      .length,
  },
  {
    label: '待审核',
    count: orders.value.filter((item) => item.status === 'WAITING_REVIEW').length,
  },
  {
    label: '配送中',
    count: orders.value.filter((item) =>
      ['WAITING_DELIVERY', 'DELIVERING'].includes(item.status),
    ).length,
  },
  {
    label: '已完成',
    count: orders.value.filter((item) => item.status === 'COMPLETED').length,
  },
]);

function requireLogin(path: string): void {
  if (!auth.isAuthenticated) {
    uni.navigateTo({ url: '/pages/login/index' });
    return;
  }
  uni.navigateTo({ url: path });
}

async function load(): Promise<void> {
  loadWarning.value = '';
  if (!getAccessToken()) {
    auth.clearSession();
    return;
  }
  const results = await Promise.allSettled([
    getCustomerProfile(),
    customerFinanceApi.summary(),
    purchaseOrderApi.orders(),
    purchaseOrderApi.coupons(),
    customerFinanceApi.receivables(),
  ]);
  if (results[0].status === 'fulfilled') customer.value = results[0].value;
  if (results[1].status === 'fulfilled') finance.value = results[1].value;
  if (results[2].status === 'fulfilled') orders.value = results[2].value;
  if (results[3].status === 'fulfilled') coupons.value = results[3].value;
  if (results[4].status === 'fulfilled') receivables.value = results[4].value;
  if (!getAccessToken()) {
    auth.clearSession();
    return;
  }
  if (results.some((result) => result.status === 'rejected')) {
    loadWarning.value = '部分客户数据暂时未能加载，请稍后重试';
  }
}

async function logout(): Promise<void> {
  await auth.logout();
  customer.value = null;
  finance.value = null;
  orders.value = [];
  coupons.value = [];
  receivables.value = [];
  uni.showToast({ title: '已退出登录', icon: 'none' });
}

function contactService(): void {
  uni.showModal({
    title: '联系供应链客服',
    content: '请联系您的销售负责人处理订单、配送或账务问题。',
    showCancel: false,
  });
}

onShow(load);
</script>

<template>
  <view class="mine">
    <view v-if="loadWarning" class="load-warning" @click="load">{{ loadWarning }}，点击重试</view>
    <view class="customer-card" @click="requireLogin('/pages/customer-profile/index')">
      <view class="avatar">客</view>
      <view class="identity">
        <strong>{{ customer?.customer_name || '采购客户' }}</strong>
        <text>{{ customer ? `${customer.level?.name || '普通客户'} · ${customer.contact_name}` : '登录后查看客户资料' }}</text>
      </view>
      <text class="arrow">›</text>
    </view>

    <button v-if="!auth.isAuthenticated" class="login-button" @click="requireLogin('/pages/customer-profile/index')">客户登录</button>

    <view class="account-grid">
      <view><strong>¥{{ finance?.available_credit ?? '0.00' }}</strong><text>可用额度</text></view>
      <view @click="requireLogin('/pages/finance/index')"><strong>¥{{ finance?.balance_due ?? '0.00' }}</strong><text>欠款金额</text></view>
      <view @click="requireLogin('/pages/coupons/index')"><strong>{{ availableCoupons }}</strong><text>优惠券</text></view>
    </view>

    <view class="order-panel">
      <view class="panel-heading" @click="requireLogin('/pages/orders/index')">
        <strong>我的订单</strong><text>全部订单 ›</text>
      </view>
      <view class="order-statuses">
        <view v-for="item in orderMetrics" :key="item.label" @click="requireLogin('/pages/orders/index')">
          <strong>{{ item.count }}</strong><text>{{ item.label }}</text>
        </view>
      </view>
    </view>

    <view class="common-panel">
      <text class="title">常用功能</text>
      <view class="function-grid">
        <view @click="requireLogin('/pages/customer-center/index')"><text class="mark">客</text><strong>客户中心</strong></view>
        <view @click="requireLogin('/pages/finance/index')"><text class="mark">账</text><strong>我的账单</strong></view>
        <view @click="requireLogin('/pages/coupons/index')"><text class="mark">券</text><strong>优惠券</strong></view>
        <view @click="requireLogin('/pages/purchased/index')"><text class="mark">购</text><strong>再次购买</strong></view>
        <view @click="requireLogin('/pages/purchase-record/index')"><text class="mark">记</text><strong>采购记录</strong></view>
        <view @click="requireLogin('/pages/after-sale/index')"><text class="mark">售</text><strong>售后服务</strong></view>
        <view @click="requireLogin('/pages/customer-profile/index')"><text class="mark">档</text><strong>客户资料</strong></view>
        <view @click="contactService"><text class="mark">服</text><strong>联系客服</strong></view>
      </view>
    </view>

    <button v-if="auth.isAuthenticated" class="logout" @click="logout">退出登录</button>
  </view>
</template>

<style scoped lang="scss">
.mine { min-height:100vh; padding:24rpx 22rpx 50rpx; background:#f4f5f2; }
.load-warning { margin-bottom:14rpx; padding:16rpx 20rpx; border-radius:14rpx; color:#8c5d16; background:#fff2d2; font-size:21rpx; }
.customer-card { display:flex; padding:32rpx 28rpx; border-radius:22rpx; color:#fff; background:linear-gradient(135deg,#195237,#337954); align-items:center; gap:18rpx; }
.avatar { display:grid; width:88rpx; height:88rpx; border-radius:24rpx; color:#403400; background:#f9c800; font-size:34rpx; font-weight:900; place-items:center; }
.identity { min-width:0; flex:1; }
.identity strong,.identity text { display:block; }
.identity strong { overflow:hidden; font-size:31rpx; text-overflow:ellipsis; white-space:nowrap; }
.identity text { margin-top:8rpx; color:#cfe0d5; font-size:21rpx; }
.arrow { color:#d7e4dc; font-size:42rpx; }
.login-button { margin-top:18rpx; color:#fff; background:#26714a; }
.account-grid { display:grid; margin-top:16rpx; padding:25rpx 8rpx; border-radius:18rpx; background:#fff; grid-template-columns:repeat(3,1fr); }
.account-grid view { text-align:center; }
.account-grid strong,.account-grid text { display:block; }
.account-grid strong { color:#d95342; font-size:27rpx; }
.account-grid text { margin-top:6rpx; color:#7f8982; font-size:20rpx; }
.order-panel,.common-panel { margin-top:16rpx; padding:24rpx; border-radius:18rpx; background:#fff; }
.panel-heading { display:flex; align-items:center; justify-content:space-between; }
.panel-heading strong,.common-panel .title { color:#29382f; font-size:27rpx; font-weight:800; }
.panel-heading text { color:#8d9690; font-size:20rpx; }
.order-statuses { display:grid; margin-top:24rpx; grid-template-columns:repeat(4,1fr); }
.order-statuses view { text-align:center; }
.order-statuses strong,.order-statuses text { display:block; }
.order-statuses strong { color:#285f43; font-size:30rpx; }
.order-statuses text { margin-top:7rpx; color:#6f7b73; font-size:20rpx; }
.common-panel .title { display:block; }
.function-grid { display:grid; margin-top:24rpx; grid-template-columns:repeat(4,1fr); row-gap:28rpx; }
.function-grid view { display:flex; align-items:center; flex-direction:column; }
.function-grid .mark { display:grid; width:62rpx; height:62rpx; border-radius:18rpx; color:#315d43; background:#e8f1ea; font-size:25rpx; font-weight:800; place-items:center; }
.function-grid strong { margin-top:8rpx; color:#566259; font-size:20rpx; font-weight:500; }
.logout { margin-top:28rpx; color:#6f7b73; background:#e7ebe8; }
</style>
