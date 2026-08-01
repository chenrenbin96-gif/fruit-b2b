<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
  getCustomerPurchaseAnalysis,
  type CustomerPurchaseAnalysis,
} from '@/api/customer-analysis';

const rows = ref<CustomerPurchaseAnalysis[]>([]);
const keyword = ref('');
const loading = ref(false);
const filtered = computed(() => {
  const value = keyword.value.trim().toLowerCase();
  if (!value) return rows.value;
  return rows.value.filter((item) =>
    [item.customer_no, item.customer_name, item.frequent_product ?? '']
      .some((field) => field.toLowerCase().includes(value)),
  );
});

async function load() {
  loading.value = true;
  try {
    rows.value = await getCustomerPurchaseAnalysis();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section v-loading="loading">
    <div class="page-heading">
      <div><p class="eyebrow">CUSTOMER INSIGHT</p><h1>客户采购分析</h1></div>
      <ElButton @click="load">刷新</ElButton>
    </div>
    <div class="management-card">
      <div class="toolbar">
        <ElInput v-model="keyword" clearable placeholder="搜索客户或常购商品" style="width:320px" />
      </div>
      <ElTable :data="filtered">
        <ElTableColumn prop="customer_no" label="客户编号" width="130" />
        <ElTableColumn prop="customer_name" label="客户名称" min-width="170" />
        <ElTableColumn prop="purchase_count" label="采购次数" width="110" />
        <ElTableColumn label="采购金额" width="140">
          <template #default="{ row }">¥{{ row.purchase_amount }}</template>
        </ElTableColumn>
        <ElTableColumn prop="frequent_product" label="常购商品" min-width="160">
          <template #default="{ row }">{{ row.frequent_product || '暂无' }}</template>
        </ElTableColumn>
        <ElTableColumn label="最近采购" width="190">
          <template #default="{ row }">
            {{ row.last_purchase_time ? new Date(row.last_purchase_time).toLocaleString() : '暂无采购' }}
          </template>
        </ElTableColumn>
      </ElTable>
    </div>
  </section>
</template>
