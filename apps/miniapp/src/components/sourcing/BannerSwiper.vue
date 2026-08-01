<script setup lang="ts">
import type { HomeBanner } from '@/api/catalog';

defineProps<{ items: HomeBanner[] }>();
defineEmits<{ select: [item: HomeBanner] }>();
</script>

<template>
  <swiper
    v-if="items.length"
    class="banner-swiper"
    circular
    autoplay
    indicator-dots
    :interval="5000"
  >
    <swiper-item v-for="item in items" :key="item.id">
      <view
        class="banner"
        :class="`banner--${item.banner_type.toLowerCase()}`"
        @click="$emit('select', item)"
      >
        <image
          v-if="item.image_url"
          class="banner-image"
          :src="item.image_url"
          mode="aspectFill"
        />
        <view class="shade" />
        <view class="copy">
          <text>
            {{
              item.banner_type === 'MARKET'
                ? '今日行情'
                : item.banner_type === 'ACTIVITY'
                  ? '批发活动'
                  : '新品水果'
            }}
          </text>
          <strong>{{ item.title }}</strong>
          <small>{{ item.subtitle }}</small>
        </view>
      </view>
    </swiper-item>
  </swiper>
</template>

<style scoped lang="scss">
.banner-swiper {
  height: 210rpx;
  margin: 16rpx 16rpx 4rpx;
}

.banner {
  position: relative;
  overflow: hidden;
  height: 184rpx;
  border-radius: 18rpx;
  color: #fff;
  background:
    radial-gradient(circle at 86% 20%, rgb(249 200 0 / 32%), transparent 28%),
    linear-gradient(130deg, #173f2b, #31764f);
}

.banner--activity { background: linear-gradient(130deg, #773720, #d46b38); }
.banner--new_arrival { background: linear-gradient(130deg, #366138, #78a948); }
.banner-image,.shade { position:absolute; inset:0; width:100%; height:100%; }
.shade { background:linear-gradient(90deg,rgba(20,34,25,.78),rgba(20,34,25,.05)); }
.copy { position:relative; z-index:2; display:flex; width:82%; padding:24rpx; flex-direction:column; }
.copy > text { width:fit-content; padding:4rpx 10rpx; border-radius:6rpx; color:#2f301e; background:#f9c800; font-size:18rpx; font-weight:700; }
.copy strong { overflow:hidden; margin-top:12rpx; font-size:29rpx; text-overflow:ellipsis; white-space:nowrap; }
.copy small { overflow:hidden; margin-top:7rpx; color:#e7ede9; font-size:19rpx; text-overflow:ellipsis; white-space:nowrap; }
</style>
