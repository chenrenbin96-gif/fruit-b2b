<script setup lang="ts">
type ProductFilters = {
  level: string;
  origin: string;
  specification: string;
  priceRange: string;
  stock: '' | 'AVAILABLE' | 'LOW' | 'OUT';
};

const props = defineProps<{
  modelValue: ProductFilters;
  levels: string[];
  origins: string[];
  specifications: string[];
  priceRanges: Array<{ label: string; min: number; max: number | null }>;
  stockOptions: Array<{ label: string; value: 'AVAILABLE' | 'LOW' | 'OUT' }>;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: ProductFilters];
}>();

function choose(
  key: keyof ProductFilters,
  values: string[],
  event: Event,
): void {
  const index = Number(
    (event as unknown as { detail: { value: string } }).detail.value,
  );
  emit('update:modelValue', {
    ...props.modelValue,
    [key]: values[index] ?? '',
  });
}

function reset(): void {
  emit('update:modelValue', {
    level: '',
    origin: '',
    specification: '',
    priceRange: '',
    stock: '',
  });
}
</script>

<template>
  <view class="filter-bar">
    <view class="filter-scroll">
      <picker
        :range="['全部等级', ...levels]"
        @change="choose('level', ['', ...levels], $event)"
      >
        <button>{{ modelValue.level || '等级' }} <text>▼</text></button>
      </picker>
      <picker
        :range="['全部产地', ...origins]"
        @change="choose('origin', ['', ...origins], $event)"
      >
        <button>{{ modelValue.origin || '产地' }} <text>▼</text></button>
      </picker>
      <picker
        :range="['全部规格', ...specifications]"
        @change="choose('specification', ['', ...specifications], $event)"
      >
        <button>{{ modelValue.specification || '规格' }} <text>▼</text></button>
      </picker>
      <picker
        :range="['全部价格', ...priceRanges.map((item) => item.label)]"
        @change="choose('priceRange', ['', ...priceRanges.map((item) => item.label)], $event)"
      >
        <button>{{ modelValue.priceRange || '价格' }} <text>▼</text></button>
      </picker>
      <picker
        :range="['全部库存', ...stockOptions.map((item) => item.label)]"
        @change="choose('stock', ['', ...stockOptions.map((item) => item.value)], $event)"
      >
        <button>
          {{ stockOptions.find((item) => item.value === modelValue.stock)?.label || '库存' }}
          <text>▼</text>
        </button>
      </picker>
      <button class="reset" @click="reset">筛选</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.filter-bar {
  overflow: hidden;
  padding: 8rpx 16rpx 12rpx;
  border-bottom: 1rpx solid #eff0ed;
  background: #fff;
}

.filter-scroll {
  display: flex;
  overflow-x: auto;
  gap: 8rpx;
}

button {
  height: 54rpx;
  margin: 0;
  padding: 0 15rpx;
  border: 1rpx solid #e2e4df;
  border-radius: 27rpx;
  color: #555c56;
  background: #fff;
  font-size: 20rpx;
  line-height: 52rpx;
  white-space: nowrap;

  &::after { border: 0; }
  text { margin-left: 3rpx; color:#a2a7a2; font-size:13rpx; }
}

.reset {
  color: #7a6200;
  border-color: #f2d85f;
  background: #fff8d8;
}
</style>
