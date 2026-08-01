<script setup lang="ts">
defineProps<{ modelValue: string }>();
const emit = defineEmits<{
  'update:modelValue': [value: string];
  search: [];
}>();

function update(event: Event): void {
  emit(
    'update:modelValue',
    (event as unknown as { detail: { value: string } }).detail.value,
  );
}
</script>

<template>
  <view class="home-header">
    <view class="brand">
      <text class="logo">鲜</text>
      <view><strong>鲜链云</strong><small>水果供应链</small></view>
    </view>
    <view class="search">
      <text>⌕</text>
      <input
        :value="modelValue"
        confirm-type="search"
        placeholder="搜索水果、产地、规格"
        @input="update"
        @confirm="$emit('search')"
      />
    </view>
  </view>
</template>

<style scoped lang="scss">
.home-header { position:relative; padding:18rpx 22rpx 20rpx; background:#fff; }
.brand { display:flex; align-items:center; gap:12rpx; }
.logo { display:grid; width:54rpx; height:54rpx; border-radius:15rpx; color:#193c2a; background:#f9c800; font-size:28rpx; font-weight:900; place-items:center; }
.brand view,.brand strong,.brand small { display:block; }
.brand strong { color:#173624; font-size:28rpx; }
.brand small { margin-top:1rpx; color:#8c968f; font-size:16rpx; letter-spacing:2rpx; }
.search { display:flex; height:76rpx; margin-top:16rpx; padding:0 22rpx; border:2rpx solid #ece6c4; border-radius:38rpx; background:#faf9f3; align-items:center; }
.search > text { margin-right:10rpx; color:#9a8121; font-size:34rpx; }
.search input { height:72rpx; font-size:24rpx; flex:1; }
</style>
