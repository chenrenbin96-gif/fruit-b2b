<script setup lang="ts">
import type { CategoryNode } from '@/api/catalog';

defineProps<{
  items: CategoryNode[];
  activeId: string;
}>();
defineEmits<{ select: [id: string] }>();
</script>

<template>
  <scroll-view class="category-side" scroll-y>
    <view
      v-for="item in items"
      :key="item.id"
      class="side-item"
      :class="{ active: activeId === item.id }"
      @click="$emit('select', item.id)"
    >
      <text>{{ item.name }}</text>
    </view>
  </scroll-view>
</template>

<style scoped lang="scss">
.category-side {
  width: 180rpx;
  height: 100%;
  background: #f6f6f3;
  flex: none;
}

.side-item {
  position: relative;
  display: grid;
  min-height: 92rpx;
  padding: 16rpx 12rpx;
  color: #626761;
  font-size: 25rpx;
  text-align: center;
  place-items: center;

  &.active {
    color: #1f221e;
    background: #fff8d9;
    font-weight: 800;
  }

  &.active::before {
    position: absolute;
    top: 25rpx;
    bottom: 25rpx;
    left: 0;
    width: 7rpx;
    border-radius: 0 5rpx 5rpx 0;
    background: #f9c800;
    content: "";
  }
}
</style>
