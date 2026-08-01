<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import { fulfillmentApi, type Delivery } from '@/api/fulfillment';

const loading = ref(false);
const tasks = ref<Delivery[]>([]);

async function load() {
  loading.value = true;
  try {
    const rows = await fulfillmentApi.deliveries();
    tasks.value = rows.filter((item) =>
      ['WAITING', 'DELIVERING', 'FAILED'].includes(item.status),
    );
  } finally {
    loading.value = false;
  }
}

async function start(item: Delivery) {
  await fulfillmentApi.updateDeliveryStatus(item.id, 'DELIVERING');
  ElMessage.success('配送已开始');
  await load();
}

async function complete(item: Delivery) {
  const result = await ElMessageBox.prompt('请输入签收人姓名', '完成配送', {
    inputPattern: /\S+/,
    inputErrorMessage: '必须填写签收人',
  });
  await fulfillmentApi.updateDeliveryStatus(item.id, 'DELIVERED', result.value);
  ElMessage.success('客户已签收');
  await load();
}

async function failure(item: Delivery) {
  const result = await ElMessageBox.prompt('请填写配送失败原因', '配送异常', {
    inputPattern: /\S+/,
    inputErrorMessage: '必须填写失败原因',
  });
  await fulfillmentApi.updateDeliveryStatus(item.id, 'FAILED', undefined, {
    reason_code: 'OTHER',
    reason: result.value,
  });
  await load();
}

onMounted(load);
</script>

<template>
  <section class="mobile-delivery">
    <header><p>DELIVERY TODAY</p><h1>今日配送订单</h1></header>
    <ElEmpty v-if="!loading && !tasks.length" description="今日暂无配送任务" />
    <article v-for="item in tasks" :key="item.id" class="task-card">
      <div class="task-head">
        <strong>{{ item.customer_name }}</strong>
        <ElTag :type="item.status === 'FAILED' ? 'danger' : item.status === 'DELIVERING' ? 'warning' : 'info'">
          {{ item.status }}
        </ElTag>
      </div>
      <p>{{ item.address }}</p>
      <a :href="`tel:${item.phone}`">{{ item.phone }}</a>
      <div class="metrics">
        <span>订单 ¥{{ item.order_amount }}</span>
        <span>{{ item.item_count }} 种商品</span>
      </div>
      <div class="actions">
        <ElButton v-if="item.status === 'WAITING'" type="primary" @click="start(item)">开始配送</ElButton>
        <ElButton v-if="item.status === 'DELIVERING'" type="success" @click="complete(item)">完成配送</ElButton>
        <ElButton v-if="['WAITING','DELIVERING'].includes(item.status)" type="danger" plain @click="failure(item)">配送失败</ElButton>
      </div>
    </article>
  </section>
</template>

<style scoped>
.mobile-delivery { max-width:680px; margin:0 auto; }
header { margin-bottom:20px; }
header p { color:#758178; font-size:12px; letter-spacing:2px; }
.task-card { margin-bottom:14px; padding:20px; border-radius:18px; background:#fff; box-shadow:0 6px 24px rgba(31,67,45,.08); }
.task-head,.metrics,.actions { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.task-card p { color:#59675e; line-height:1.6; }
.task-card a { color:#26714a; }
.metrics { margin-top:16px; padding-top:14px; border-top:1px solid #edf0ed; color:#6f7a73; }
.actions { margin-top:18px; justify-content:flex-end; }
@media (max-width: 720px) {
  .mobile-delivery { margin:-10px; }
  .task-card { border-radius:14px; }
  .actions .el-button { flex:1; }
}
</style>
