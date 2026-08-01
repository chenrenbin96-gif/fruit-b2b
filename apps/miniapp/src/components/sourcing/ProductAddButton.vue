<script setup lang="ts">
defineProps<{
  quantity: number;
  unit: string;
  loading?: boolean;
  disabled?: boolean;
}>();
defineEmits<{
  add: [];
  increase: [];
  decrease: [];
}>();
</script>

<template>
  <view class="add-control" @click.stop>
    <button
      v-if="quantity <= 0"
      class="single-add"
      :loading="loading"
      :disabled="disabled || loading"
      @click="$emit('add')"
    >
      +
    </button>
    <view v-else class="stepper">
      <button :disabled="loading" @click="$emit('decrease')">−</button>
      <text>{{ Number(quantity.toFixed(3)) }}<small>{{ unit }}</small></text>
      <button :disabled="disabled || loading" @click="$emit('increase')">+</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
button {
  margin: 0;
  border: 0;

  &::after { border: 0; }
}

.single-add {
  width: 80rpx;
  height: 80rpx;
  padding: 0;
  border-radius: 50%;
  color: #fff;
  background: #e85d4a;
  font-size: 48rpx;
  font-weight: 400;
  line-height: 76rpx;
}

.stepper {
  display: flex;
  height: 62rpx;
  padding: 4rpx;
  border: 1rpx solid #eee1df;
  border-radius: 32rpx;
  background: #fff;
  align-items: center;

  button {
    display: grid;
    width: 52rpx;
    height: 52rpx;
    padding: 0;
    border-radius: 50%;
    color: #fff;
    background: #e85d4a;
    font-size: 32rpx;
    line-height: 50rpx;
    place-items: center;
  }

  text {
    min-width: 64rpx;
    padding: 0 6rpx;
    color: #363b37;
    font-size: 22rpx;
    font-weight: 700;
    text-align: center;
  }

  small {
    margin-left: 2rpx;
    color: #888f89;
    font-size: 15rpx;
    font-weight: 400;
  }
}
</style>
