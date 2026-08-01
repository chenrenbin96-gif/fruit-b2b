<script setup lang="ts">
import { computed } from 'vue';

import type { CatalogProduct } from '@/api/catalog';
import ProductAddButton from '@/components/sourcing/ProductAddButton.vue';

const props = defineProps<{
  product: CatalogProduct;
  quantity?: number;
  loading?: boolean;
  compact?: boolean;
}>();
defineEmits<{
  open: [];
  add: [];
  increase: [];
  decrease: [];
}>();

const sku = computed(() => props.product.skus[0]);
const available = computed(() =>
  Number(sku.value?.inventory.available_quantity ?? 0),
);
const convertedPrice = computed(() => {
  if (!sku.value || sku.value.sale_type !== 'PIECE') return '';
  const spec = sku.value.specification || sku.value.sku_name;
  const match = spec.match(/(\d+(?:\.\d+)?)\s*(斤|公斤|kg)/i);
  if (!match) return '';
  const weight = Number(match[1]);
  if (!weight) return '';
  const matchedUnit = match[2] ?? '';
  const unit = matchedUnit.toLowerCase() === 'kg' ? '公斤' : matchedUnit;
  return `约 ¥${(Number(sku.value.price.final_unit_price) / weight).toFixed(2)}/${unit}`;
});
</script>

<template>
  <view
    v-if="sku"
    class="wholesale-card"
    :class="{ compact }"
    @click="$emit('open')"
  >
    <view class="visual">
      <image v-if="product.main_image" :src="product.main_image" mode="aspectFill" />
      <view v-else class="placeholder">
        <strong>{{ product.name.slice(0, 1) }}</strong>
        <text>产地直供</text>
      </view>
      <text class="sale-tag" :class="sku.sale_type.toLowerCase()">
        {{ sku.sale_type === 'PIECE' ? '按件' : '称重' }}
      </text>
    </view>

    <view class="body">
      <strong class="name">{{ product.name }}</strong>
      <text class="origin">{{ product.origin || '精选产地' }}</text>
      <text class="spec">{{ sku.specification || sku.sku_name }}</text>
      <view class="price-block">
        <text>客户批发价</text>
        <strong>¥{{ sku.price.final_unit_price }}<small>/{{ sku.price_unit }}</small></strong>
        <text v-if="convertedPrice" class="conversion">{{ convertedPrice }}</text>
      </view>
      <view class="bottom">
        <text :class="{ empty: available <= 0 }">
          {{ available > 0 ? `库存 ${available}${sku.stock_unit}` : '库存不足' }}
        </text>
        <ProductAddButton
          :quantity="quantity ?? 0"
          :unit="sku.piece_unit || ''"
          :loading="loading"
          :disabled="available <= 0"
          @add="$emit('add')"
          @increase="$emit('increase')"
          @decrease="$emit('decrease')"
        />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.wholesale-card { overflow:hidden; border:1rpx solid #e4e9e5; border-radius:18rpx; background:#fff; box-shadow:0 8rpx 26rpx rgb(27 62 41 / 5%); }
.visual { position:relative; height:224rpx; background:#e9efe8; }
.visual image { width:100%; height:100%; }
.placeholder { display:flex; width:100%; height:100%; color:#326747; background:linear-gradient(145deg,#e3eddf,#f4f0dd); align-items:center; justify-content:center; flex-direction:column; }
.placeholder strong { font-size:58rpx; }
.placeholder text { margin-top:5rpx; color:#829084; font-size:17rpx; letter-spacing:2rpx; }
.sale-tag { position:absolute; top:12rpx; left:12rpx; padding:6rpx 10rpx; border-radius:7rpx; color:#fff; background:#2f744d; font-size:17rpx; font-weight:700; }
.sale-tag.weight { background:#b86a36; }
.body { padding:16rpx; }
.name,.origin,.spec { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.name { color:#222b25; font-size:27rpx; }
.origin { margin-top:6rpx; color:#5e6c63; font-size:20rpx; }
.spec { margin-top:5rpx; color:#909990; font-size:19rpx; }
.price-block { margin-top:13rpx; padding-top:11rpx; border-top:1rpx solid #edf0ed; }
.price-block > text { display:block; color:#89938c; font-size:17rpx; }
.price-block strong { display:block; margin-top:2rpx; color:#df503d; font-size:31rpx; }
.price-block small { font-size:17rpx; font-weight:500; }
.price-block .conversion { margin-top:3rpx; color:#a06f2e; font-size:17rpx; }
.bottom { display:flex; min-height:74rpx; margin-top:5rpx; color:#43805a; font-size:18rpx; align-items:center; justify-content:space-between; gap:6rpx; }
.bottom > text.empty { color:#d04f42; }
.compact { width:316rpx; flex:none; }
.compact .visual { height:190rpx; }
.compact .body { padding:14rpx; }
.compact .name { font-size:25rpx; }
</style>
