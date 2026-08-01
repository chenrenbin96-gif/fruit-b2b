<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
  supplyChainApi,
  type CostRow,
  type ProfitAnalysis,
} from '@/api/procurement';

const loading = ref(false);
const costs = ref<CostRow[]>([]);
const profit = ref<ProfitAnalysis | null>(null);
const active = ref('cost');
const cards = computed(() => [
  { label: '今日商品销售额', value: `¥${profit.value?.today.sales_amount ?? '0.00'}` },
  { label: '今日采购成本', value: `¥${profit.value?.today.cost_amount ?? '0.00'}` },
  { label: '今日毛利', value: `¥${profit.value?.today.gross_profit ?? '0.00'}` },
  { label: '今日毛利率', value: `${profit.value?.today.gross_margin_rate ?? '0.00'}%` },
]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    [costs.value, profit.value] = await Promise.all([
      supplyChainApi.costs(),
      supplyChainApi.profitAnalysis(),
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
      <div><p class="eyebrow">PROFITABILITY</p><h1>成本与毛利分析</h1></div>
      <ElButton @click="load">刷新</ElButton>
    </div>
    <div class="metric-grid">
      <article v-for="card in cards" :key="card.label" class="metric-card">
        <span>{{ card.label }}</span><strong>{{ card.value }}</strong>
      </article>
    </div>
    <ElAlert
      title="毛利采用当前SKU移动平均成本估算；每次采购入库会保留历史采购价，并同步最新移动平均成本。"
      type="info"
      :closable="false"
      style="margin:16px 0"
    />
    <div class="management-card">
      <ElTabs v-model="active">
        <ElTabPane label="SKU成本" name="cost">
          <ElTable :data="costs">
            <ElTableColumn prop="product_name" label="商品" min-width="150" />
            <ElTableColumn prop="sku_name" label="SKU" min-width="150" />
            <ElTableColumn label="采购成本"><template #default="{ row }">¥{{ row.cost_price }}</template></ElTableColumn>
            <ElTableColumn label="销售价格"><template #default="{ row }">¥{{ row.base_price }}</template></ElTableColumn>
            <ElTableColumn label="单位毛利"><template #default="{ row }">¥{{ row.gross_profit_amount }}</template></ElTableColumn>
            <ElTableColumn label="毛利率"><template #default="{ row }">{{ row.gross_margin_rate }}%</template></ElTableColumn>
            <ElTableColumn label="库存金额"><template #default="{ row }">¥{{ row.stock_value }}</template></ElTableColumn>
          </ElTable>
        </ElTabPane>
        <ElTabPane label="热销TOP10" name="hot">
          <ElTable :data="profit?.hot_products ?? []">
            <ElTableColumn prop="product_name" label="商品" />
            <ElTableColumn prop="sku_name" label="SKU" />
            <ElTableColumn prop="sold_quantity" label="销量" />
            <ElTableColumn prop="order_count" label="订单数" />
            <ElTableColumn prop="sales_amount" label="销售额" />
          </ElTable>
        </ElTabPane>
        <ElTabPane label="利润TOP10" name="profit">
          <ElTable :data="profit?.profit_products ?? []">
            <ElTableColumn prop="product_name" label="商品" />
            <ElTableColumn prop="sku_name" label="SKU" />
            <ElTableColumn prop="gross_profit" label="毛利" />
            <ElTableColumn prop="gross_margin_rate" label="毛利率(%)" />
          </ElTable>
        </ElTabPane>
        <ElTabPane :label="`亏损预警(${profit?.loss_warnings.length ?? 0})`" name="loss">
          <ElTable :data="profit?.loss_warnings ?? []">
            <ElTableColumn prop="product_name" label="商品" />
            <ElTableColumn prop="sku_name" label="SKU" />
            <ElTableColumn prop="sales_amount" label="销售额" />
            <ElTableColumn prop="cost_amount" label="成本" />
            <ElTableColumn prop="gross_profit" label="毛利" />
          </ElTable>
        </ElTabPane>
      </ElTabs>
    </div>
  </section>
</template>

<style scoped>
.metric-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.metric-card{padding:20px;border:1px solid #e5ebe7;border-radius:14px;background:#fff}.metric-card span{color:#78847c}.metric-card strong{display:block;margin-top:10px;font-size:26px;color:#21352a}@media(max-width:960px){.metric-grid{grid-template-columns:repeat(2,1fr)}}
</style>
