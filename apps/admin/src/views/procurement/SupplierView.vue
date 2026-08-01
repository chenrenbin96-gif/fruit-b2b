<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';

import {
  procurementApi,
  type Supplier,
} from '@/api/procurement';

const loading = ref(false);
const dialogVisible = ref(false);
const rows = ref<Supplier[]>([]);
const keyword = ref('');
const editingId = ref<string | null>(null);
const form = reactive({
  supplier_name: '',
  contact_name: '',
  phone: '',
  address: '',
  category_text: '',
  remark: '',
  status: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    rows.value = await procurementApi.suppliers({
      keyword: keyword.value || undefined,
    });
  } finally {
    loading.value = false;
  }
}

function open(row?: Supplier): void {
  editingId.value = row?.id ?? null;
  Object.assign(form, {
    supplier_name: row?.supplier_name ?? '',
    contact_name: row?.contact_name ?? '',
    phone: row?.phone ?? '',
    address: row?.address ?? '',
    category_text: row?.supply_categories.join('、') ?? '',
    remark: row?.remark ?? '',
    status: row?.status ?? 'ACTIVE',
  });
  dialogVisible.value = true;
}

async function save(): Promise<void> {
  await procurementApi.saveSupplier(editingId.value, {
    supplier_name: form.supplier_name,
    contact_name: form.contact_name,
    phone: form.phone,
    address: form.address,
    supply_categories: form.category_text
      .split(/[、,，]/)
      .map((item) => item.trim())
      .filter(Boolean),
    remark: form.remark || undefined,
    status: form.status,
  });
  ElMessage.success(editingId.value ? '供应商已更新' : '供应商已创建');
  dialogVisible.value = false;
  await load();
}

onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">SUPPLIERS</p>
        <h1>供应商管理</h1>
      </div>
      <ElButton type="primary" @click="open()">新增供应商</ElButton>
    </div>
    <div class="management-card">
      <div style="display:flex; gap:12px; margin-bottom:18px">
        <ElInput
          v-model="keyword"
          clearable
          placeholder="供应商、联系人或电话"
          style="width: 320px"
          @keyup.enter="load"
        />
        <ElButton @click="load">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows">
        <ElTableColumn prop="supplier_no" label="供应商编号" width="180" />
        <ElTableColumn prop="supplier_name" label="供应商名称" min-width="160" />
        <ElTableColumn prop="contact_name" label="联系人" width="110" />
        <ElTableColumn prop="phone" label="电话" width="140" />
        <ElTableColumn prop="address" label="地址" min-width="180" />
        <ElTableColumn label="供应品类" min-width="150">
          <template #default="{ row }">
            {{ row.supply_categories.join("、") || "—" }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="90">
          <template #default="{ row }">
            <ElTag :type="row.status === 'ACTIVE' ? 'success' : 'info'">
              {{ row.status === "ACTIVE" ? "启用" : "停用" }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="90">
          <template #default="{ row }">
            <ElButton link type="primary" @click="open(row)">编辑</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <ElDialog
      v-model="dialogVisible"
      :title="editingId ? '编辑供应商' : '新增供应商'"
      width="620"
    >
      <ElForm label-width="100px">
        <ElFormItem label="供应商名称"><ElInput v-model="form.supplier_name" /></ElFormItem>
        <ElFormItem label="联系人"><ElInput v-model="form.contact_name" /></ElFormItem>
        <ElFormItem label="电话"><ElInput v-model="form.phone" /></ElFormItem>
        <ElFormItem label="地址"><ElInput v-model="form.address" /></ElFormItem>
        <ElFormItem label="供应品类">
          <ElInput v-model="form.category_text" placeholder="苹果、葡萄、榴莲" />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="form.remark" type="textarea" :rows="3" />
        </ElFormItem>
        <ElFormItem label="状态">
          <ElRadioGroup v-model="form.status">
            <ElRadio value="ACTIVE">启用</ElRadio>
            <ElRadio value="DISABLED">停用</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :disabled="
            !form.supplier_name || !form.contact_name || !form.phone || !form.address
          "
          @click="save"
        >
          保存
        </ElButton>
      </template>
    </ElDialog>
  </section>
</template>
