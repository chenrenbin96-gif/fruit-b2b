<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import { orderApi, type AdminOrder } from '@/api/orders';

const loading = ref(false);
const orders = ref<AdminOrder[]>([]);
const detail = ref<AdminOrder | null>(null);
const drawerVisible = ref(false);
const grossWeights = reactive<Record<string, number>>({});
const netWeights = reactive<Record<string, number>>({});
const weightItems = computed(
  () => detail.value?.items?.filter((item) => item.sale_type === 'WEIGHT') ?? [],
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const results = await Promise.all(
      ['APPROVED', 'PICKING', 'WEIGHING'].map((status) =>
        orderApi.list({ status, page_size: 100 }),
      ),
    );
    orders.value = results.flatMap((result) => result.items);
  } finally {
    loading.value = false;
  }
}

async function open(row: AdminOrder): Promise<void> {
  detail.value = await orderApi.detail(row.id);
  Object.keys(grossWeights).forEach((key) => delete grossWeights[key]);
  Object.keys(netWeights).forEach((key) => delete netWeights[key]);
  detail.value.items?.forEach((item) => {
    if (item.sale_type === 'WEIGHT') {
      grossWeights[item.id] = Number(item.actual_gross_weight ?? item.actual_weight ?? item.planned_weight);
      netWeights[item.id] = Number(item.actual_net_weight ?? item.actual_weight ?? item.planned_weight);
    }
  });
  drawerVisible.value = true;
}

async function startPicking(): Promise<void> {
  if (!detail.value) return;
  await orderApi.startPicking(detail.value.id);
  ElMessage.success('订单已进入拣货状态');
  detail.value = await orderApi.detail(detail.value.id);
  await load();
}

async function complete(): Promise<void> {
  if (!detail.value) return;
  await ElMessageBox.confirm(
    '完成后将重新计价、核销优惠券、计算运费、扣减库存并生成配送单，确认继续？',
    '完成仓库履约',
    { type: 'warning' },
  );
  if (weightItems.value.length) {
    await orderApi.completeWeighing(
      detail.value.id,
      weightItems.value.map((item) => ({
        order_item_id: item.id,
        actual_gross_weight: grossWeights[item.id] ?? 0,
        actual_net_weight: netWeights[item.id] ?? 0,
      })),
    );
  } else {
    await orderApi.completePieceOrder(detail.value.id);
  }
  ElMessage.success('履约完成，配送单已生成');
  drawerVisible.value = false;
  await load();
}

onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">WAREHOUSE FULFILLMENT</p>
        <h1>称重与履约</h1>
      </div>
    </div>
    <div class="management-card">
      <ElTable v-loading="loading" :data="orders">
        <ElTableColumn prop="order_no" label="订单号" min-width="210" />
        <ElTableColumn prop="customer_name" label="客户" min-width="160" />
        <ElTableColumn prop="estimated_amount" label="预计金额" width="120" />
        <ElTableColumn prop="status" label="状态" width="130" />
        <ElTableColumn label="操作" width="100">
          <template #default="{ row }">
            <ElButton link type="primary" @click="open(row)">处理</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <ElDrawer v-model="drawerVisible" title="仓库履约" size="700px">
      <template v-if="detail">
        <ElDescriptions :column="2" border>
          <ElDescriptionsItem label="订单号">{{ detail.order_no }}</ElDescriptionsItem>
          <ElDescriptionsItem label="状态">{{ detail.status }}</ElDescriptionsItem>
          <ElDescriptionsItem label="预计商品金额">
            ¥{{ detail.estimated_product_amount }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="预计优惠">
            -¥{{ detail.estimated_discount_amount }}
          </ElDescriptionsItem>
        </ElDescriptions>

        <ElTable :data="detail.items" style="margin-top: 20px">
          <ElTableColumn prop="product_name" label="商品" min-width="130" />
          <ElTableColumn prop="sku_name" label="规格" min-width="110" />
          <ElTableColumn label="预计采购量" width="130">
            <template #default="{ row }">
              {{ row.sale_type === 'PIECE' ? row.planned_quantity : row.planned_weight }}
              {{ row.unit }}
            </template>
          </ElTableColumn>
          <ElTableColumn label="实际毛重/净重" width="300">
            <template #default="{ row }">
              <template v-if="row.sale_type === 'WEIGHT'">
                <ElInputNumber
                  v-model="grossWeights[row.id]"
                  :min="0.001"
                  :precision="3"
                  :disabled="detail?.status === 'APPROVED'"
                  controls-position="right"
                  style="width: 130px"
                />
                {{ row.weight_unit }}
                <ElInputNumber
                  v-model="netWeights[row.id]"
                  :min="0.001"
                  :precision="3"
                  :disabled="detail?.status === 'APPROVED'"
                  controls-position="right"
                  style="width: 130px; margin-left: 8px"
                />
                {{ row.weight_unit }}
              </template>
              <span v-else>按件，无需称重</span>
            </template>
          </ElTableColumn>
        </ElTable>

        <div style="display: flex; justify-content: flex-end; margin-top: 24px">
          <ElButton
            v-if="detail.status === 'APPROVED'"
            type="primary"
            @click="startPicking"
          >
            开始拣货
          </ElButton>
          <ElButton
            v-else
            type="success"
            :disabled="weightItems.some((item) => !grossWeights[item.id] || !netWeights[item.id])"
            @click="complete"
          >
            {{ weightItems.length ? '确认称重并完成履约' : '完成按件订单履约' }}
          </ElButton>
        </div>
      </template>
    </ElDrawer>
  </section>
</template>
