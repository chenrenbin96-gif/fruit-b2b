<script setup lang="ts">
defineProps<{
  visible: boolean;
  productName: string;
  unit: string;
  available: number;
  loading?: boolean;
}>();
const emit = defineEmits<{
  close: [];
  confirm: [weight: number];
}>();

let value = '';

function update(event: Event): void {
  value = (event as unknown as { detail: { value: string } }).detail.value;
}

function confirm(): void {
  emit('confirm', Number(value));
  value = '';
}
</script>

<template>
  <view v-if="visible" class="mask" @click.self="$emit('close')">
    <view class="dialog">
      <text class="eyebrow">WEIGHT PURCHASE</text>
      <strong>加入进货单</strong>
      <text class="product">{{ productName }}</text>
      <view class="input-row">
        <input
          type="digit"
          focus
          placeholder="请输入预计重量"
          @input="update"
        />
        <text>{{ unit }}</text>
      </view>
      <text class="available">当前可售 {{ available }} {{ unit }}</text>
      <view class="actions">
        <button @click="$emit('close')">取消</button>
        <button class="confirm" :loading="loading" @click="confirm">确认加入</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.mask { position:fixed; z-index:100; inset:0; display:flex; padding:40rpx; background:rgb(14 23 17 / 52%); align-items:center; justify-content:center; }
.dialog { width:100%; padding:34rpx; border-radius:26rpx; background:#fff; box-shadow:0 24rpx 70rpx rgb(0 0 0 / 18%); }
.eyebrow,.product,.available { display:block; }
.eyebrow { color:#64806d; font-size:18rpx; font-weight:700; letter-spacing:3rpx; }
.dialog strong { display:block; margin-top:8rpx; color:#1f2c24; font-size:34rpx; }
.product { margin-top:12rpx; color:#737e76; font-size:23rpx; }
.input-row { display:flex; height:88rpx; margin-top:28rpx; padding:0 22rpx; border:2rpx solid #dfe6df; border-radius:15rpx; background:#f8faf8; align-items:center; }
.input-row input { height:84rpx; font-size:28rpx; flex:1; }
.input-row text { color:#315e43; font-size:25rpx; font-weight:700; }
.available { margin-top:12rpx; color:#8a948d; font-size:20rpx; }
.actions { display:grid; margin-top:28rpx; grid-template-columns:1fr 1.5fr; gap:14rpx; }
.actions button { width:100%; margin:0; border-radius:40rpx; color:#536158; background:#eef1ee; font-size:25rpx; }
.actions .confirm { color:#fff; background:#226b47; }
</style>
