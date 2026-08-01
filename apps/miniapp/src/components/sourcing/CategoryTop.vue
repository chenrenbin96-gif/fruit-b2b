<script setup lang="ts">
import type { CategoryNode } from '@/api/catalog';

defineProps<{
  items: CategoryNode[];
  activeId: string;
}>();
defineEmits<{ select: [id: string] }>();
</script>

<template>
  <scroll-view class="category-top" scroll-x>
    <view class="category-row">
      <view
        v-for="item in items"
        :key="item.id"
        class="category-tab"
        :class="{ active: activeId === item.id }"
        @click="$emit('select', item.id)"
      >
        {{ item.name }}
      </view>
    </view>
  </scroll-view>
</template>

<style scoped lang="scss">
.category-top {
  width: 100%;
  border-bottom: 1rpx solid #eceeea;
  background: #fff;
  white-space: nowrap;
}

.category-row {
  display: flex;
  width: max-content;
  min-width: 100%;
  padding: 0 12rpx;
}

.category-tab {
  position: relative;
  padding: 22rpx 26rpx 20rpx;
  color: #666c67;
  font-size: 27rpx;

  &.active {
    color: #20231f;
    font-weight: 800;
  }

  &.active::after {
    position: absolute;
    right: 26rpx;
    bottom: 0;
    left: 26rpx;
    height: 7rpx;
    border-radius: 7rpx 7rpx 0 0;
    background: #f9c800;
    content: "";
  }
}
</style>
