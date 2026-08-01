<script setup lang="ts">
defineProps<{ modelValue: string }>();
const emit = defineEmits<{
  'update:modelValue': [value: string];
  search: [];
}>();

function update(event: Event): void {
  const value = (event as unknown as { detail: { value: string } }).detail.value;
  emit('update:modelValue', value);
}
</script>

<template>
  <view class="search-header">
    <view class="search-box">
      <text class="search-icon">⌕</text>
      <input
        :value="modelValue"
        confirm-type="search"
        placeholder="搜索水果、品牌、产地"
        @input="update"
        @confirm="emit('search')"
      />
    </view>
  </view>
</template>

<style scoped lang="scss">
.search-header {
  display: flex;
  height: 108rpx;
  padding: 14rpx 24rpx;
  background: #fff;
  align-items: center;
  gap: 24rpx;
}

.search-box {
  display: flex;
  height: 80rpx;
  padding: 0 24rpx;
  border-radius: 40rpx;
  background: #f4f5f2;
  align-items: center;
  flex: 1;
}

.search-icon {
  margin-right: 12rpx;
  color: #7d837e;
  font-size: 36rpx;
}

input {
  height: 80rpx;
  color: #2b302c;
  font-size: 25rpx;
  flex: 1;
}
</style>
