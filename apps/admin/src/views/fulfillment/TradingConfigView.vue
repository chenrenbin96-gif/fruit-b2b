<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';

import { catalogApi, type PriceReferences } from '@/api/catalog';
import { fulfillmentApi } from '@/api/fulfillment';

type Region = Awaited<ReturnType<typeof fulfillmentApi.deliveryRegions>>[number];
type Rule = Awaited<ReturnType<typeof fulfillmentApi.shippingRules>>[number];

const router = useRouter();
const regions = ref<Region[]>([]);
const rules = ref<Rule[]>([]);
const levels = ref<PriceReferences['levels']>([]);
const regionDialog = ref(false);
const ruleDialog = ref(false);
const editingRegionId = ref<string | null>(null);
const editingRuleId = ref<string | null>(null);
const regionForm = reactive({
  region_code: '',
  region_name: '',
  address_keywords: '',
  min_order_amount: 500,
  is_default: false,
  sort: 0,
  status: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
});
const ruleForm = reactive({
  delivery_region_id: '',
  name: '',
  calculation_type: 'WEIGHT' as 'WEIGHT' | 'FIXED',
  price_per_weight: 1,
  weight_unit: '斤' as '斤' | '公斤',
  fixed_fee: 0,
  status: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
});

async function load() {
  const [regionRows, ruleRows, refs] = await Promise.all([
    fulfillmentApi.deliveryRegions(),
    fulfillmentApi.shippingRules(),
    catalogApi.priceReferences(),
  ]);
  regions.value = regionRows;
  rules.value = ruleRows;
  levels.value = refs.levels;
}

function editRegion(row?: Region) {
  editingRegionId.value = row?.id ?? null;
  Object.assign(regionForm, {
    region_code: row?.region_code ?? '',
    region_name: row?.region_name ?? '',
    address_keywords: row?.address_keywords ?? '',
    min_order_amount: Number(row?.min_order_amount ?? 500),
    is_default: row?.is_default ?? false,
    sort: row?.sort ?? 0,
    status: row?.status ?? 'ACTIVE',
  });
  regionDialog.value = true;
}

async function saveRegion() {
  await fulfillmentApi.saveDeliveryRegion(editingRegionId.value, regionForm);
  ElMessage.success('配送区域与起送金额已保存');
  regionDialog.value = false;
  await load();
}

function editRule(row?: Rule) {
  editingRuleId.value = row?.id ?? null;
  Object.assign(ruleForm, {
    delivery_region_id: row?.delivery_region_id ?? regions.value[0]?.id ?? '',
    name: row?.name ?? '',
    calculation_type: row?.calculation_type ?? 'WEIGHT',
    price_per_weight: Number(row?.price_per_weight ?? 1),
    weight_unit: row?.weight_unit ?? '斤',
    fixed_fee: Number(row?.fixed_fee ?? 0),
    status: row?.status ?? 'ACTIVE',
  });
  ruleDialog.value = true;
}

async function saveRule() {
  const payload = {
    ...ruleForm,
    price_per_weight:
      ruleForm.calculation_type === 'WEIGHT'
        ? ruleForm.price_per_weight
        : undefined,
    weight_unit:
      ruleForm.calculation_type === 'WEIGHT'
        ? ruleForm.weight_unit
        : undefined,
    fixed_fee:
      ruleForm.calculation_type === 'FIXED' ? ruleForm.fixed_fee : undefined,
  };
  if (editingRuleId.value) {
    await fulfillmentApi.updateShippingRule(editingRuleId.value, payload);
  } else {
    await fulfillmentApi.createShippingRule(payload);
  }
  ElMessage.success('配送费规则已保存');
  ruleDialog.value = false;
  await load();
}

onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div><p class="eyebrow">TRADING CONFIG</p><h1>交易配置</h1></div>
    </div>

    <div class="management-card">
      <div class="toolbar">
        <h3>配送区域与起送金额</h3>
        <ElButton type="primary" @click="editRegion()">新增区域</ElButton>
      </div>
      <ElTable :data="regions">
        <ElTableColumn prop="region_name" label="区域" />
        <ElTableColumn prop="address_keywords" label="地址匹配词" min-width="220" />
        <ElTableColumn prop="min_order_amount" label="起送金额">
          <template #default="{ row }">¥{{ row.min_order_amount }}</template>
        </ElTableColumn>
        <ElTableColumn label="默认"><template #default="{ row }">{{ row.is_default ? '是' : '否' }}</template></ElTableColumn>
        <ElTableColumn prop="status" label="状态" />
        <ElTableColumn label="操作"><template #default="{ row }"><ElButton link type="primary" @click="editRegion(row)">编辑</ElButton></template></ElTableColumn>
      </ElTable>
    </div>

    <div class="management-card" style="margin-top: 20px">
      <div class="toolbar">
        <h3>配送费配置</h3>
        <ElButton type="primary" @click="editRule()">新增规则</ElButton>
      </div>
      <ElTable :data="rules">
        <ElTableColumn prop="delivery_region_name" label="区域" />
        <ElTableColumn prop="name" label="规则名称" />
        <ElTableColumn prop="calculation_type" label="计费方式" />
        <ElTableColumn label="费用">
          <template #default="{ row }">
            {{ row.calculation_type === 'FIXED' ? `¥${row.fixed_fee}` : `¥${row.price_per_weight}/${row.weight_unit}` }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作"><template #default="{ row }"><ElButton link type="primary" @click="editRule(row)">编辑</ElButton></template></ElTableColumn>
      </ElTable>
    </div>

    <div class="management-card" style="margin-top: 20px">
      <div class="toolbar">
        <div><h3>客户等级配置</h3><p>当前等级：{{ levels.map((item) => item.name).join('、') }}</p></div>
        <ElButton @click="router.push('/prices')">进入等级价格配置</ElButton>
      </div>
    </div>

    <ElDialog v-model="regionDialog" title="配送区域" width="560">
      <ElForm label-width="110px">
        <ElFormItem label="区域编码"><ElInput v-model="regionForm.region_code" /></ElFormItem>
        <ElFormItem label="区域名称"><ElInput v-model="regionForm.region_name" /></ElFormItem>
        <ElFormItem label="地址匹配词"><ElInput v-model="regionForm.address_keywords" placeholder="多个关键词用逗号分隔" /></ElFormItem>
        <ElFormItem label="起送金额"><ElInputNumber v-model="regionForm.min_order_amount" :min="0" :precision="2" /></ElFormItem>
        <ElFormItem label="默认区域"><ElSwitch v-model="regionForm.is_default" /></ElFormItem>
        <ElFormItem label="排序"><ElInputNumber v-model="regionForm.sort" /></ElFormItem>
        <ElFormItem label="状态"><ElSwitch v-model="regionForm.status" active-value="ACTIVE" inactive-value="DISABLED" /></ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="regionDialog = false">取消</ElButton><ElButton type="primary" @click="saveRegion">保存</ElButton></template>
    </ElDialog>

    <ElDialog v-model="ruleDialog" title="配送费规则" width="560">
      <ElForm label-width="110px">
        <ElFormItem label="配送区域"><ElSelect v-model="ruleForm.delivery_region_id" style="width:100%"><ElOption v-for="item in regions" :key="item.id" :label="item.region_name" :value="item.id" /></ElSelect></ElFormItem>
        <ElFormItem label="规则名称"><ElInput v-model="ruleForm.name" /></ElFormItem>
        <ElFormItem label="计费方式"><ElRadioGroup v-model="ruleForm.calculation_type"><ElRadioButton value="WEIGHT">按重量</ElRadioButton><ElRadioButton value="FIXED">固定费用</ElRadioButton></ElRadioGroup></ElFormItem>
        <template v-if="ruleForm.calculation_type === 'WEIGHT'">
          <ElFormItem label="重量单价"><ElInputNumber v-model="ruleForm.price_per_weight" :min="0" :precision="4" /></ElFormItem>
          <ElFormItem label="重量单位"><ElSelect v-model="ruleForm.weight_unit"><ElOption label="斤" value="斤" /><ElOption label="公斤" value="公斤" /></ElSelect></ElFormItem>
        </template>
        <ElFormItem v-else label="固定运费"><ElInputNumber v-model="ruleForm.fixed_fee" :min="0" :precision="2" /></ElFormItem>
        <ElFormItem label="状态"><ElSwitch v-model="ruleForm.status" active-value="ACTIVE" inactive-value="DISABLED" /></ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="ruleDialog = false">取消</ElButton><ElButton type="primary" @click="saveRule">保存</ElButton></template>
    </ElDialog>
  </section>
</template>
