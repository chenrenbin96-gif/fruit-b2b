<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import {
  catalogApi,
  type HomeBanner,
  type HomeCategory,
  type HomeProduct,
} from '@/api/catalog';

type CategoryOption = {
  id: string;
  name: string;
  parent_name: string;
  image: string | null;
};

const loading = ref(false);
const banners = ref<HomeBanner[]>([]);
const categories = ref<HomeCategory[]>([]);
const homeProducts = ref<HomeProduct[]>([]);
const products = ref<Array<{ id: string; name: string; origin: string | null }>>([]);
const categoryOptions = ref<CategoryOption[]>([]);
const bannerDialog = ref(false);
const categoryDialog = ref(false);
const productDialog = ref(false);
const editingBannerId = ref<string | null>(null);
const editingCategoryId = ref<string | null>(null);
const editingProductId = ref<string | null>(null);

const bannerForm = reactive({
  title: '',
  subtitle: '',
  image_url: '',
  banner_type: 'MARKET' as HomeBanner['banner_type'],
  link_type: 'NONE' as HomeBanner['link_type'],
  link_id: '',
  sort: 0,
  status: 'ACTIVE' as HomeBanner['status'],
  start_time: '',
  end_time: '',
});
const categoryForm = reactive({
  category_id: '',
  image_url: '',
  title: '',
  sort: 0,
  status: 'ACTIVE' as HomeCategory['status'],
});
const productForm = reactive({
  product_id: '',
  position: 'HOT' as HomeProduct['position'],
  sort: 0,
  status: 'ACTIVE' as HomeProduct['status'],
});
const positionNames: Record<HomeProduct['position'], string> = {
  HOT: '爆款',
  NEW: '新品',
  RECOMMEND: '推荐',
};

async function load(): Promise<void> {
  loading.value = true;
  try {
    const result = await catalogApi.homeOperations();
    banners.value = result.banners;
    categories.value = result.categories;
    homeProducts.value = result.home_products;
    products.value = result.products;
    categoryOptions.value = result.category_options;
  } finally {
    loading.value = false;
  }
}

function editBanner(row?: HomeBanner): void {
  editingBannerId.value = row?.id ?? null;
  Object.assign(bannerForm, {
    title: row?.title ?? '',
    subtitle: row?.subtitle ?? '',
    image_url: row?.image_url ?? '',
    banner_type: row?.banner_type ?? 'MARKET',
    link_type: row?.link_type === 'URL' ? 'NONE' : row?.link_type ?? 'NONE',
    link_id: row?.link_id ?? '',
    sort: row?.sort ?? 0,
    status: row?.status ?? 'ACTIVE',
    start_time: row?.start_time ?? '',
    end_time: row?.end_time ?? '',
  });
  bannerDialog.value = true;
}

function editCategory(row?: HomeCategory): void {
  editingCategoryId.value = row?.id ?? null;
  Object.assign(categoryForm, {
    category_id: row?.category_id ?? '',
    image_url: row?.image_url ?? '',
    title: row?.title ?? '',
    sort: row?.sort ?? 0,
    status: row?.status ?? 'ACTIVE',
  });
  categoryDialog.value = true;
}

function editProduct(row?: HomeProduct): void {
  editingProductId.value = row?.id ?? null;
  Object.assign(productForm, {
    product_id: row?.product_id ?? '',
    position: row?.position ?? 'HOT',
    sort: row?.sort ?? 0,
    status: row?.status ?? 'ACTIVE',
  });
  productDialog.value = true;
}

function selectCategory(id: string): void {
  const option = categoryOptions.value.find((item) => item.id === id);
  if (option && !editingCategoryId.value) {
    categoryForm.title = option.name;
    categoryForm.image_url = option.image ?? '';
  }
}

async function saveBanner(): Promise<void> {
  await catalogApi.saveHomeBanner(editingBannerId.value, {
    ...bannerForm,
    subtitle: bannerForm.subtitle || undefined,
    image_url: bannerForm.image_url || undefined,
    link_id: bannerForm.link_type === 'NONE' ? undefined : bannerForm.link_id,
    start_time: bannerForm.start_time || undefined,
    end_time: bannerForm.end_time || undefined,
  });
  ElMessage.success('Banner已保存，小程序缓存已刷新');
  bannerDialog.value = false;
  await load();
}

async function saveCategory(): Promise<void> {
  await catalogApi.saveHomeCategory(editingCategoryId.value, {
    ...categoryForm,
    image_url: categoryForm.image_url || undefined,
  });
  ElMessage.success('分类入口已保存');
  categoryDialog.value = false;
  await load();
}

