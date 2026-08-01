<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
  supplyChainApi,
  type InventoryAlertRow,
  type PurchaseSuggestion,
} from '@/api/procurement';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const loading = ref(false);
const active = ref('low');
const alerts = ref({
  low_stock: [] as InventoryAlertRow[],
  out_of_stock: [] as InventoryAlertRow[],
  slow_moving: [] as InventoryAlertRow[],
  slow_moving_days: 30,
});
const suggestions = ref<PurchaseSuggestion[]>([]);
const rows = computed(() =>
  active.value === 'low'
    ? alerts.value.low_stock
    : active.value === 'out'
      ? alerts.value.out_of_stock
      : alerts.value.slow_moving,
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    [alerts.value, suggestions.value] = await Promise.all([
      supplyChainApi.inventoryAlerts(),
      auth.hasPermission('purchase.suggestion.read')
        ? supplyChainApi.purchaseSuggestions()
        : Promise.resolve([]),
    ]);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section v-loading="loading">
    <div class="page-heading">
      <div><p class="eyebrow">REPLENISHMENT</p><h1>库存预警与采购建议</h1></div>
      <ElButton @click="load">刷新</ElButton>
    </div>
    <div class="management-card">
      <ElTabs v-model="active">
        <ElTabPane :label="`低库存(${alerts.low_stock.length})`" name="low" />
        <ElTabPane :label="`缺货(${alerts.out_of_stock.length})`" name="out" />
        <ElTabPane :label="`滞销(${alerts.slow_moving.length})`" name="slow" />
      </ElTabs>
      <ElTable :data="rows">
        <ElTableColumn prop="product_name" label="商品" />
        <ElTableColumn prop="sku_name" label="SKU" />
        <ElTableColumn label="当前库存"><template #default="{ row }">{{ row.available_quantity }} {{ row.stock_unit }}</template></ElTableColumn>
        <ElTableColumn label="最低库存"><template #default="{ row }">{{ row.stock_warning }} {{ row.stock_unit }}</template></ElTableColumn>
        <ElTableColumn prop="last_sale_at" label="最近销售" />
      </ElTable>
    </div>
    <div class="management-card" style="margin-top:18px">
      <h2>建议采购列表</h2>
      <ElTable :data="suggestions">
        <ElTableColumn prop="product_name" label="商品" />
        <ElTableColumn prop="sku_name" label="SKU" />
        <ElTableColumn label="当前库存"><template #default="{ row }">{{ row.available_quantity }} {{ row.stock_unit }}</template></ElTableColumn>
        <ElTableColumn label="日均销量"><template #default="{ row }">{{ row.average_daily_sales }} {{ row.stock_unit }}</template></ElTableColumn>
        <ElTableColumn prop="purchase_lead_days" label="采购周期(天)" />
        <ElTableColumn label="建议采购"><template #default="{ row }"><strong>{{ row.suggested_quantity }} {{ row.stock_unit }}</strong></template></ElTableColumn>
      </ElTable>
    </div>
  </section>
</template>
