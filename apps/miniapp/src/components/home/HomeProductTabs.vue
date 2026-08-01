<script setup lang="ts">
defineProps<{ modelValue: 'HOT' | 'NEW' | 'RECOMMEND' }>();
defineEmits<{ 'update:modelValue': [value: 'HOT' | 'NEW' | 'RECOMMEND'] }>();

const tabs = [
  { value: 'HOT' as const, label: '爆款', hint: '门店热采' },
  { value: 'NEW' as const, label: '新品', hint: '新鲜到仓' },
  { value: 'RECOMMEND' as const, label: '推荐', hint: '采购精选' },
];
</script>

<template>
  <view class="product-tabs">
    <view v-for="item in tabs" :key="item.value" :class="{ active: modelValue === item.value }" @click="$emit('update:modelValue', item.value)">
      <strong>{{ item.label }}</strong><text>{{ item.hint }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.product-tabs { display:flex; padding:22rpx 24rpx 16rpx; background:#fff; justify-content:space-around; }
.product-tabs > view { position:relative; display:flex; min-width:150rpx; color:#879088; align-items:center; flex-direction:column; }
.product-tabs strong { font-size:29rpx; }
.product-tabs text { margin-top:4rpx; font-size:17rpx; }
.product-tabs > view.active strong { color:#1e5335; }
.product-tabs > view.active text { color:#b68a00; }
.product-tabs > view.active::after { position:absolute; bottom:-16rpx; width:54rpx; height:7rpx; border-radius:6rpx; background:#f9c800; content:""; }
</style>
