<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';

import { getCustomerProfile, type CustomerProfile } from '@/api/customer';
import {
  purchaseOrderApi,
  type CustomerCoupon,
  type PurchaseCart,
} from '@/api/orders';

const loading = ref(false);
const submitting = ref(false);
const cart = ref<PurchaseCart | null>(null);
const customer = ref<CustomerProfile | null>(null);
const coupons = ref<CustomerCoupon[]>([]);
const selectedCouponId = ref('');
const remark = ref('');
const deliveryTime = ref('次日 08:00-12:00');
const deliveryTimes = ['次日 08:00-12:00', '次日 12:00-18:00', '与配送员协商'];

const selectedCoupon = computed(() =>
  coupons.value.find((item) => item.id === selectedCouponId.value),
);
const discountAmount = computed(() => {
  const coupon = selectedCoupon.value?.coupon;
  const productAmount = Number(cart.value?.summary.estimated_product_amount ?? 0);
  if (!coupon || productAmount < Number(coupon.min_amount)) return 0;
  return Math.min(productAmount, Number(coupon.discount_amount));
});
const payableAmount = computed(() =>
  Math.max(
    0,
    Number(cart.value?.summary.estimated_amount ?? 0) - discountAmount.value,
  ).toFixed(2),
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [currentCart, profile, customerCoupons] = await Promise.all([
      purchaseOrderApi.cart(),
      getCustomerProfile(),
      purchaseOrderApi.coupons(),
    ]);
    cart.value = currentCart;
    customer.value = profile;
    coupons.value = customerCoupons.filter(
      (item) => item.status === 'AVAILABLE',
    );
    remark.value = String(uni.getStorageSync('purchase_order_remark') || '');
    if (!currentCart.items.length) {
      uni.showToast({ title: '进货单为空', icon: 'none' });
      setTimeout(() => uni.navigateBack(), 500);
    }
  } catch (error) {
    uni.showToast({
      title: (error as { message?: string }).message ?? '订单确认信息加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

function editAddress(): void {
  uni.navigateTo({ url: '/pages/customer-profile/index?from=confirm' });
}

function selectCoupon(event: Event): void {
  const index = Number(
    (event as unknown as { detail: { value: string } }).detail.value,
  );
  selectedCouponId.value = coupons.value[index]?.id ?? '';
}

function selectDeliveryTime(event: Event): void {
  const index = Number(
    (event as unknown as { detail: { value: string } }).detail.value,
  );
  deliveryTime.value = deliveryTimes[index] ?? deliveryTimes[0]!;
}

async function submit(): Promise<void> {
  const currentCart = cart.value;
  if (!currentCart?.items.length) return;
  if (!currentCart.first_order_check.passed) {
    uni.showToast({
      title: `订单金额未达到${Number(currentCart.first_order_check.required_min_amount)}元起送标准`,
      icon: 'none',
      duration: 2800,
    });
    return;
  }
  if (!currentCart.delivery_minimum_check.passed) {
    uni.showToast({
      title: `本订单未达到${Number(currentCart.delivery_minimum_check.required_min_amount)}元起送金额，还差${Number(currentCart.delivery_minimum_check.shortfall_amount)}元`,
      icon: 'none',
      duration: 3000,
    });
    return;
  }
  if (!currentCart.summary.all_items_purchasable) {
    uni.showToast({ title: '存在不可采购商品，请返回修改', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    await purchaseOrderApi.submit(
      [remark.value, `配送时间：${deliveryTime.value}`].filter(Boolean).join('；'),
      selectedCouponId.value || undefined,
    );
    uni.removeStorageSync('purchase_order_remark');
    uni.showToast({ title: '订单提交成功', icon: 'success' });
    setTimeout(() => {
      uni.redirectTo({ url: '/pages/orders/index' });
    }, 500);
  } catch (error) {
    const apiError = error as {
      code?: string;
      message?: string;
      details?: { required_min_amount?: string };
    };
    uni.showToast({
      title:
        apiError.code === 'FIRST_ORDER_AMOUNT_NOT_REACHED'
          ? `订单金额未达到${Number(apiError.details?.required_min_amount ?? 0)}元起送标准`
          : apiError.code === 'DELIVERY_MIN_AMOUNT_NOT_REACHED'
            ? apiError.message ?? '未达到当前配送区域起送金额'
          : apiError.message ?? '订单提交失败',
      icon: 'none',
      duration: 2800,
    });
  } finally {
    submitting.value = false;
  }
}

onShow(load);
</script>

<template>
  <view class="confirm-page">
    <view v-if="customer" class="address-card" @click="editAddress">
      <view class="address-icon">⌖</view>
      <view>
        <strong>{{ customer.customer_name }}</strong>
        <text>{{ customer.contact_name }} · {{ customer.phone }}</text>
        <text>{{ customer.address }}</text>
        <text>配送区域：{{ customer.delivery_region?.name || cart?.delivery_minimum_check.delivery_region_name || '默认区域' }}</text>
      </view>
      <text class="arrow">›</text>
    </view>

    <picker :range="deliveryTimes" @change="selectDeliveryTime">
      <view class="panel delivery-time">
        <text>配送时间</text><strong>{{ deliveryTime }} ›</strong>
      </view>
    </picker>

    <view v-if="cart" class="panel">
      <text class="panel-title">订单商品</text>
      <view v-for="item in cart.items" :key="item.id" class="order-item">
        <image v-if="item.main_image" :src="item.main_image" mode="aspectFill" />
        <view v-else class="placeholder">鲜</view>
        <view class="item-body">
          <strong>{{ item.product_name }}</strong>
          <text>{{ item.sku_name }}</text>
          <text>
            数量 {{ Number(item.quantity) }}
            {{ item.unit }}
          </text>
        </view>
        <view class="item-price">
          <strong>¥{{ item.amount }}</strong>
          <text>¥{{ item.unit_price }}/{{ item.price_unit }}</text>
        </view>
      </view>
    </view>

    <view v-if="cart" class="panel fees">
      <view><text>商品小计</text><strong>¥{{ cart.summary.estimated_product_amount }}</strong></view>
      <view>
        <text>订单重量</text>
        <strong>{{ cart.summary.estimated_weight }} {{ cart.summary.estimated_weight_unit }}</strong>
      </view>
      <view><text>配送费用</text><strong>¥{{ cart.summary.estimated_shipping_fee }}</strong></view>
      <picker
        v-if="coupons.length"
        :range="coupons.map((item) => `${item.coupon.name} · 减¥${item.coupon.discount_amount}`)"
        @change="selectCoupon"
      >
        <view class="coupon-row">
          <text>优惠券</text>
          <strong>{{ selectedCoupon?.coupon.name || '请选择优惠券' }} ›</strong>
        </view>
      </picker>
      <view v-else><text>优惠券</text><strong>暂无可用优惠券</strong></view>
      <view><text>优惠金额</text><strong class="discount">- ¥{{ discountAmount.toFixed(2) }}</strong></view>
      <view>
        <text>账期额度</text>
        <strong>
          {{ customer?.credit_enabled ? `可用额度 ¥${customer.credit_limit}` : '现金结算' }}
        </strong>
      </view>
      <view class="total"><text>合计金额</text><strong>¥{{ payableAmount }}</strong></view>
    </view>

    <view
      v-if="cart?.first_order_check.is_first_order"
      class="minimum"
      :class="{ passed: cart.first_order_check.passed }"
    >
      首单起送标准 ¥{{ cart.first_order_check.required_min_amount }}，
      当前商品金额 ¥{{ cart.first_order_check.current_amount }}
    </view>
    <view
      v-if="cart && Number(cart.delivery_minimum_check.required_min_amount) > 0"
      class="minimum"
      :class="{ passed: cart.delivery_minimum_check.passed }"
    >
      {{ cart.delivery_minimum_check.delivery_region_name }}起送 ¥{{
        cart.delivery_minimum_check.required_min_amount
      }}，当前商品金额 ¥{{ cart.delivery_minimum_check.current_amount }}
      <template v-if="!cart.delivery_minimum_check.passed">
        ，还差 ¥{{ cart.delivery_minimum_check.shortfall_amount }}
      </template>
    </view>

    <view v-if="remark" class="panel remark">
      <text class="panel-title">采购备注</text>
      <text>{{ remark }}</text>
    </view>

    <view class="bottom-space" />
    <view v-if="cart" class="submit-bar">
      <view><text>含预计运费</text><strong>¥{{ payableAmount }}</strong></view>
      <button
        :loading="submitting"
        :disabled="!cart.summary.all_items_purchasable"
        @click="submit"
      >
        提交订单
      </button>
    </view>
    <view v-if="loading" class="loading">正在核算订单费用…</view>
  </view>
</template>

<style scoped lang="scss">
.confirm-page { min-height:100vh; padding:20rpx 20rpx 150rpx; background:#f4f5f2; }
.address-card { display:flex; padding:26rpx 22rpx; border-radius:18rpx; background:#fff; align-items:center; gap:16rpx; }
.address-icon { display:grid; width:58rpx; height:58rpx; border-radius:18rpx; color:#473a00; background:#f9c800; font-size:30rpx; flex:none; place-items:center; }
.address-card > view:nth-child(2) { min-width:0; flex:1; }
.address-card strong,.address-card text { display:block; }
.address-card strong { color:#25352b; font-size:27rpx; }
.address-card text { margin-top:6rpx; color:#737f77; font-size:20rpx; }
.arrow { color:#9da59f !important; font-size:42rpx !important; }
.panel { margin-top:16rpx; padding:24rpx; border-radius:18rpx; background:#fff; }
.delivery-time { display:flex; align-items:center; justify-content:space-between; }
.delivery-time text { color:#68746c; font-size:22rpx; }
.delivery-time strong { color:#334139; font-size:22rpx; }
.panel-title { display:block; margin-bottom:18rpx; color:#29382f; font-size:27rpx; font-weight:800; }
.order-item { display:flex; padding:16rpx 0; border-top:1rpx solid #edf0ed; align-items:center; gap:13rpx; }
.order-item image,.placeholder { display:grid; width:92rpx; height:92rpx; border-radius:13rpx; color:#2f6848; background:#e7eee3; font-size:30rpx; font-weight:900; flex:none; place-items:center; }
.item-body { min-width:0; flex:1; }
.item-body strong,.item-body text,.item-price strong,.item-price text { display:block; }
.item-body strong { color:#2d3931; font-size:23rpx; }
.item-body text { margin-top:4rpx; color:#8a938d; font-size:18rpx; }
.item-price { text-align:right; }
.item-price strong { color:#dc5140; font-size:24rpx; }
.item-price text { margin-top:5rpx; color:#969e98; font-size:16rpx; }
.fees > view,.coupon-row { display:flex; padding:13rpx 0; align-items:center; justify-content:space-between; }
.fees text { color:#69756d; font-size:22rpx; }
.fees strong { color:#35433a; font-size:22rpx; font-weight:500; }
.fees .discount { color:#d45745; }
.fees .total { margin-top:8rpx; padding-top:20rpx; border-top:1rpx solid #ecefec; }
.fees .total strong { color:#dc5140; font-size:33rpx; font-weight:800; }
.minimum { margin-top:16rpx; padding:20rpx 24rpx; border-radius:14rpx; color:#a35d1e; background:#fff1d7; font-size:21rpx; }
.minimum.passed { color:#34714e; background:#e8f4eb; }
.remark > text:last-child { color:#707b74; font-size:21rpx; }
.bottom-space { height:70rpx; }
.submit-bar { position:fixed; z-index:20; right:0; bottom:0; left:0; display:flex; height:110rpx; padding:0 24rpx; border-top:1rpx solid #e5e9e6; background:#fff; align-items:center; gap:20rpx; }
.submit-bar view { min-width:0; flex:1; }
.submit-bar text,.submit-bar strong { display:block; }
.submit-bar text { color:#8a948d; font-size:17rpx; }
.submit-bar strong { color:#dc5140; font-size:32rpx; }
.submit-bar button { width:260rpx; margin:0; border-radius:44rpx; color:#443700; background:#f9c800; font-size:27rpx; font-weight:800; }
.loading { padding:100rpx 0; color:#8d9790; text-align:center; }
</style>
