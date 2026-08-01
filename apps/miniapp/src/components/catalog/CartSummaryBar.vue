<script setup lang="ts">
defineProps<{ count: number; amount: string }>();
defineEmits<{ open: [] }>();
</script>

<template>
  <view class="cart-bar" @click="$emit('open')">
    <view class="cart-icon">
      🛒
      <text v-if="count">{{ count > 99 ? '99+' : count }}</text>
    </view>
    <view class="amount"><small>进货单预计金额</small><strong>¥{{ amount }}</strong></view>
    <button>查看进货单</button>
  </view>
</template>

<style scoped lang="scss">
.cart-bar { position:fixed; z-index:30; right:18rpx; bottom:calc(50px + 14rpx); left:198rpx; display:flex; height:92rpx; padding:0 14rpx 0 20rpx; border-radius:48rpx; color:#fff; background:#24352b; box-shadow:0 12rpx 30rpx rgb(22 39 29 / 24%); align-items:center; }
.cart-icon { position:relative; font-size:37rpx; }
.cart-icon text { position:absolute; top:-14rpx; right:-18rpx; display:grid; min-width:31rpx; height:31rpx; padding:0 5rpx; border:3rpx solid #24352b; border-radius:18rpx; background:#e75846; font-size:15rpx; place-items:center; }
.amount { min-width:0; margin-left:18rpx; flex:1; }
.amount small,.amount strong { display:block; }
.amount small { color:#bec9c1; font-size:16rpx; }
.amount strong { margin-top:2rpx; font-size:27rpx; }
button { height:62rpx; margin:0; padding:0 20rpx; border-radius:32rpx; color:#3e3200; background:#f9c800; font-size:20rpx; font-weight:800; line-height:62rpx; }
</style>
