<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';

import { orderApi, type AdminOrder } from '@/api/orders';
import {
  warehouseApi,
  type WarehouseStage,
  type WarehouseTask,
} from '@/api/warehouse';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const loading = ref(false);
const stage = ref<WarehouseStage | ''>('');
const tasks = ref<WarehouseTask[]>([]);
const detail = ref<WarehouseTask | null>(null);
const order = ref<AdminOrder | null>(null);
const drawer = ref(false);
const picked = reactive<Record<string, number>>({});
const gross = reactive<Record<string, number>>({});
const net = reactive<Record<string, number>>({});
const weightItems = computed(
  () => order.value?.items?.filter((item) => item.sale_type === 'WEIGHT') ?? [],
);
const stageLabels: Record<WarehouseStage, string> = {
  WAITING_REVIEW: '待审核',
  WAITING_PICKING: '待拣货',
  PICKING: '拣货中',
  WAITING_WEIGHING: '待称重/复核',
  WAITING_OUTBOUND: '待出库',
  DELIVERING: '配送中',
  COMPLETED: '已完成',
};

async function load() {
  loading.value = true;
  try {
    tasks.value = await warehouseApi.tasks(stage.value || undefined);
  } finally {
    loading.value = false;
  }
}

async function open(row: WarehouseTask) {
  detail.value = await warehouseApi.detail(row.order_id);
  order.value = await orderApi.detail(row.order_id);
  detail.value.picking_task?.items.forEach((item) => {
    picked[item.id] = Number(item.picked_quantity ?? item.planned_quantity);
  });
  order.value.items?.forEach((item) => {
    if (item.sale_type === 'WEIGHT') {
      gross[item.id] = Number(item.actual_gross_weight ?? item.planned_weight);
      net[item.id] = Number(item.actual_net_weight ?? item.planned_weight);
    }
  });
  drawer.value = true;
}

async function startPicking() {
  if (!detail.value) return;
  await warehouseApi.startPicking(detail.value.order_id);
  ElMessage.success('已领取拣货任务');
  await refreshDetail();
}

async function completePicking() {
  if (!detail.value?.picking_task) return;
  await warehouseApi.completePicking(
    detail.value.order_id,
    detail.value.picking_task.items.map((item) => ({
      task_item_id: item.id,
      picked_quantity: picked[item.id] ?? 0,
    })),
  );
  ElMessage.success('拣货数量已确认');
  await refreshDetail();
}

async function completeFulfillment() {
  if (!detail.value || !order.value) return;
  if (weightItems.value.length) {
    await orderApi.completeWeighing(
      detail.value.order_id,
      weightItems.value.map((item) => ({
        order_item_id: item.id,
        actual_gross_weight: gross[item.id] ?? 0,
        actual_net_weight: net[item.id] ?? 0,
      })),
    );
  } else {
    await orderApi.completePieceOrder(detail.value.order_id);
  }
  ElMessage.success(weightItems.value.length ? '称重结算完成' : '按件数量复核完成');
  await refreshDetail();
}

async function packageAction(action: 'start' | 'complete' | 'outbound') {
  if (!detail.value) return;
  await warehouseApi.packageAction(detail.value.order_id, action);
  ElMessage.success(
    action === 'start' ? '开始打包' : action === 'complete' ? '打包完成' : '已确认出库',
  );
  await refreshDetail();
}

async function refreshDetail() {
  if (!detail.value) return;
  detail.value = await warehouseApi.detail(detail.value.order_id);
  order.value = await orderApi.detail(detail.value.order_id);
  await load();
}

onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div><p class="eyebrow">WAREHOUSE OPERATIONS</p><h1>仓库任务</h1></div>
    </div>
    <div class="management-card">
      <div class="toolbar">
        <ElSelect v-model="stage" clearable placeholder="全部作业状态" style="width:190px" @change="load">
          <ElOption v-for="(label, value) in stageLabels" :key="value" :label="label" :value="value" />
        </ElSelect>
      </div>
      <ElTable v-loading="loading" :data="tasks">
        <ElTableColumn prop="order_no" label="订单编号" min-width="190" />
        <ElTableColumn prop="customer_name" label="客户名称" min-width="150" />
        <ElTableColumn prop="item_count" label="商品种数" width="100" />
        <ElTableColumn label="订单金额" width="120"><template #default="{ row }">¥{{ row.order_amount }}</template></ElTableColumn>
        <ElTableColumn label="作业状态" width="130"><template #default="{ row }">{{ stageLabels[row.stage as WarehouseStage] ?? row.stage }}</template></ElTableColumn>
        <ElTableColumn prop="created_at" label="创建时间" min-width="180" />
        <ElTableColumn label="操作" width="100"><template #default="{ row }"><ElButton link type="primary" @click="open(row)">处理</ElButton></template></ElTableColumn>
      </ElTable>
    </div>

    <ElDrawer v-model="drawer" title="仓库作业" size="760px">
      <template v-if="detail && order">
        <ElDescriptions :column="2" border>
          <ElDescriptionsItem label="订单号">{{ detail.order_no }}</ElDescriptionsItem>
          <ElDescriptionsItem label="客户">{{ detail.customer_name }}</ElDescriptionsItem>
          <ElDescriptionsItem label="作业状态">{{ stageLabels[detail.stage] }}</ElDescriptionsItem>
          <ElDescriptionsItem label="金额">¥{{ detail.order_amount }}</ElDescriptionsItem>
        </ElDescriptions>

        <ElTable v-if="detail.picking_task" :data="detail.picking_task.items" style="margin-top:20px">
          <ElTableColumn prop="product_name" label="商品" min-width="150" />
          <ElTableColumn prop="sku_name" label="规格" min-width="130" />
          <ElTableColumn label="计划数量" width="120"><template #default="{ row }">{{ row.planned_quantity }} {{ row.unit }}</template></ElTableColumn>
          <ElTableColumn label="实拣数量" width="180">
            <template #default="{ row }"><ElInputNumber v-model="picked[row.id]" :min="0.001" :precision="3" :disabled="detail?.picking_status !== 'PICKING'" /></template>
          </ElTableColumn>
        </ElTable>

        <ElTable v-if="detail.stage === 'WAITING_WEIGHING'" :data="order.items" style="margin-top:20px">
          <ElTableColumn prop="product_name" label="商品" />
          <ElTableColumn label="称重复核" min-width="330">
            <template #default="{ row }">
              <template v-if="row.sale_type === 'WEIGHT'">
                毛重 <ElInputNumber v-model="gross[row.id]" :min="0.001" :precision="3" style="width:120px" />
                净重 <ElInputNumber v-model="net[row.id]" :min="0.001" :precision="3" style="width:120px" />
              </template>
              <span v-else>按件数量已确认：{{ row.planned_quantity }} {{ row.unit }}</span>
            </template>
          </ElTableColumn>
        </ElTable>

        <div class="task-actions">
          <ElButton v-if="detail.stage === 'WAITING_REVIEW'" @click="router.push('/orders')">前往审核</ElButton>
          <ElButton v-if="detail.stage === 'WAITING_PICKING'" v-permission="'warehouse.task.pick'" type="primary" @click="startPicking">领取并开始拣货</ElButton>
          <ElButton v-if="detail.stage === 'PICKING'" v-permission="'warehouse.task.pick'" type="success" @click="completePicking">确认完成拣货</ElButton>
          <ElButton v-if="detail.stage === 'WAITING_WEIGHING'" v-permission="'order.fulfill'" type="success" @click="completeFulfillment">{{ weightItems.length ? '确认称重结算' : '确认按件数量' }}</ElButton>
          <ElButton v-if="detail.stage === 'WAITING_OUTBOUND' && detail.package?.status === 'WAITING'" v-permission="'warehouse.package.manage'" @click="packageAction('start')">开始打包</ElButton>
          <ElButton v-if="detail.package?.status === 'PACKING'" v-permission="'warehouse.package.manage'" type="success" @click="packageAction('complete')">完成打包</ElButton>
          <ElButton v-if="detail.package?.status === 'DONE' && !detail.package.outbound_at" v-permission="'warehouse.outbound'" type="primary" @click="packageAction('outbound')">确认出库</ElButton>
        </div>
      </template>
    </ElDrawer>
  </section>
</template>

<style scoped>
.task-actions { display:flex; justify-content:flex-end; gap:12px; margin-top:24px; }
</style>
