<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { getAuditLogs } from '@/api/audit';

const rows = ref<Awaited<ReturnType<typeof getAuditLogs>>>([]);
const moduleCode = ref('');

async function load() {
  rows.value = await getAuditLogs(moduleCode.value);
}

onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div><p class="eyebrow">AUDIT</p><h1>操作日志</h1></div>
    </div>
    <div class="management-card">
      <div class="toolbar">
        <ElSelect v-model="moduleCode" clearable placeholder="全部模块" style="width: 180px" @change="load">
          <ElOption v-for="item in ['PRICE','INVENTORY','ORDER','FULFILLMENT','COUPON','FINANCE']" :key="item" :label="item" :value="item" />
        </ElSelect>
      </div>
      <ElTable :data="rows">
        <ElTableColumn prop="created_at" label="时间" min-width="180" />
        <ElTableColumn prop="operator_name" label="操作人" width="130" />
        <ElTableColumn prop="module_code" label="模块" width="120" />
        <ElTableColumn prop="action_code" label="操作" min-width="190" />
        <ElTableColumn label="对象" min-width="160">
          <template #default="{ row }">{{ row.target_type }} #{{ row.target_id ?? "-" }}</template>
        </ElTableColumn>
        <ElTableColumn label="前后数据" width="120">
          <template #default="{ row }">
            <ElPopover width="640" trigger="click">
              <template #reference><ElButton link type="primary">查看变化</ElButton></template>
              <pre style="max-height: 500px; overflow: auto">{{ JSON.stringify({ before: row.before_data, after: row.after_data }, null, 2) }}</pre>
            </ElPopover>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>
  </section>
</template>
