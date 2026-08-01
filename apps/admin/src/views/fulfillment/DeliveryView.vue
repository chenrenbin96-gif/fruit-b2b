<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import { fulfillmentApi, type Delivery } from '@/api/fulfillment';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const deliveries = ref<Delivery[]>([]);
const people = ref<Array<{ id: string; name: string }>>([]);
const rules = ref<Awaited<ReturnType<typeof fulfillmentApi.shippingRules>>>([]);
const filter = ref('');
const ruleForms = reactive<Record<string, { name: string; price: number; unit: '斤' | '公斤'; status: 'ACTIVE' | 'DISABLED' }>>({});

async function load() {
  const [deliveryRows, peopleRows, ruleRows] = await Promise.all([
    fulfillmentApi.deliveries(filter.value || undefined),
    fulfillmentApi.deliveryPeople(),
    auth.hasPermission('shipping.manage')
      ? fulfillmentApi.shippingRules()
      : Promise.resolve([]),
  ]);
  deliveries.value = deliveryRows;
  people.value = peopleRows;
  rules.value = ruleRows;
  ruleRows.forEach((rule) => {
    ruleForms[rule.id] = {
      name: rule.name,
      price: Number(rule.price_per_weight ?? rule.fixed_fee ?? 0),
      unit: rule.weight_unit ?? '斤',
      status: rule.status,
    };
  });
}

async function assign(row: Delivery, personId: string) {
  if (!personId) return;
  await fulfillmentApi.assignDelivery(row.id, personId);
  ElMessage.success('配送员已分配');
  await load();
}

async function start(row: Delivery) {
  await fulfillmentApi.updateDeliveryStatus(row.id, 'DELIVERING');
  ElMessage.success('已开始配送');
  await load();
}

async function failed(row: Delivery) {
  const result = await ElMessageBox.prompt(
    '请输入异常原因（客户拒收、无法联系、地址错误或其他）',
    '登记配送异常',
    { inputPattern: /\S+/, inputErrorMessage: '必须填写原因' },
  );
  await fulfillmentApi.updateDeliveryStatus(row.id, 'FAILED', undefined, {
    reason_code: 'OTHER',
    reason: result.value,
  });
  ElMessage.warning('配送异常已登记');
  await load();
}

async function delivered(row: Delivery) {
  const result = await ElMessageBox.prompt('请输入签收人', '确认送达', {
    inputPattern: /\S+/,
    inputErrorMessage: '必须填写签收人',
  });
  await fulfillmentApi.updateDeliveryStatus(row.id, 'DELIVERED', result.value);
  ElMessage.success('配送已完成');
  await load();
}

async function saveRule(id: string) {
  const form = ruleForms[id];
  if (!form) return;
  await fulfillmentApi.updateShippingRule(id, {
    name: form.name,
    calculation_type: 'WEIGHT',
    price_per_weight: form.price,
    weight_unit: form.unit,
    status: form.status,
  });
  ElMessage.success('运费规则已更新');
  await load();
}

function ruleForm(id: string) {
  return ruleForms[id]!;
}

onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div><p class="eyebrow">DELIVERY</p><h1>配送管理</h1></div>
    </div>

    <div
      v-if="auth.hasPermission('shipping.manage')"
      class="management-card"
      style="margin-bottom: 20px"
    >
      <h3>区域运费规则</h3>
      <ElTable :data="rules">
        <ElTableColumn prop="delivery_region_name" label="区域" width="150" />
        <ElTableColumn label="规则名称" min-width="180">
          <template #default="{ row }"><ElInput v-model="ruleForm(row.id).name" /></template>
        </ElTableColumn>
        <ElTableColumn label="重量单价" width="240">
          <template #default="{ row }">
            <ElInputNumber v-model="ruleForm(row.id).price" :min="0" :precision="4" />
            /{{ ruleForm(row.id).unit }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="100">
          <template #default="{ row }"><ElButton link type="primary" @click="saveRule(row.id)">保存</ElButton></template>
        </ElTableColumn>
      </ElTable>
    </div>

    <div class="management-card">
      <div class="toolbar">
        <ElSelect v-model="filter" clearable placeholder="全部配送状态" style="width: 180px" @change="load">
          <ElOption label="待配送" value="WAITING" />
          <ElOption label="配送中" value="DELIVERING" />
          <ElOption label="已送达" value="DELIVERED" />
          <ElOption label="配送失败" value="FAILED" />
        </ElSelect>
      </div>
      <ElTable :data="deliveries">
        <ElTableColumn prop="delivery_no" label="配送单号" min-width="190" />
        <ElTableColumn prop="order_no" label="订单号" min-width="190" />
        <ElTableColumn prop="customer_name" label="客户" width="140" />
        <ElTableColumn prop="address" label="地址" min-width="200" />
        <ElTableColumn label="配送员" width="160">
          <template #default="{ row }">
            <ElSelect
              :model-value="row.delivery_person_id"
              :disabled="row.status !== 'WAITING' || auth.principal?.role_code !== 'ADMIN'"
              placeholder="分配配送员"
              @update:model-value="assign(row, $event)"
            >
              <ElOption v-for="person in people" :key="person.id" :label="person.name" :value="person.id" />
            </ElSelect>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="status" label="状态" width="110" />
        <ElTableColumn label="操作" width="150">
          <template #default="{ row }">
            <ElButton v-if="row.status === 'WAITING' && row.delivery_person_id" link type="primary" @click="start(row)">开始配送</ElButton>
            <ElButton v-if="row.status === 'DELIVERING'" link type="success" @click="delivered(row)">确认送达</ElButton>
            <ElButton v-if="['WAITING','DELIVERING'].includes(row.status)" link type="danger" @click="failed(row)">登记异常</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>
  </section>
</template>
