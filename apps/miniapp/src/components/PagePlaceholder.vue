<script setup lang="ts">
defineProps<{
  eyebrow: string;
  title: string;
  description: string;
}>();
</script>

<template>
  <view class="placeholder">
    <text class="placeholder__eyebrow">{{ eyebrow }}</text>
    <text class="placeholder__title">{{ title }}</text>
    <text class="placeholder__description">{{ description }}</text>
    <view class="placeholder__status">
      <text>基础页面结构已完成</text>
      <text>业务功能将在下一阶段接入</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.placeholder {
  display: flex;
  min-height: 72vh;
  padding: 72rpx 40rpx;
  flex-direction: column;

  &__eyebrow {
    color: #4f7c63;
    font-size: 22rpx;
    font-weight: 700;
    letter-spacing: 4rpx;
  }

  &__title {
    margin-top: 16rpx;
    color: #17251e;
    font-size: 58rpx;
    font-weight: 800;
    letter-spacing: -3rpx;
  }

  &__description {
    max-width: 620rpx;
    margin-top: 24rpx;
    color: #68746c;
    font-size: 30rpx;
    line-height: 1.7;
  }

  &__status {
    display: flex;
    margin-top: 64rpx;
    padding: 32rpx;
    border: 1rpx solid #e1e8e3;
    border-radius: 24rpx;
    background: #ffffff;
    color: #718078;
    font-size: 26rpx;
    flex-direction: column;
    gap: 12rpx;
  }
}
</style>
