<script setup lang="ts">
import type { HomeBanner } from '@/api/catalog';

defineProps<{ items: HomeBanner[] }>();
defineEmits<{ select: [item: HomeBanner] }>();
</script>

<template>
  <swiper
    class="immersive-banner"
    circular
    autoplay
    indicator-dots
    :interval="5000"
    indicator-color="rgba(255,255,255,.45)"
    indicator-active-color="#ffffff"
  >
    <swiper-item v-for="item in items" :key="item.id">
      <view class="banner-slide" @click="$emit('select', item)">
        <image v-if="item.image_url" :src="item.image_url" mode="aspectFill" />
        <view class="banner-fallback" />
        <view class="banner-shade" />
        <view class="banner-copy">
          <text>{{ item.banner_type === 'MARKET' ? '今日行情' : item.banner_type === 'ACTIVITY' ? '产地活动' : '新品到货' }}</text>
          <strong>{{ item.title }}</strong>
          <small>{{ item.subtitle }}</small>
        </view>
      </view>
    </swiper-item>
    <swiper-item v-if="!items.length">
      <view class="banner-slide">
        <view class="banner-fallback" />
        <view class="banner-shade" />
        <view class="banner-copy"><text>鲜果直供</text><strong>每天新鲜到仓</strong><small>真实库存 · 客户价格 · 快速采购</small></view>
      </view>
    </swiper-item>
  </swiper>
</template>

<style scoped lang="scss">
.immersive-banner { height:560rpx; }
.banner-slide { position:relative; overflow:hidden; width:100%; height:100%; color:#fff; }
.banner-slide image,.banner-fallback,.banner-shade { position:absolute; inset:0; width:100%; height:100%; }
.banner-fallback { background:radial-gradient(circle at 78% 32%,rgba(249,200,0,.38),transparent 25%),linear-gradient(145deg,#174a31,#4e8b54 58%,#d1a929); }
.banner-shade { background:linear-gradient(180deg,rgba(7,25,15,.32),rgba(9,33,19,.08) 48%,rgba(8,30,17,.7)); }
.banner-copy { position:absolute; right:38rpx; bottom:70rpx; left:38rpx; z-index:2; }
.banner-copy text { display:inline-flex; padding:6rpx 14rpx; border-radius:8rpx; color:#26351f; background:#f9c800; font-size:19rpx; font-weight:800; }
.banner-copy strong,.banner-copy small { display:block; }
.banner-copy strong { margin-top:14rpx; font-size:38rpx; letter-spacing:1rpx; }
.banner-copy small { margin-top:8rpx; color:rgba(255,255,255,.88); font-size:21rpx; }
</style>