async function saveProduct(): Promise<void> {
  await catalogApi.saveHomeProduct(editingProductId.value, productForm);
  ElMessage.success('商品运营位已保存');
  productDialog.value = false;
  await load();
}

async function remove(type: 'banner' | 'category' | 'product', id: string): Promise<void> {
  await ElMessageBox.confirm('确认删除该首页配置？', '删除确认', { type: 'warning' });
  if (type === 'banner') await catalogApi.deleteHomeBanner(id);
  if (type === 'category') await catalogApi.deleteHomeCategory(id);
  if (type === 'product') await catalogApi.deleteHomeProduct(id);
  ElMessage.success('已删除');
  await load();
}

onMounted(load);
</script>

<template>
  <section v-loading="loading">
    <div class="page-heading">
      <div>
        <p class="eyebrow">HOME OPERATIONS</p>
        <h1>首页管理</h1>
      </div>
      <span class="muted">配置沉浸式Banner、分类快捷入口与商品运营位</span>
    </div>

    <ElTabs>
      <ElTabPane label="Banner管理">
        <div class="management-card">
          <div class="toolbar">
            <strong>首页轮播</strong>
            <ElButton v-permission="'product.write'" type="primary" @click="editBanner()">新增Banner</ElButton>
          </div>
          <ElTable :data="banners">
            <ElTableColumn label="图片" width="130">
              <template #default="{ row }">
                <ElImage v-if="row.image_url" :src="row.image_url" fit="cover" class="banner-thumb" />
                <span v-else class="muted">未配置</span>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="title" label="标题" min-width="180" />
            <ElTableColumn prop="link_type" label="跳转" width="100" />
            <ElTableColumn prop="sort" label="排序" width="80" />
            <ElTableColumn label="投放时间" min-width="220">
              <template #default="{ row }">{{ row.start_time || '立即' }} ～ {{ row.end_time || '长期' }}</template>
            </ElTableColumn>
            <ElTableColumn label="状态" width="90">
              <template #default="{ row }"><ElTag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status }}</ElTag></template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="150">
              <template #default="{ row }">
                <ElButton link @click="editBanner(row)">编辑</ElButton>
                <ElButton link type="danger" @click="remove('banner', row.id)">删除</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </div>
      </ElTabPane>

      <ElTabPane label="首页分类入口">
        <div class="management-card">
          <div class="toolbar">
            <strong>二级分类快捷入口（最多展示10个）</strong>
            <ElButton v-permission="'product.write'" type="primary" @click="editCategory()">添加分类</ElButton>
          </div>
          <ElTable :data="categories">
            <ElTableColumn prop="parent_name" label="一级分类" width="130" />
            <ElTableColumn prop="category_name" label="二级分类" width="150" />
            <ElTableColumn prop="title" label="首页标题" min-width="150" />
            <ElTableColumn prop="sort" label="排序" width="80" />
            <ElTableColumn prop="status" label="状态" width="100" />
            <ElTableColumn label="操作" width="150">
              <template #default="{ row }">
                <ElButton link @click="editCategory(row)">编辑</ElButton>
                <ElButton link type="danger" @click="remove('category', row.id)">删除</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </div>
      </ElTabPane>

      <ElTabPane label="商品推荐管理">
        <div class="management-card">
          <div class="toolbar">
            <strong>爆款 / 新品 / 推荐</strong>
            <ElButton v-permission="'product.write'" type="primary" @click="editProduct()">添加商品</ElButton>
          </div>
          <ElTable :data="homeProducts">
            <ElTableColumn prop="product_name" label="商品" min-width="220" />
            <ElTableColumn label="运营位" width="120">
              <template #default="{ row }">{{ positionNames[row.position as HomeProduct['position']] }}</template>
            </ElTableColumn>
            <ElTableColumn prop="sort" label="排序" width="80" />
            <ElTableColumn prop="status" label="状态" width="100" />
            <ElTableColumn label="操作" width="150">
              <template #default="{ row }">
                <ElButton link @click="editProduct(row)">编辑</ElButton>
                <ElButton link type="danger" @click="remove('product', row.id)">删除</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </div>
      </ElTabPane>
    </ElTabs>

    <ElDialog v-model="bannerDialog" :title="editingBannerId ? '编辑Banner' : '新增Banner'" width="680">
      <ElForm label-width="100px">
        <ElFormItem label="标题"><ElInput v-model="bannerForm.title" /></ElFormItem>
        <ElFormItem label="副标题"><ElInput v-model="bannerForm.subtitle" /></ElFormItem>
        <ElFormItem label="图片地址"><ElInput v-model="bannerForm.image_url" placeholder="对象存储图片URL" /></ElFormItem>
        <ElFormItem v-if="bannerForm.image_url" label="图片预览"><ElImage :src="bannerForm.image_url" fit="cover" class="banner-preview" /></ElFormItem>
        <ElFormItem label="内容类型">
          <ElSelect v-model="bannerForm.banner_type">
            <ElOption label="批发活动" value="ACTIVITY" /><ElOption label="今日行情" value="MARKET" /><ElOption label="新品水果" value="NEW_ARRIVAL" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="跳转类型">
          <ElRadioGroup v-model="bannerForm.link_type"><ElRadioButton value="NONE">无</ElRadioButton><ElRadioButton value="PRODUCT">商品</ElRadioButton><ElRadioButton value="CATEGORY">分类</ElRadioButton></ElRadioGroup>
        </ElFormItem>
        <ElFormItem v-if="bannerForm.link_type === 'PRODUCT'" label="跳转商品">
          <ElSelect v-model="bannerForm.link_id" filterable style="width:100%"><ElOption v-for="item in products" :key="item.id" :label="item.name" :value="item.id" /></ElSelect>
        </ElFormItem>
        <ElFormItem v-if="bannerForm.link_type === 'CATEGORY'" label="跳转分类">
          <ElSelect v-model="bannerForm.link_id" filterable style="width:100%"><ElOption v-for="item in categoryOptions" :key="item.id" :label="`${item.parent_name} > ${item.name}`" :value="item.id" /></ElSelect>
        </ElFormItem>
        <ElFormItem label="投放时间">
          <ElDatePicker v-model="bannerForm.start_time" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss.SSSZ" placeholder="开始时间" />
          <span class="range-separator">至</span>
          <ElDatePicker v-model="bannerForm.end_time" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss.SSSZ" placeholder="结束时间" />
        </ElFormItem>
        <ElFormItem label="排序"><ElInputNumber v-model="bannerForm.sort" /></ElFormItem>
        <ElFormItem label="启用"><ElSwitch v-model="bannerForm.status" active-value="ACTIVE" inactive-value="DISABLED" /></ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="bannerDialog=false">取消</ElButton><ElButton type="primary" :disabled="!bannerForm.title || !bannerForm.image_url" @click="saveBanner">保存</ElButton></template>
    </ElDialog>

    <ElDialog v-model="categoryDialog" :title="editingCategoryId ? '编辑分类入口' : '添加分类入口'" width="540">
      <ElForm label-width="100px">
        <ElFormItem label="二级分类"><ElSelect v-model="categoryForm.category_id" filterable style="width:100%" @change="selectCategory"><ElOption v-for="item in categoryOptions" :key="item.id" :label="`${item.parent_name} > ${item.name}`" :value="item.id" /></ElSelect></ElFormItem>
        <ElFormItem label="显示标题"><ElInput v-model="categoryForm.title" /></ElFormItem>
        <ElFormItem label="图片地址"><ElInput v-model="categoryForm.image_url" /></ElFormItem>
        <ElFormItem label="排序"><ElInputNumber v-model="categoryForm.sort" /></ElFormItem>
        <ElFormItem label="启用"><ElSwitch v-model="categoryForm.status" active-value="ACTIVE" inactive-value="DISABLED" /></ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="categoryDialog=false">取消</ElButton><ElButton type="primary" :disabled="!categoryForm.category_id || !categoryForm.title" @click="saveCategory">保存</ElButton></template>
    </ElDialog>

    <ElDialog v-model="productDialog" :title="editingProductId ? '编辑商品运营位' : '添加商品运营位'" width="520">
      <ElForm label-width="90px">
        <ElFormItem label="商品"><ElSelect v-model="productForm.product_id" filterable style="width:100%"><ElOption v-for="item in products" :key="item.id" :label="`${item.name}${item.origin ? ` · ${item.origin}` : ''}`" :value="item.id" /></ElSelect></ElFormItem>
        <ElFormItem label="运营位"><ElSelect v-model="productForm.position"><ElOption v-for="(label,value) in positionNames" :key="value" :label="label" :value="value" /></ElSelect></ElFormItem>
        <ElFormItem label="排序"><ElInputNumber v-model="productForm.sort" /></ElFormItem>
        <ElFormItem label="启用"><ElSwitch v-model="productForm.status" active-value="ACTIVE" inactive-value="DISABLED" /></ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="productDialog=false">取消</ElButton><ElButton type="primary" :disabled="!productForm.product_id" @click="saveProduct">保存</ElButton></template>
    </ElDialog>
  </section>
</template>

<style scoped>
.banner-thumb { width: 96px; height: 54px; border-radius: 8px; }
.banner-preview { width: 420px; height: 150px; border-radius: 10px; }
.range-separator { margin: 0 10px; color: #8b9490; }
</style>
