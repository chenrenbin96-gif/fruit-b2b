<script setup lang="ts">
import type { PurchasedProduct } from '@/api/orders';

defineProps<{ items: PurchasedProduct[]; loadingSkuId?: string }>();
defineEmits<{ add: [item: PurchasedProduct]; open: [productId: string] }>();
</script>

<template>
  <view v-if="items.length" class="frequent-section">
    <view class="heading"><strong>常购商品</strong><text>按采购次数与最近采购排序</text></view>
    <scroll-view class="scroll" scroll-x>
      <view class="row">
        <view v-for="item in items" :key="item.sku_id" class="card" @click="$emit('open', item.product_id)">
          <image v-if="item.main_image" :src="item.main_image" mode="aspectFill" />
          <view v-else class="placeholder">{{ item.product_name.slice(0, 1) }}</view>
          <strong>{{ item.product_name }}</strong>
          <text>{{ item.specification || item.sku_name }}</text>
          <small>常买 {{ item.purchase_count }}次</small>
          <view>
            <text>¥{{ item.current_price }}/{{ item.price_unit }}</text>
            <button
              :loading="loadingSkuId === item.sku_id"
              :disabled="!item.purchasable"
              @click.stop="$emit('add', item)"
            >+</button>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped lang="scss">
.frequent-section { overflow:hidden; margin:18rpx; padding:24rpx 0; border-radius:24rpx; background:#fff; }
.heading { display:flex; padding:0 24rpx 18rpx; align-items:baseline; gap:12rpx; }
.heading strong { color:#293e31; font-size:29rpx; }
.heading text { color:#929b95; font-size:18rpx; }
.scroll { width:100%; }
.row { display:flex; padding:0 22rpx; gap:14rpx; }
.card { width:226rpx; padding:14rpx; border:1rpx solid #e9ede9; border-radius:17rpx; flex:none; }
.card image,.placeholder { display:grid; width:100%; height:170rpx; border-radius:13rpx; color:#2e6847; background:#e4eee1; font-size:45rpx; font-weight:900; place-items:center; }
.card > strong,.card > text,.card > small { display:block; overflow:hidden; margin-top:7rpx; text-overflow:ellipsis; white-space:nowrap; }
.card > strong { color:#29352d; font-size:23rpx; }
.card > text { color:#7f8982; font-size:17rpx; }
.card > small { color:#a27b29; font-size:16rpx; }
.card > view:last-child { display:flex; margin-top:10rpx; align-items:center; justify-content:space-between; }
.card > view:last-child text { color:#db503d; font-size:21rpx; font-weight:800; }
.card button { width:48rpx; height:48rpx; margin:0; padding:0; border-radius:50%; color:#fff; background:#d95643; font-size:27rpx; line-height:48rpx; }
</style>
