<script setup lang="ts">
import { computed } from 'vue';

import type { CatalogProduct } from '@/api/catalog';
import ProductAddButton from './ProductAddButton.vue';

const props = defineProps<{
  product: CatalogProduct;
  quantity: number;
  loading?: boolean;
}>();
defineEmits<{
  open: [];
  add: [];
  increase: [];
  decrease: [];
}>();

const sku = computed(() => props.product.skus[0]);
const outOfStock = computed(
  () => !sku.value || Number(sku.value.inventory.available_quantity) <= 0,
);
const convertedPrice = computed(() => {
  if (!sku.value || sku.value.sale_type !== 'PIECE') return '';
  const spec = sku.value.specification || sku.value.sku_name;
  const match = spec.match(/(\d+(?:\.\d+)?)\s*(斤|公斤|kg)/i);
  const weight = Number(match?.[1] ?? 0);
  if (!match || !weight) return '';
  const matchedUnit = match[2] ?? '';
  const unit = matchedUnit.toLowerCase() === 'kg' ? '公斤' : matchedUnit;
  return `折算 ¥${(Number(sku.value.price.final_unit_price) / weight).toFixed(2)}/${unit}`;
});
</script>

<template>
  <view v-if="sku" class="product-card" @click="$emit('open')">
    <view class="visual">
      <image
        v-if="product.main_image"
        :src="product.main_image"
        mode="aspectFill"
      />
      <view v-else class="placeholder">
        <text>{{ product.name.slice(0, 1) }}</text>
        <small>产地直供</small>
      </view>
      <text class="sale-type" :class="sku.sale_type.toLowerCase()">
        {{ sku.sale_type === 'PIECE' ? '按件' : '称重' }}
      </text>
    </view>

    <view class="content">
      <strong class="name">{{ product.name }}</strong>
      <text class="attributes">
        {{ product.brand || '精选品牌' }} · {{ product.origin || '精选产地' }}
      </text>
      <text class="specification">
        {{ sku.specification || sku.sku_name }} · 等级：{{ sku.grade }} ·
        {{ sku.sale_type === 'PIECE' ? 'PIECE' : 'WEIGHT' }}
      </text>

      <view class="price-line">
        <view>
          <text class="price-label">客户价</text>
          <strong class="price">
            ¥{{ sku.price.final_unit_price }}
            <small>/{{ sku.price_unit }}</small>
          </strong>
          <text v-if="convertedPrice" class="converted-price">{{ convertedPrice }}</text>
          <text
            v-if="Number(sku.base_price) > Number(sku.price.final_unit_price)"
            class="market-price"
          >
            市场价 ¥{{ sku.base_price }}/{{ sku.price_unit }}
          </text>
        </view>
        <text class="stock" :class="{ empty: outOfStock }">
          {{
            outOfStock
              ? '库存不足'
              : `库存 ${sku.inventory.available_quantity}${sku.stock_unit}`
          }}
        </text>
      </view>

      <view class="action-row">
        <text class="unit-price">
          1{{ sku.piece_unit || '件' }}起订
        </text>
        <ProductAddButton
          :quantity="quantity"
          :unit="sku.piece_unit || ''"
          :loading="loading"
          :disabled="outOfStock"
          @add="$emit('add')"
          @increase="$emit('increase')"
          @decrease="$emit('decrease')"
        />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.product-card {
  display: flex;
  margin: 0 14rpx 14rpx;
  padding: 14rpx;
  border-bottom: 1rpx solid #eff0ec;
  background: #fff;
  gap: 15rpx;
}

.visual {
  position: relative;
  overflow: hidden;
  width: 164rpx;
  height: 184rpx;
  border-radius: 14rpx;
  background: #eef2e9;
  flex: none;
}

.visual image { width:100%; height:100%; }
.placeholder { display:flex; width:100%; height:100%; color:#56733d; background:linear-gradient(145deg,#e5edd6,#f4f0dc); align-items:center; justify-content:center; flex-direction:column; }
.placeholder text { font-size:50rpx; font-weight:900; }
.placeholder small { margin-top:5rpx; color:#879374; font-size:16rpx; letter-spacing:2rpx; }
.sale-type { position:absolute; top:9rpx; left:9rpx; padding:5rpx 9rpx; border-radius:6rpx; color:#fff; background:#52783f; font-size:16rpx; font-weight:700; }
.sale-type.weight { background:#b86738; }
.content { min-width:0; flex:1; }
.name,.attributes,.specification { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.name { color:#242824; font-size:27rpx; }
.attributes { margin-top:7rpx; color:#777f78; font-size:19rpx; }
.specification { margin-top:6rpx; color:#9a8a5b; font-size:18rpx; }
.price-line,.action-row { display:flex; align-items:flex-end; justify-content:space-between; gap:8rpx; }
.price-line { margin-top:14rpx; }
.price-label { display:block; color:#858d86; font-size:17rpx; }
.price { display:block; color:#e04f3c; font-size:28rpx; white-space:nowrap; }
.price small { font-size:17rpx; font-weight:500; }
.converted-price { display:block; margin-top:2rpx; color:#a57332; font-size:16rpx; }
.market-price { display:block; margin-top:2rpx; color:#a0a6a1; font-size:16rpx; text-decoration:line-through; }
.stock { color:#478259; font-size:17rpx; white-space:nowrap; }
.stock.empty { color:#d35343; }
.action-row { min-height:70rpx; margin-top:4rpx; align-items:center; }
.unit-price { color:#969c97; font-size:17rpx; }
</style>
