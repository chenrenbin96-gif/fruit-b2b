<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

import { catalogApi, type CategoryNode, type Product } from '@/api/catalog';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const products = ref<Product[]>([]);
const categories = ref<CategoryNode[]>([]);
const selected = ref<Product[]>([]);
const createDialog = ref(false);
const filters = reactive({
  keyword: '',
  category_id: '',
  status: '',
  sale_type: '',
  inventory_status: '',
});
const form = reactive({
  category_id: '',
  product_code: '',
  barcode: '',
  name: '',
  origin: '',
  brand: '',
  grade: '' as '' | 'A' | 'B' | 'C' | '特级',
  description: '',
});
const leafCategories = computed(() =>
  categories.value.flatMap((parent) =>
    parent.children.map((child) => ({
      value: child.id,
      label: `${parent.name} / ${child.name}`,
    })),
  ),
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [tree, result] = await Promise.all([
      catalogApi.categoryTree(),
      catalogApi.listProducts({
        keyword: filters.keyword || undefined,
        category_id: filters.category_id || undefined,
        status: filters.status || undefined,
        sale_type: filters.sale_type || undefined,
        inventory_status: filters.inventory_status || undefined,
        page_size: 100,
      }),
    ]);
    categories.value = tree;
    products.value = result.items;
  } finally {
    loading.value = false;
  }
}

function reset(): void {
  Object.assign(filters, {
    keyword: '',
    category_id: '',
    status: '',
    sale_type: '',
    inventory_status: '',
  });
  void load();
}

function openCreate(): void {
  Object.assign(form, {
    category_id: '',
    product_code: '',
    barcode: '',
    name: '',
    origin: '',
    brand: '',
    grade: '',
    description: '',
  });
  createDialog.value = true;
}

async function create(): Promise<void> {
  await catalogApi.saveProduct(null, {
    ...form,
    barcode: form.barcode || undefined,
    origin: form.origin || undefined,
    brand: form.brand || undefined,
    grade: form.grade || undefined,
    description: form.description || undefined,
    status: 'DRAFT',
  });
  createDialog.value = false;
  ElMessage.success('商品已创建，请进入工作台配置SKU和媒体');
  await load();
}

async function toggleStatus(row: Product): Promise<void> {
  await catalogApi.setProductStatus(
    row.id,
    row.status === 'ON_SALE' ? 'OFF_SALE' : 'ON_SALE',
  );
  await load();
}

async function duplicate(row: Product): Promise<void> {
  const result = await catalogApi.duplicateProduct(row.id);
  ElMessage.success('已复制为草稿');
  await router.push(`/products/${result.id}`);
}

async function remove(row: Product): Promise<void> {
  await ElMessageBox.confirm(
    '仅无库存、无锁定库存的商品可以删除。确认继续？',
    '删除商品',
    { type: 'warning' },
  );
  await catalogApi.deleteProduct(row.id);
  ElMessage.success('商品已删除');
  await load();
}

async function batch(action: 'ON_SALE' | 'OFF_SALE' | 'DELETE'): Promise<void> {
  if (!selected.value.length) {
    ElMessage.warning('请先选择商品');
    return;
  }
  if (action === 'DELETE') {
    await ElMessageBox.confirm('确认批量删除选中商品？', '批量删除', {
      type: 'warning',
    });
  }
  await catalogApi.batchProducts(action, selected.value.map((item) => item.id));
  ElMessage.success('批量操作完成');
  await load();
}

onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">PRODUCT CENTER</p>
        <h1>商品中心</h1>
        <p>商品、SKU、媒体、价格、库存、采购信息统一维护</p>
      </div>
      <ElButton
        v-if="auth.hasPermission('product.write')"
        type="primary"
        @click="openCreate"
      >
        新建商品
      </ElButton>
    </div>

    <div class="management-card filter-card">
      <ElInput
        v-model="filters.keyword"
        clearable
        placeholder="商品名称 / 编码 / 条码"
        style="width:240px"
        @keyup.enter="load"
      />
      <ElSelect v-model="filters.category_id" clearable filterable placeholder="分类" style="width:190px">
        <ElOption v-for="item in leafCategories" :key="item.value" :label="item.label" :value="item.value" />
      </ElSelect>
      <ElSelect v-model="filters.status" clearable placeholder="销售状态" style="width:130px">
        <ElOption label="草稿" value="DRAFT" /><ElOption label="销售中" value="ON_SALE" /><ElOption label="已下架" value="OFF_SALE" />
      </ElSelect>
      <ElSelect v-model="filters.sale_type" clearable placeholder="采购类型" style="width:140px">
        <ElOption label="按件" value="PIECE" /><ElOption label="固定重量" value="WEIGHT" />
      </ElSelect>
      <ElSelect v-model="filters.inventory_status" clearable placeholder="库存状态" style="width:140px">
        <ElOption label="库存正常" value="AVAILABLE" /><ElOption label="低库存" value="LOW" /><ElOption label="缺货" value="OUT" />
      </ElSelect>
      <ElButton type="primary" @click="load">查询</ElButton>
      <ElButton @click="reset">重置</ElButton>
    </div>

    <div v-if="auth.hasPermission('product.manage')" class="toolbar-group batch-toolbar">
      <ElButton @click="batch('ON_SALE')">批量上架</ElButton>
      <ElButton @click="batch('OFF_SALE')">批量下架</ElButton>
      <ElButton type="danger" plain @click="batch('DELETE')">批量删除</ElButton>
    </div>

    <div class="management-card">
      <ElTable
        v-loading="loading"
        :data="products"
        @selection-change="selected = $event"
      >
        <ElTableColumn v-if="auth.hasPermission('product.manage')" type="selection" width="46" />
        <ElTableColumn label="商品" min-width="240">
          <template #default="{row}">
            <div class="product-cell">
              <img :src="row.main_image || row.media?.find((item: any) => item.media_type === 'IMAGE')?.url || 'https://dummyimage.com/80x80/edf2f7/64748b&text=Fruit'" alt="" />
              <div><strong>{{ row.name }}</strong><small>{{ row.product_code }}<template v-if="row.barcode"> · {{ row.barcode }}</template></small></div>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="分类" width="130"><template #default="{row}">{{ row.category?.name ?? '—' }}</template></ElTableColumn>
        <ElTableColumn label="单位" width="100"><template #default="{row}">{{ row.units?.join('/') || '—' }}</template></ElTableColumn>
        <ElTableColumn label="市场价" width="110"><template #default="{row}">{{ row.market_price ? `¥${row.market_price}` : '—' }}</template></ElTableColumn>
        <ElTableColumn label="状态" width="100"><template #default="{row}"><ElTag :type="row.status === 'ON_SALE' ? 'success' : 'info'">{{ row.status === 'ON_SALE' ? '销售中' : row.status === 'DRAFT' ? '草稿' : '已下架' }}</ElTag></template></ElTableColumn>
        <ElTableColumn prop="brand" label="品牌" width="120" />
        <ElTableColumn prop="origin" label="产地" width="120" />
        <ElTableColumn label="最近采购价" width="120"><template #default="{row}">{{ row.recent_purchase_price ? `¥${row.recent_purchase_price}` : '—' }}</template></ElTableColumn>
        <ElTableColumn label="更新时间" width="180"><template #default="{row}">{{ row.updated_at ? new Date(row.updated_at).toLocaleString() : '—' }}</template></ElTableColumn>
        <ElTableColumn label="操作" fixed="right" width="250">
          <template #default="{row}">
            <ElButton link type="primary" @click="router.push(`/products/${row.id}`)">编辑</ElButton>
            <ElButton v-if="auth.hasPermission('product.write')" link @click="toggleStatus(row)">{{ row.status === 'ON_SALE' ? '下架' : '上架' }}</ElButton>
            <ElButton v-if="auth.hasPermission('product.manage')" link @click="duplicate(row)">复制</ElButton>
            <ElButton v-if="auth.hasPermission('product.manage')" link type="danger" @click="remove(row)">删除</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <ElDialog v-model="createDialog" title="新建商品" width="660">
      <ElForm label-width="100px">
        <div class="form-grid">
          <ElFormItem label="商品编码"><ElInput v-model="form.product_code" /></ElFormItem>
          <ElFormItem label="商品条码"><ElInput v-model="form.barcode" /></ElFormItem>
          <ElFormItem label="商品名称"><ElInput v-model="form.name" /></ElFormItem>
          <ElFormItem label="商品分类"><ElSelect v-model="form.category_id" filterable style="width:100%"><ElOption v-for="item in leafCategories" :key="item.value" :label="item.label" :value="item.value" /></ElSelect></ElFormItem>
          <ElFormItem label="商品等级"><ElSelect v-model="form.grade" clearable style="width:100%"><ElOption v-for="grade in ['A','B','C','特级']" :key="grade" :label="grade" :value="grade" /></ElSelect></ElFormItem>
          <ElFormItem label="产地"><ElInput v-model="form.origin" /></ElFormItem>
          <ElFormItem label="品牌"><ElInput v-model="form.brand" /></ElFormItem>
        </div>
        <ElFormItem label="商品描述"><ElInput v-model="form.description" type="textarea" :rows="4" /></ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="createDialog=false">取消</ElButton><ElButton type="primary" :disabled="!form.category_id || !form.product_code || !form.name" @click="create">创建并进入工作台</ElButton></template>
    </ElDialog>
  </section>
</template>

<style scoped>
.filter-card,.toolbar-group { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.filter-card { margin-bottom:14px; }
.batch-toolbar { margin-bottom:14px; }
.product-cell { display:flex; align-items:center; gap:12px; }
.product-cell img { width:52px; height:52px; border-radius:8px; object-fit:cover; background:#f1f5f9; }
.product-cell div { display:flex; flex-direction:column; gap:5px; }
.product-cell small { color:#64748b; }
.form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 18px; }
@media (max-width:900px) { .form-grid { grid-template-columns:1fr; } }
</style>
