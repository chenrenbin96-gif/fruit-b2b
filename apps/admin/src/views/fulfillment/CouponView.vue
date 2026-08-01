<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import { catalogApi, type CategoryNode, type Product } from '@/api/catalog';
import { fulfillmentApi, type Coupon } from '@/api/fulfillment';

const coupons = ref<Coupon[]>([]);
const products = ref<Product[]>([]);
const categories = ref<CategoryNode[]>([]);
const levels = ref<Array<{ id: string; name: string }>>([]);
const customers = ref<Array<{ id: string; customer_name: string }>>([]);
const dialogVisible = ref(false);
const issueVisible = ref(false);
const editingId = ref<string | null>(null);
const issuingCoupon = ref<Coupon | null>(null);
const selectedCustomers = ref<string[]>([]);
const recordsVisible = ref(false);
const usageRecords = ref<Array<Record<string, string>>>([]);
const issuedRecords = ref<Array<Record<string, string>>>([]);
const form = reactive({
  name: '',
  coupon_type: 'ORDER_REDUCTION',
  discount_amount: 50,
  min_amount: 500,
  total_limit: 100 as number | undefined,
  per_customer_limit: 1,
  start_time: new Date(),
  end_time: new Date(Date.now() + 30 * 86400000),
  status: 'ACTIVE',
  product_ids: [] as string[],
  category_ids: [] as string[],
  level_ids: [] as string[],
});

async function load() {
  const [couponRows, productRows, categoryRows, refs] = await Promise.all([
    fulfillmentApi.coupons(),
    catalogApi.listProducts({ page_size: 100 }),
    catalogApi.categoryTree(),
    catalogApi.priceReferences(),
  ]);
  coupons.value = couponRows;
  products.value = productRows.items;
  categories.value = categoryRows.flatMap((item) => item.children);
  customers.value = refs.customers;
  levels.value = refs.levels;
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, {
    name: '',
    coupon_type: 'ORDER_REDUCTION',
    discount_amount: 50,
    min_amount: 500,
    total_limit: 100,
    per_customer_limit: 1,
    start_time: new Date(),
    end_time: new Date(Date.now() + 30 * 86400000),
    status: 'ACTIVE',
    product_ids: [],
    category_ids: [],
    level_ids: [],
  });
  dialogVisible.value = true;
}

function openEdit(row: Coupon) {
  editingId.value = row.id;
  Object.assign(form, {
    ...row,
    start_time: new Date(row.start_time),
    end_time: new Date(row.end_time),
  });
  dialogVisible.value = true;
}

async function save() {
  await fulfillmentApi.saveCoupon(editingId.value, {
    ...form,
    start_time: form.start_time.toISOString(),
    end_time: form.end_time.toISOString(),
    total_limit: form.total_limit || undefined,
  });
  ElMessage.success('优惠券已保存');
  dialogVisible.value = false;
  await load();
}

function openIssue(row: Coupon) {
  issuingCoupon.value = row;
  selectedCustomers.value = [];
  issueVisible.value = true;
}

async function issue() {
  if (!issuingCoupon.value) return;
  await fulfillmentApi.issueCoupon(
    issuingCoupon.value.id,
    selectedCustomers.value,
  );
  ElMessage.success('优惠券已发放');
  issueVisible.value = false;
  await load();
}

async function disable(row: Coupon) {
  await ElMessageBox.confirm('确认停用该优惠券？', '停用优惠券');
  await fulfillmentApi.disableCoupon(row.id);
  await load();
}

async function openRecords(row: Coupon) {
  [usageRecords.value, issuedRecords.value] = await Promise.all([
    fulfillmentApi.couponRecords(row.id),
    fulfillmentApi.issuedCoupons(row.id),
  ]);
  recordsVisible.value = true;
}

onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div><p class="eyebrow">B2B COUPON</p><h1>优惠券管理</h1></div>
      <ElButton type="primary" @click="openCreate">创建优惠券</ElButton>
    </div>
    <div class="management-card">
      <ElTable :data="coupons">
        <ElTableColumn prop="name" label="名称" min-width="160" />
        <ElTableColumn prop="coupon_type" label="类型" width="170" />
        <ElTableColumn label="优惠" width="110">
          <template #default="{ row }">¥{{ row.discount_amount }}</template>
        </ElTableColumn>
        <ElTableColumn label="门槛" width="110">
          <template #default="{ row }">¥{{ row.min_amount }}</template>
        </ElTableColumn>
        <ElTableColumn label="发放/使用" width="120">
          <template #default="{ row }">{{ row.issued_count }}/{{ row.used_count }}</template>
        </ElTableColumn>
        <ElTableColumn prop="status" label="状态" width="100" />
        <ElTableColumn label="操作" width="270">
          <template #default="{ row }">
            <ElButton link @click="openEdit(row)">编辑</ElButton>
            <ElButton link type="primary" @click="openIssue(row)">发放</ElButton>
            <ElButton link @click="openRecords(row)">记录</ElButton>
            <ElButton link type="danger" @click="disable(row)">停用</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <ElDialog v-model="dialogVisible" :title="editingId ? '编辑优惠券' : '创建优惠券'" width="620px">
      <ElForm label-width="110px">
        <ElFormItem label="名称"><ElInput v-model="form.name" /></ElFormItem>
        <ElFormItem label="类型">
          <ElSelect v-model="form.coupon_type" style="width: 100%">
            <ElOption label="订单满减" value="ORDER_REDUCTION" />
            <ElOption label="商品优惠" value="PRODUCT" />
            <ElOption label="品类优惠" value="CATEGORY" />
            <ElOption label="新客户首单" value="NEW_CUSTOMER" />
            <ElOption label="客户专属" value="CUSTOMER_EXCLUSIVE" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem v-if="form.coupon_type === 'PRODUCT'" label="适用商品">
          <ElSelect v-model="form.product_ids" multiple filterable style="width: 100%">
            <ElOption v-for="item in products" :key="item.id" :label="item.name" :value="item.id" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem v-if="form.coupon_type === 'CATEGORY'" label="适用品类">
          <ElSelect v-model="form.category_ids" multiple filterable style="width: 100%">
            <ElOption v-for="item in categories" :key="item.id" :label="item.name" :value="item.id" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="适用等级">
          <ElSelect v-model="form.level_ids" multiple clearable style="width: 100%" placeholder="不选表示全部等级">
            <ElOption v-for="item in levels" :key="item.id" :label="item.name" :value="item.id" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="优惠金额"><ElInputNumber v-model="form.discount_amount" :min="0.01" :precision="2" /></ElFormItem>
        <ElFormItem label="最低金额"><ElInputNumber v-model="form.min_amount" :min="0" :precision="2" /></ElFormItem>
        <ElFormItem label="发放总量"><ElInputNumber v-model="form.total_limit" :min="1" /></ElFormItem>
        <ElFormItem label="每客限领"><ElInputNumber v-model="form.per_customer_limit" :min="1" /></ElFormItem>
        <ElFormItem label="有效期">
          <ElDatePicker v-model="form.start_time" type="datetime" />
          <span style="margin: 0 8px">至</span>
          <ElDatePicker v-model="form.end_time" type="datetime" />
        </ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="dialogVisible = false">取消</ElButton><ElButton type="primary" @click="save">保存</ElButton></template>
    </ElDialog>

    <ElDialog v-model="issueVisible" title="发放优惠券" width="520px">
      <ElSelect v-model="selectedCustomers" multiple filterable style="width: 100%" placeholder="选择客户">
        <ElOption v-for="item in customers" :key="item.id" :label="item.customer_name" :value="item.id" />
      </ElSelect>
      <template #footer><ElButton @click="issueVisible = false">取消</ElButton><ElButton type="primary" :disabled="!selectedCustomers.length" @click="issue">确认发放</ElButton></template>
    </ElDialog>

    <ElDialog v-model="recordsVisible" title="优惠券发放与使用记录" width="780px">
      <h3>客户优惠券</h3>
      <ElTable :data="issuedRecords" max-height="220">
        <ElTableColumn prop="customer_name" label="客户" />
        <ElTableColumn prop="status" label="状态" width="120" />
        <ElTableColumn prop="receive_time" label="领取时间" width="190" />
      </ElTable>
      <h3 style="margin-top: 22px">订单使用记录</h3>
      <ElTable :data="usageRecords" max-height="220">
        <ElTableColumn prop="order_id" label="订单ID" width="100" />
        <ElTableColumn prop="status" label="状态" width="120" />
        <ElTableColumn prop="eligible_amount" label="优惠范围金额" width="130" />
        <ElTableColumn prop="discount_amount" label="优惠金额" width="110" />
        <ElTableColumn prop="reason" label="说明" min-width="180" />
      </ElTable>
    </ElDialog>
  </section>
</template>
