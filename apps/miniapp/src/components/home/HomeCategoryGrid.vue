<script setup lang="ts">
import type { HomeCategoryEntry } from '@/api/catalog';

defineProps<{ items: HomeCategoryEntry[] }>();
defineEmits<{ select: [id: string] }>();
</script>

<template>
  <view class="category-grid">
    <view v-for="item in items.slice(0, 10)" :key="item.id" class="category-entry" @click="$emit('select', item.category_id)">
      <view class="category-image">
        <image v-if="item.image_url" :src="item.image_url" mode="aspectFill" />
        <strong v-else>{{ item.title.slice(0, 1) }}</strong>
      </view>
      <text>{{ item.title }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.category-grid { display:grid; padding:24rpx 16rpx 18rpx; grid-template-columns:repeat(5,minmax(0,1fr)); row-gap:22rpx; }
.category-entry { display:flex; min-width:0; align-items:center; flex-direction:column; }
.category-image { display:grid; overflow:hidden; width:92rpx; height:92rpx; border-radius:28rpx; color:#2a6a43; background:linear-gradient(145deg,#eef7e9,#f9efd1); place-items:center; box-shadow:0 7rpx 20rpx rgba(46,92,59,.09); }
.category-image image { width:100%; height:100%; }
.category-image strong { font-size:32rpx; }
.category-entry text { overflow:hidden; width:100%; margin-top:9rpx; color:#34443a; font-size:21rpx; text-align:center; text-overflow:ellipsis; white-space:nowrap; }
</style>
