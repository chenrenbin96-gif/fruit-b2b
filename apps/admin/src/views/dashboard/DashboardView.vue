<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import {
  getManagementDashboard,
  getWarehouseDashboard,
  type ManagementDashboard,
  type WarehouseDashboard,
} from '@/api/dashboard';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const loading = ref(false);
const warehouse = ref<WarehouseDashboard | null>(null);
const management = ref<ManagementDashboard | null>(null);
const error = ref('');
const canLoadWarehouse = computed(() => auth.hasPermission('order.read'));
const canLoadManagement = computed(() =>
  auth.hasPermission('dashboard.business.read'),
);

const warehouseCards = computed(() => [
  { label: '今日订单', value: warehouse.value?.today_orders ?? 0 },
  { label: '待审核', value: warehouse.value?.waiting_review ?? 0 },
  { label: '待拣货', value: warehouse.value?.waiting_picking ?? 0 },
  { label: '待称重', value: warehouse.value?.waiting_weighing ?? 0 },
  { label: '待配送', value: warehouse.value?.waiting_delivery ?? 0 },
  { label: '异常订单', value: warehouse.value?.exception_orders ?? 0 },
]);

const businessCards = computed(() => [
  { label: '今日销售额', value: `¥${management.value?.sales.today_sales ?? '0.00'}` },
  { label: '今日订单数', value: management.value?.sales.today_orders ?? 0 },
  { label: '今日毛利', value: `¥${management.value?.sales.today_gross_profit ?? '0.00'}` },
  { label: '今日毛利率', value: `${management.value?.sales.today_gross_margin_rate ?? '0.00'}%` },
  { label: '库存金额', value: `¥${management.value?.inventory.stock_value ?? '0.00'}` },
  { label: '低库存SKU', value: management.value?.inventory.low_stock_count ?? 0 },
  { label: '新增客户', value: management.value?.customers.new_customers ?? 0 },
  { label: '活跃客户', value: management.value?.customers.active_customers ?? 0 },
]);

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const [warehouseResult, managementResult] = await Promise.all([
      canLoadWarehouse.value ? getWarehouseDashboard() : Promise.resolve(null),
      canLoadManagement.value ? getManagementDashboard() : Promise.resolve(null),
    ]);
    warehouse.value = warehouseResult;
    management.value = managementResult;
  } catch {
    error.value = '看板数据加载失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section v-loading="loading">
    <div class="page-heading">
      <div>
        <p class="eyebrow">OPERATIONS DESK</p>
        <h1>{{ canLoadManagement ? "经营数据看板" : "仓库工作台" }}</h1>
      </div>
      <ElButton @click="load">刷新</ElButton>
    </div>

    <ElAlert v-if="error" :title="error" type="error" :closable="false" />

    <template v-if="canLoadManagement">
      <h2 class="section-title">经营概览</h2>
      <div class="metric-grid">
        <article v-for="card in businessCards" :key="card.label" class="metric-card">
          <span>{{ card.label }}</span><strong>{{ card.value }}</strong>
        </article>
      </div>

      <div class="table-grid">
        <ElCard shadow="never">
          <template #header>库存预警</template>
          <ElTable :data="management?.inventory.warnings ?? []" height="310">
            <ElTableColumn prop="product_name" label="商品" min-width="120" />
            <ElTableColumn prop="sku_name" label="SKU" min-width="120" />
            <ElTableColumn label="可售/预警" min-width="120">
              <template #default="{ row }">
                {{ row.available_quantity }}/{{ row.stock_warning }} {{ row.stock_unit }}
              </template>
            </ElTableColumn>
          </ElTable>
        </ElCard>
        <ElCard shadow="never">
          <template #header>客户欠款 TOP 10</template>
          <ElTable :data="management?.receivables.customers ?? []" height="310">
            <ElTableColumn prop="customer_name" label="客户" min-width="140" />
            <ElTableColumn prop="balance_due" label="欠款" min-width="110">
              <template #default="{ row }">¥{{ row.balance_due }}</template>
            </ElTableColumn>
            <ElTableColumn prop="credit_days" label="账期(天)" width="90" />
          </ElTable>
        </ElCard>
      </div>
    </template>

    <template v-if="canLoadWarehouse">
      <h2 class="section-title">订单履约</h2>
      <div class="metric-grid">
        <article v-for="card in warehouseCards" :key="card.label" class="metric-card">
          <span>{{ card.label }}</span><strong>{{ card.value }}</strong>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.section-title { margin: 26px 0 14px; color: #273c30; font-size: 18px; }
.metric-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.metric-card { padding: 22px; border: 1px solid #e5ebe7; border-left: 5px solid #24734b; border-radius: 14px; background: #fff; }
.metric-card span { display: block; color: #78847c; }
.metric-card strong { display: block; margin-top: 12px; color: #21352a; font-size: 30px; }
.table-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 20px; }
@media (max-width: 960px) {
  .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .table-grid { grid-template-columns: 1fr; }
}
</style>
