<script setup lang="ts">
import { onMounted, ref } from 'vue';

import {
  customerFinanceApi,
  type CustomerPayment,
  type CustomerReceivable,
  type FinanceSummary,
} from '@/api/finance';

const summary = ref<FinanceSummary | null>(null);
const receivables = ref<CustomerReceivable[]>([]);
const payments = ref<CustomerPayment[]>([]);
const active = ref<'BILLS' | 'PAYMENTS'>('BILLS');
const methodLabels: Record<string, string> = {
  CASH: '现金',
  BANK_TRANSFER: '银行转账',
  WECHAT: '微信',
  ALIPAY: '支付宝',
};

async function load() {
  try {
    const [account, bills, paymentRows] = await Promise.all([
      customerFinanceApi.summary(),
      customerFinanceApi.receivables(),
      customerFinanceApi.payments(),
    ]);
    summary.value = account;
    receivables.value = bills;
    payments.value = paymentRows;
  } catch (error) {
    uni.showToast({
      title: (error as { message?: string }).message ?? '账单加载失败',
      icon: 'none',
    });
  }
}

onMounted(load);
</script>

<template>
  <view class="finance-page">
    <view class="summary-card">
      <text class="summary-card__label">当前欠款</text>
      <text class="summary-card__amount">¥{{ summary?.balance_due ?? "0.00" }}</text>
      <view class="summary-card__grid">
        <view><text>信用额度</text><strong>¥{{ summary?.credit_limit ?? "0.00" }}</strong></view>
        <view><text>可用额度</text><strong>¥{{ summary?.available_credit ?? "0.00" }}</strong></view>
        <view><text>账期</text><strong>{{ summary?.credit_days ?? 0 }} 天</strong></view>
        <view><text>逾期金额</text><strong>¥{{ summary?.overdue_amount ?? "0.00" }}</strong></view>
      </view>
    </view>

    <view class="tabs">
      <text :class="{ active: active === 'BILLS' }" @click="active = 'BILLS'">历史账单</text>
      <text :class="{ active: active === 'PAYMENTS' }" @click="active = 'PAYMENTS'">付款记录</text>
    </view>

    <view v-if="active === 'BILLS'" class="list">
      <view v-for="bill in receivables" :key="bill.id" class="record">
        <view class="record__head"><strong>{{ bill.receivable_no }}</strong><text>{{ bill.term_status === "OVERDUE" ? "已逾期" : bill.status }}</text></view>
        <text class="record__copy">订单：{{ bill.order_no }} · {{ bill.bill_date }}</text>
        <view class="record__amounts"><text>订单 ¥{{ bill.final_amount }} · 已付 ¥{{ bill.paid_amount }}</text><strong>剩余 ¥{{ bill.remaining_amount }}</strong></view>
        <text class="record__copy">到期：{{ bill.due_date }}</text>
      </view>
      <view v-if="receivables.length === 0" class="empty">暂无账单</view>
    </view>

    <view v-else class="list">
      <view v-for="payment in payments" :key="payment.id" class="record">
        <view class="record__head"><strong>{{ payment.payment_no }}</strong><text>{{ methodLabels[payment.payment_method] }}</text></view>
        <view class="record__amounts"><text>{{ payment.payment_time }}</text><strong>¥{{ payment.amount }}</strong></view>
        <text v-if="payment.remark" class="record__copy">{{ payment.remark }}</text>
      </view>
      <view v-if="payments.length === 0" class="empty">暂无付款记录</view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.finance-page { min-height: 100vh; padding: 28rpx; background: #f3f6f4; }
.summary-card { padding: 38rpx; border-radius: 28rpx; color: #fff; background: linear-gradient(140deg, #143e2a, #28734d); }
.summary-card__label { color: #bed4c5; font-size: 24rpx; }
.summary-card__amount { display: block; margin: 12rpx 0 30rpx; font-size: 56rpx; font-weight: 800; }
.summary-card__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24rpx; }
.summary-card__grid view { display: flex; flex-direction: column; gap: 8rpx; }
.summary-card__grid text { color: #bcd0c2; font-size: 22rpx; }
.tabs { display: flex; margin: 30rpx 0 18rpx; padding: 8rpx; border-radius: 18rpx; background: #fff; }
.tabs text { flex: 1; padding: 20rpx; color: #77827b; text-align: center; }
.tabs .active { border-radius: 14rpx; color: #17452f; background: #e3eee7; font-weight: 700; }
.list { display: flex; flex-direction: column; gap: 18rpx; }
.record { padding: 28rpx; border-radius: 20rpx; background: #fff; }
.record__head, .record__amounts { display: flex; align-items: center; justify-content: space-between; }
.record__head text { color: #9a6940; font-size: 23rpx; }
.record__copy { display: block; margin-top: 14rpx; color: #7d8881; font-size: 23rpx; }
.record__amounts { margin-top: 20rpx; }
.record__amounts strong { color: #1f6a43; font-size: 30rpx; }
.empty { padding: 80rpx 0; color: #9aa49d; text-align: center; }
</style>
