<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import {
  catalogApi,
  type CategoryNode,
} from '@/api/catalog';

const loading = ref(false);
const dialogVisible = ref(false);
const editingId = ref<string | null>(null);
const categories = ref<CategoryNode[]>([]);
const form = reactive({
  parent_id: '',
  name: '',
  image: '',
  sort: 0,
  status: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    categories.value = await catalogApi.categoryTree();
  } finally {
    loading.value = false;
  }
}

function openCreate(parentId = ''): void {
  editingId.value = null;
  Object.assign(form, {
    parent_id: parentId,
    name: '',
    image: '',
    sort: 0,
    status: 'ACTIVE',
  });
  dialogVisible.value = true;
}

function openEdit(row: CategoryNode): void {
  editingId.value = row.id;
  Object.assign(form, {
    parent_id: row.parent_id ?? '',
    name: row.name,
    image: row.image ?? '',
    sort: row.sort,
    status: row.status,
  });
  dialogVisible.value = true;
}

async function save(): Promise<void> {
  await catalogApi.saveCategory(editingId.value, {
    parent_id: form.parent_id || undefined,
    name: form.name,
    image: form.image || undefined,
    sort: form.sort,
    status: form.status,
  });
  ElMessage.success('分类已保存');
  dialogVisible.value = false;
  await load();
}

async function remove(row: CategoryNode): Promise<void> {
  await ElMessageBox.confirm(`确认删除分类“${row.name}”？`, '删除分类', {
    type: 'warning',
  });
  await catalogApi.deleteCategory(row.id);
  ElMessage.success('分类已删除');
  await load();
}

onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">CATALOG</p>
        <h1>分类管理</h1>
      </div>
      <ElButton
        v-permission="'product.write'"
        type="primary"
        @click="openCreate()"
      >
        新建一级分类
      </ElButton>
    </div>

    <div class="management-card">
      <ElTable
        v-loading="loading"
        :data="categories"
        row-key="id"
        default-expand-all
      >
        <ElTableColumn prop="name" label="分类名称" min-width="220" />
        <ElTableColumn prop="sort" label="排序" width="90" />
        <ElTableColumn label="层级" width="100">
          <template #default="{ row }">
            {{ row.parent_id ? '二级' : '一级' }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.status === 'ACTIVE' ? 'success' : 'info'">
              {{ row.status === 'ACTIVE' ? '启用' : '停用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="250">
          <template #default="{ row }">
            <ElButton
              v-if="!row.parent_id"
              v-permission="'product.write'"
              link
              type="primary"
              @click="openCreate(row.id)"
            >
              添加二级
            </ElButton>
            <ElButton
              v-permission="'product.write'"
              link
              @click="openEdit(row)"
            >
              编辑
            </ElButton>
            <ElButton
              v-permission="'product.write'"
              link
              type="danger"
              @click="remove(row)"
            >
              删除
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <ElDialog
      v-model="dialogVisible"
      :title="editingId ? '编辑分类' : '新建分类'"
      width="520"
    >
      <ElForm label-width="90px">
        <ElFormItem label="上级分类">
          <ElSelect v-model="form.parent_id" clearable placeholder="一级分类">
            <ElOption
              v-for="item in categories"
              :key="item.id"
              :label="item.name"
              :value="item.id"
              :disabled="item.id === editingId"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="分类名称">
          <ElInput v-model="form.name" maxlength="100" />
        </ElFormItem>
        <ElFormItem label="图片URL">
          <ElInput v-model="form.image" />
        </ElFormItem>
        <ElFormItem label="排序">
          <ElInputNumber v-model="form.sort" :min="-9999" :max="9999" />
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
        <ElButton type="primary" :disabled="!form.name.trim()" @click="save">
          保存
        </ElButton>
      </template>
    </ElDialog>
  </section>
</template>
