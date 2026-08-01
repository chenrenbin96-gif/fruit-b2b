<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute } from 'vue-router';

import { procurementApi } from '@/api/procurement';

const route = useRoute();
const loading = ref(false);
const rows = ref<Record<string, any>[]>([]);
const analysis = ref<Record<string, any>>({});
const period = ref('month');
const mode = computed(() => String(route.meta.procurementMode ?? 'history'));
const titles: Record<string, string> = {
  returns: '采购退货',
  history: '采购历史',
  prices: '采购价格',
  supplierProducts: '供应商商品库',
  purchasers: '采购员管理',
  plans: '采购计划',
  analysis: '采购分析',
};

async function load(): Promise<void> {
  loading.value = true;
  try {
    if (mode.value === 'returns') rows.value = await procurementApi.purchaseReturns();
    if (mode.value === 'history') rows.value = await procurementApi.purchaseHistory();
    if (mode.value === 'prices') rows.value = await procurementApi.purchasePrices();
    if (mode.value === 'purchasers') rows.value = await procurementApi.purchasers();
    if (mode.value === 'plans') rows.value = await procurementApi.purchasePlans();
    if (mode.value === 'analysis') analysis.value = await procurementApi.purchaseAnalysis(period.value);
    if (mode.value === 'supplierProducts') {
      const suppliers = await procurementApi.suppliers();
      const groups = await Promise.all(suppliers.map(async (supplier) =>
        (await procurementApi.supplierProducts(supplier.id)).map((row) => ({
          ...row,
          supplier_name: supplier.supplier_name,
        })),
      ));
      rows.value = groups.flat();
    }
  } finally {
    loading.value = false;
  }
}

async function generatePlans(): Promise<void> {
  rows.value = await procurementApi.generatePurchasePlans();
  ElMessage.success('已按库存、安全库存、30天销量和采购周期生成采购计划');
}

async function updateReturn(row: Record<string, any>, status: string): Promise<void> {
  await ElMessageBox.confirm(`确认将退货单 ${row.returnNo} 更新为 ${status}？`, '采购退货');
  await procurementApi.updatePurchaseReturn(String(row.id), status);
  ElMessage.success('退货状态已更新');
  await load();
}

watch(() => route.fullPath, load);
onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div><p class="eyebrow">PROCUREMENT CENTER</p><h1>{{ titles[mode] }}</h1></div>
      <div>
        <ElSelect v-if="mode === 'analysis'" v-model="period" style="width:120px" @change="load">
          <ElOption label="日" value="day" /><ElOption label="周" value="week" /><ElOption label="月" value="month" />
        </ElSelect>
        <ElButton v-if="mode === 'plans'" type="primary" @click="generatePlans">生成采购计划</ElButton>
      </div>
    </div>

    <div v-if="mode === 'analysis'" v-loading="loading" class="management-card">
      <ElRow :gutter="16">
        <ElCol :span="6"><ElStatistic title="采购金额" :value="Number(analysis.summary?.purchase_amount ?? 0)" prefix="¥" /></ElCol>
        <ElCol :span="6"><ElStatistic title="采购数量" :value="Number(analysis.summary?.purchase_quantity ?? 0)" /></ElCol>
        <ElCol :span="6"><ElStatistic title="采购单数" :value="Number(analysis.summary?.purchase_orders ?? 0)" /></ElCol>
        <ElCol :span="6"><ElStatistic title="供应商数" :value="Number(analysis.summary?.supplier_count ?? 0)" /></ElCol>
      </ElRow>
      <h3>供应商采购排行</h3>
      <ElTable :data="analysis.supplier_ranking ?? []">
        <ElTableColumn prop="supplier_name" label="供应商" />
        <ElTableColumn prop="amount" label="采购金额" />
      </ElTable>
    </div>

    <div v-else class="management-card">
      <ElTable v-loading="loading" :data="rows">
        <template v-if="mode === 'returns'">
          <ElTableColumn prop="returnNo" label="退货单号" width="210" />
          <ElTableColumn prop="purchaseOrderId" label="采购订单" />
          <ElTableColumn prop="reason" label="退货原因" />
          <ElTableColumn prop="amount" label="退货金额" />
          <ElTableColumn prop="status" label="状态" />
          <ElTableColumn label="操作" width="180">
            <template #default="{ row }">
              <ElButton v-if="row.status === 'PENDING_REVIEW'" link @click="updateReturn(row, 'APPROVED')">审核</ElButton>
              <ElButton v-if="row.status === 'APPROVED'" link type="success" @click="updateReturn(row, 'COMPLETED')">完成退货</ElButton>
            </template>
          </ElTableColumn>
        </template>
        <template v-else-if="mode === 'history'">
          <ElTableColumn prop="purchase_date" label="采购日期" width="180" />
          <ElTableColumn prop="purchase_no" label="采购单号" width="190" />
          <ElTableColumn prop="supplier_name" label="供应商" />
          <ElTableColumn prop="product_name" label="商品" />
          <ElTableColumn prop="sku_name" label="SKU" />
          <ElTableColumn prop="quantity" label="数量" /><ElTableColumn prop="price" label="采购价" /><ElTableColumn prop="amount" label="金额" />
        </template>
        <template v-else-if="mode === 'prices'">
          <ElTableColumn prop="product_name" label="商品" /><ElTableColumn prop="sku_name" label="SKU" />
          <ElTableColumn prop="latest_price" label="最近采购价" /><ElTableColumn prop="lowest_price" label="最低价" />
          <ElTableColumn prop="highest_price" label="最高价" /><ElTableColumn prop="average_price" label="加权平均价" />
          <ElTableColumn prop="updated_at" label="更新时间" width="180" />
        </template>
        <template v-else-if="mode === 'supplierProducts'">
          <ElTableColumn prop="supplier_name" label="供应商" /><ElTableColumn prop="product_name" label="商品" />
          <ElTableColumn prop="sku_name" label="SKU" /><ElTableColumn prop="sku_code" label="SKU编码" />
          <ElTableColumn prop="purchase_price" label="供应价" /><ElTableColumn prop="last_purchase_time" label="最近采购" />
        </template>
        <template v-else-if="mode === 'purchasers'">
          <ElTableColumn prop="username" label="账号" /><ElTableColumn prop="name" label="采购员" />
          <ElTableColumn prop="phone" label="电话" /><ElTableColumn prop="status" label="状态" />
        </template>
        <template v-else-if="mode === 'plans'">
          <ElTableColumn prop="product_name" label="商品" /><ElTableColumn prop="sku_name" label="SKU" />
          <ElTableColumn prop="current_stock" label="当前库存" /><ElTableColumn prop="safe_stock" label="安全库存" />
          <ElTableColumn prop="thirty_day_sales" label="30天销量" /><ElTableColumn prop="supply_cycle_days" label="供应周期(天)" />
          <ElTableColumn prop="suggest_quantity" label="建议采购" /><ElTableColumn prop="status" label="状态" />
        </template>
      </ElTable>
    </div>
  </section>
</template>
