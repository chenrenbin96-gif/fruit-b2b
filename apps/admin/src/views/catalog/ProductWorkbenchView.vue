<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';

import {
  catalogApi,
  type CategoryNode,
  type ProductDescription,
  type ProductMedia,
  type ProductWorkbench,
  type Sku,
} from '@/api/catalog';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const productId = String(route.params.id);
const loading = ref(false);
const saving = ref(false);
const activeTab = ref('basic');
const workbench = ref<ProductWorkbench | null>(null);
const categories = ref<CategoryNode[]>([]);
const priceReferences = ref<Awaited<ReturnType<typeof catalogApi.priceReferences>> | null>(null);
const skuDialog = ref(false);
const editingSkuId = ref<string | null>(null);
const priceDialog = ref(false);
const priceType = ref<'levels' | 'customers' | 'quantities'>('quantities');
const descriptionText = ref('');
const draggingMediaId = ref<string | null>(null);

const form = reactive({
  category_id: '',
  product_code: '',
  barcode: '',
  name: '',
  main_image: '',
  origin: '',
  brand: '',
  grade: '' as '' | 'A' | 'B' | 'C' | '特级',
  description: '',
  status: 'DRAFT' as 'DRAFT' | 'ON_SALE' | 'OFF_SALE',
});
const skuForm = reactive({
  sku_code: '',
  sku_name: '',
  specification: '',
  sale_type: 'PIECE' as 'PIECE' | 'WEIGHT',
  unit: '箱',
  weight_unit: '斤',
  standard_weight: 20,
  gross_weight_unit_price: 0,
  net_weight_unit_price: 0,
  delivery_weight_per_piece: 10,
  delivery_weight_unit: '斤' as '斤' | '公斤',
  cost_price: 0,
  base_price: 0,
  market_price: 0,
  stock_warning: 0,
  status: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
});
const priceForm = reactive({
  sku_id: '',
  level_id: '',
  customer_id: '',
  min_quantity: 1,
  max_quantity: undefined as number | undefined,
  price: 0,
});

const product = computed(() => workbench.value?.product);
const skus = computed(() => product.value?.skus ?? []);
const media = computed(() => product.value?.media ?? []);
const descriptions = computed(() => product.value?.descriptions ?? []);
const leafCategories = computed(() =>
  categories.value.flatMap((parent) =>
    parent.children.map((child) => ({
      value: child.id,
      label: `${parent.name} / ${child.name}`,
    })),
  ),
);
const canFullEdit = computed(() => auth.hasPermission('product.write'));
const canDisplayEdit = computed(
  () => canFullEdit.value || auth.hasPermission('product.display.write'),
);
const canSkuEdit = computed(() => auth.hasPermission('product.sku.write'));
const canMediaEdit = computed(() => auth.hasPermission('product.media.manage'));
const canPriceEdit = computed(() => auth.hasPermission('price.write'));
const canProcurementEdit = computed(
  () => auth.hasPermission('product.procurement.write'),
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const requests: [
      Promise<ProductWorkbench>,
      Promise<CategoryNode[]>,
      Promise<Awaited<ReturnType<typeof catalogApi.priceReferences>> | null>,
    ] = [
      catalogApi.productWorkbench(productId),
      catalogApi.categoryTree(),
      auth.hasPermission('price.read')
        ? catalogApi.priceReferences()
        : Promise.resolve(null),
    ];
    const [data, tree, refs] = await Promise.all(requests);
    workbench.value = data;
    categories.value = tree;
    priceReferences.value = refs;
    Object.assign(form, {
      category_id: data.product.category_id,
      product_code: data.product.product_code,
      barcode: data.product.barcode ?? '',
      name: data.product.name,
      main_image: data.product.main_image ?? '',
      origin: data.product.origin ?? '',
      brand: data.product.brand ?? '',
      grade: data.product.grade ?? '',
      description: data.product.description ?? '',
      status: data.product.status,
    });
  } finally {
    loading.value = false;
  }
}

async function saveBasic(): Promise<void> {
  if (!canDisplayEdit.value) return;
  saving.value = true;
  try {
    const display = {
      name: form.name,
      main_image: form.main_image || undefined,
      origin: form.origin || undefined,
      brand: form.brand || undefined,
      grade: form.grade || undefined,
      description: form.description || undefined,
    };
    if (canFullEdit.value) {
      await catalogApi.saveProduct(productId, {
        ...display,
        category_id: form.category_id,
        product_code: form.product_code,
        barcode: form.barcode || undefined,
        status: form.status,
      });
    } else {
      await catalogApi.saveProductDisplay(productId, display);
    }
    ElMessage.success('商品信息已保存');
    await load();
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(): Promise<void> {
  if (!product.value) return;
  const next = product.value.status === 'ON_SALE' ? 'OFF_SALE' : 'ON_SALE';
  await catalogApi.setProductStatus(productId, next);
  ElMessage.success(next === 'ON_SALE' ? '商品已上架' : '商品已下架');
  await load();
}

async function uploadFiles(event: Event, type: 'IMAGE' | 'VIDEO'): Promise<void> {
  if (!canMediaEdit.value) return;
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = '';
  const current = media.value.filter((item) => item.media_type === type).length;
  const limit = type === 'IMAGE' ? 6 : 1;
  if (!files.length || current + files.length > limit) {
    ElMessage.warning(type === 'IMAGE' ? '主图最多6张' : '视频最多1个');
    return;
  }
  const uploaded =
    type === 'IMAGE' && files.length > 1
      ? await catalogApi.uploadImages(files)
      : [
          await catalogApi.uploadMedia(
            files[0]!,
            type === 'IMAGE' ? 'image' : 'video',
          ),
        ];
  for (const [index, item] of uploaded.entries()) {
    await catalogApi.addProductMedia(productId, {
      media_type: type,
      url: item.url,
      thumbnail_url: item.thumbnail_url,
      sort: current + index,
    });
  }
  ElMessage.success('媒体已上传');
  await load();
}

async function deleteMedia(item: ProductMedia): Promise<void> {
  await catalogApi.deleteProductMedia(productId, item.id);
  await load();
}

async function dropMedia(target: ProductMedia): Promise<void> {
  const sourceId = draggingMediaId.value;
  draggingMediaId.value = null;
  if (!sourceId || sourceId === target.id) return;
  const sameType = media.value.filter((item) => item.media_type === target.media_type);
  const source = sameType.find((item) => item.id === sourceId);
  if (!source) return;
  await Promise.all([
    catalogApi.sortProductMedia(productId, source.id, target.sort),
    catalogApi.sortProductMedia(productId, target.id, source.sort),
  ]);
  await load();
}

function openSku(row?: Sku): void {
  editingSkuId.value = row?.id ?? null;
  Object.assign(skuForm, {
    sku_code: row?.sku_code ?? '',
    sku_name: row?.sku_name ?? '',
    specification: row?.specification ?? '',
    sale_type: row?.sale_type ?? 'PIECE',
    unit: row?.piece_unit ?? '箱',
    weight_unit: row?.weight_unit ?? '斤',
    standard_weight: Number(row?.standard_weight ?? 20),
    gross_weight_unit_price: Number(row?.gross_weight_unit_price ?? 0),
    net_weight_unit_price: Number(row?.net_weight_unit_price ?? 0),
    delivery_weight_per_piece: Number(row?.delivery_weight_per_piece ?? 10),
    delivery_weight_unit: row?.delivery_weight_unit ?? '斤',
    cost_price: Number(row?.cost_price ?? 0),
    base_price: Number(row?.base_price ?? 0),
    market_price: Number(row?.market_price ?? row?.base_price ?? 0),
    stock_warning: Number(row?.stock_warning ?? 0),
    status: row?.status ?? 'ACTIVE',
  });
  skuDialog.value = true;
}

async function saveSku(): Promise<void> {
  await catalogApi.saveSku(editingSkuId.value, {
    product_id: productId,
    sku_code: skuForm.sku_code,
    sku_name: skuForm.sku_name,
    specification: skuForm.specification || undefined,
    sale_type: skuForm.sale_type,
    piece_unit: skuForm.unit,
    weight_unit: skuForm.sale_type === 'WEIGHT' ? skuForm.weight_unit : undefined,
    stock_unit: skuForm.sale_type === 'WEIGHT' ? skuForm.weight_unit : skuForm.unit,
    price_unit: skuForm.unit,
    standard_weight: skuForm.sale_type === 'WEIGHT' ? skuForm.standard_weight : undefined,
    weight_price_type: skuForm.sale_type === 'WEIGHT' ? 'ACTUAL_WEIGHT' : undefined,
    gross_weight_unit_price:
      skuForm.sale_type === 'WEIGHT' ? skuForm.gross_weight_unit_price : undefined,
    net_weight_unit_price:
      skuForm.sale_type === 'WEIGHT' ? skuForm.net_weight_unit_price : undefined,
    delivery_weight_per_piece:
      skuForm.sale_type === 'PIECE' ? skuForm.delivery_weight_per_piece : undefined,
    delivery_weight_unit:
      skuForm.sale_type === 'PIECE' ? skuForm.delivery_weight_unit : undefined,
    cost_price: skuForm.cost_price,
    base_price: skuForm.base_price,
    market_price: skuForm.market_price,
    stock_warning: skuForm.stock_warning,
    status: skuForm.status,
  });
  skuDialog.value = false;
  ElMessage.success('SKU已保存');
  await load();
}

async function deleteSku(row: Sku): Promise<void> {
  await ElMessageBox.confirm('仅无库存SKU可以删除，确认继续？', '删除SKU', {
    type: 'warning',
  });
  await catalogApi.deleteSku(row.id);
  await load();
}

function openPrice(type: typeof priceType.value, skuId?: string): void {
  priceType.value = type;
  Object.assign(priceForm, {
    sku_id: skuId ?? '',
    level_id: '',
    customer_id: '',
    min_quantity: 1,
    max_quantity: undefined,
    price: 0,
  });
  priceDialog.value = true;
}

async function savePrice(): Promise<void> {
  if (priceType.value === 'levels') {
    await catalogApi.upsertLevelPrice({
      sku_id: priceForm.sku_id,
      level_id: priceForm.level_id,
      price: priceForm.price,
      status: 'ACTIVE',
    });
  } else if (priceType.value === 'customers') {
    await catalogApi.upsertCustomerPrice({
      sku_id: priceForm.sku_id,
      customer_id: priceForm.customer_id,
      price: priceForm.price,
      status: 'ACTIVE',
    });
  } else {
    await catalogApi.createQuantityPrice({
      sku_id: priceForm.sku_id,
      min_quantity: priceForm.min_quantity,
      max_quantity: priceForm.max_quantity,
      price: priceForm.price,
      status: 'ACTIVE',
    });
  }
  priceDialog.value = false;
  ElMessage.success('价格规则已保存');
  await load();
}

async function deletePrice(
  type: 'levels' | 'customers' | 'quantities',
  id: string,
): Promise<void> {
  await catalogApi.deletePrice(type, id);
  await load();
}

async function addDescriptionText(): Promise<void> {
  if (!descriptionText.value.trim()) return;
  await catalogApi.addProductDescription(productId, {
    content_json: { type: 'TEXT', text: descriptionText.value.trim() },
    sort: descriptions.value.length,
  });
  descriptionText.value = '';
  await load();
}

async function addDescriptionImage(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const uploaded = await catalogApi.uploadMedia(file, 'image');
  await catalogApi.addProductDescription(productId, {
    content_json: { type: 'IMAGE', url: uploaded.url },
    sort: descriptions.value.length,
  });
  await load();
}

async function moveDescription(item: ProductDescription, offset: number): Promise<void> {
  await catalogApi.updateProductDescription(productId, item.id, {
    content_json: item.content_json,
    sort: Math.max(0, item.sort + offset),
  });
  await load();
}

async function deleteDescription(item: ProductDescription): Promise<void> {
  await catalogApi.deleteProductDescription(productId, item.id);
  await load();
}

function skuName(id: string): string {
  return skus.value.find((item) => item.id === id)?.sku_name ?? id;
}
function levelName(id: string): string {
  return priceReferences.value?.levels.find((item) => item.id === id)?.name ?? id;
}
function customerName(id: string): string {
  return priceReferences.value?.customers.find((item) => item.id === id)?.customer_name ?? id;
}

onMounted(load);
</script>

<template>
  <section v-loading="loading" class="product-workbench">
    <div class="workbench-header">
      <div>
        <ElButton link @click="router.push('/products')">← 返回商品列表</ElButton>
        <h1>{{ product?.name || '商品工作台' }}</h1>
        <div class="workbench-meta">
          <span>编码：{{ product?.product_code }}</span>
          <ElTag :type="product?.status === 'ON_SALE' ? 'success' : 'info'">
            {{ product?.status === 'ON_SALE' ? '销售中' : product?.status }}
          </ElTag>
        </div>
      </div>
      <div class="toolbar-group">
        <ElButton v-if="canFullEdit" @click="toggleStatus">
          {{ product?.status === 'ON_SALE' ? '下架' : '上架' }}
        </ElButton>
        <ElButton
          v-if="canDisplayEdit"
          type="primary"
          :loading="saving"
          @click="saveBasic"
        >
          保存
        </ElButton>
      </div>
    </div>

    <div class="management-card">
      <ElTabs v-model="activeTab">
        <ElTabPane label="基础信息" name="basic">
          <ElForm label-width="110px" class="workbench-form">
            <div class="form-grid">
              <ElFormItem label="商品编码"><ElInput v-model="form.product_code" :disabled="!canFullEdit" /></ElFormItem>
              <ElFormItem label="商品条码"><ElInput v-model="form.barcode" :disabled="!canFullEdit" /></ElFormItem>
              <ElFormItem label="商品名称"><ElInput v-model="form.name" :disabled="!canDisplayEdit" /></ElFormItem>
              <ElFormItem label="二级分类">
                <ElSelect v-model="form.category_id" :disabled="!canFullEdit" filterable style="width:100%">
                  <ElOption v-for="item in leafCategories" :key="item.value" :label="item.label" :value="item.value" />
                </ElSelect>
              </ElFormItem>
              <ElFormItem label="商品等级">
                <ElSelect v-model="form.grade" :disabled="!canDisplayEdit" clearable style="width:100%">
                  <ElOption v-for="grade in ['A','B','C','特级']" :key="grade" :label="grade" :value="grade" />
                </ElSelect>
              </ElFormItem>
              <ElFormItem label="产地"><ElInput v-model="form.origin" :disabled="!canDisplayEdit" /></ElFormItem>
              <ElFormItem label="品牌"><ElInput v-model="form.brand" :disabled="!canDisplayEdit" /></ElFormItem>
              <ElFormItem label="销售模式">
                <ElInput :model-value="[...new Set(skus.map(item => item.sale_type === 'PIECE' ? '按件' : '固定重量'))].join(' / ') || '请在SKU中配置'" disabled />
              </ElFormItem>
              <ElFormItem label="商品单位">
                <ElInput :model-value="[...new Set(skus.map(item => item.piece_unit).filter(Boolean))].join(' / ') || '请在SKU中配置'" disabled />
              </ElFormItem>
            </div>
            <ElFormItem label="商品描述"><ElInput v-model="form.description" :disabled="!canDisplayEdit" type="textarea" :rows="5" /></ElFormItem>
          </ElForm>
        </ElTabPane>

        <ElTabPane v-if="auth.hasPermission('product.media.read')" label="图片/视频" name="media">
          <div v-if="canMediaEdit" class="toolbar-group tab-toolbar">
            <label class="upload-button">上传主图<input type="file" accept="image/jpeg,image/png,image/webp" multiple @change="uploadFiles($event, 'IMAGE')" /></label>
            <label class="upload-button secondary">上传视频<input type="file" accept="video/mp4" @change="uploadFiles($event, 'VIDEO')" /></label>
            <span class="muted">图片 {{ media.filter(item => item.media_type === 'IMAGE').length }}/6 · 视频 {{ media.filter(item => item.media_type === 'VIDEO').length }}/1，可拖动交换顺序</span>
          </div>
          <div class="media-grid">
            <article
              v-for="item in media"
              :key="item.id"
              class="media-card"
              draggable="true"
              @dragstart="draggingMediaId = item.id"
              @dragover.prevent
              @drop="dropMedia(item)"
            >
              <img :src="item.thumbnail_url || item.url" :alt="item.media_type" />
              <ElTag size="small">{{ item.media_type === 'VIDEO' ? '视频' : '主图' }}</ElTag>
              <ElButton v-if="canMediaEdit" link type="danger" @click="deleteMedia(item)">删除</ElButton>
            </article>
          </div>
        </ElTabPane>

        <ElTabPane label="SKU管理" name="sku">
          <div class="tab-toolbar"><ElButton v-if="canSkuEdit" type="primary" @click="openSku()">新增SKU</ElButton></div>
          <ElTable :data="skus">
            <ElTableColumn prop="sku_code" label="SKU编号" width="150" />
            <ElTableColumn prop="specification" label="规格" min-width="130" />
            <ElTableColumn prop="grade" label="等级" width="90" />
            <ElTableColumn label="重量" width="120"><template #default="{row}">{{ row.standard_weight ? `${row.standard_weight}${row.weight_unit}` : '—' }}</template></ElTableColumn>
            <ElTableColumn label="库存" width="130"><template #default="{row}">{{ row.inventory?.available_quantity ?? '0.000' }} {{ row.stock_unit }}</template></ElTableColumn>
            <ElTableColumn prop="cost_price" label="成本价" width="100" />
            <ElTableColumn prop="base_price" label="销售价" width="100" />
            <ElTableColumn prop="status" label="状态" width="100" />
            <ElTableColumn v-if="canSkuEdit" label="操作" width="140">
              <template #default="{row}"><ElButton link @click="openSku(row)">编辑</ElButton><ElButton link type="danger" @click="deleteSku(row)">删除</ElButton></template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>

        <ElTabPane v-if="auth.hasPermission('price.read')" label="价格管理" name="price">
          <div v-if="canPriceEdit" class="toolbar-group tab-toolbar">
            <ElButton @click="openPrice('levels')">客户等级价</ElButton>
            <ElButton @click="openPrice('customers')">客户专属价</ElButton>
            <ElButton type="primary" @click="openPrice('quantities')">新增阶梯价</ElButton>
          </div>
          <ElTable :data="skus" style="margin-bottom:18px">
            <ElTableColumn prop="sku_name" label="SKU" />
            <ElTableColumn prop="market_price" label="市场价" />
            <ElTableColumn prop="base_price" label="销售价" />
            <ElTableColumn prop="cost_price" label="成本价" />
          </ElTable>
          <h3>阶梯价格</h3>
          <ElTable :data="workbench?.prices.quantity_prices ?? []">
            <ElTableColumn label="SKU"><template #default="{row}">{{ skuName(row.sku_id) }}</template></ElTableColumn>
            <ElTableColumn prop="min_quantity" label="起始" />
            <ElTableColumn label="结束"><template #default="{row}">{{ row.max_quantity ?? '以上' }}</template></ElTableColumn>
            <ElTableColumn prop="price" label="价格" />
            <ElTableColumn v-if="canPriceEdit" width="90"><template #default="{row}"><ElButton link type="danger" @click="deletePrice('quantities', row.id)">删除</ElButton></template></ElTableColumn>
          </ElTable>
          <h3>客户等级价格</h3>
          <ElTable :data="workbench?.prices.level_prices ?? []">
            <ElTableColumn label="SKU"><template #default="{row}">{{ skuName(row.sku_id) }}</template></ElTableColumn>
            <ElTableColumn label="等级"><template #default="{row}">{{ levelName(row.level_id) }}</template></ElTableColumn>
            <ElTableColumn prop="price" label="价格" />
            <ElTableColumn v-if="canPriceEdit" width="90"><template #default="{row}"><ElButton link type="danger" @click="deletePrice('levels', row.id)">删除</ElButton></template></ElTableColumn>
          </ElTable>
          <h3>客户专属价格</h3>
          <ElTable :data="workbench?.prices.customer_prices ?? []">
            <ElTableColumn label="SKU"><template #default="{row}">{{ skuName(row.sku_id) }}</template></ElTableColumn>
            <ElTableColumn label="客户"><template #default="{row}">{{ customerName(row.customer_id) }}</template></ElTableColumn>
            <ElTableColumn prop="price" label="价格" />
            <ElTableColumn v-if="canPriceEdit" width="90"><template #default="{row}"><ElButton link type="danger" @click="deletePrice('customers', row.id)">删除</ElButton></template></ElTableColumn>
          </ElTable>
        </ElTabPane>

        <ElTabPane v-if="auth.hasPermission('inventory.read')" label="库存管理" name="inventory">
          <ElAlert title="库存仅供查看；调整必须进入库存作业，继续使用原有库存事务。" type="info" :closable="false" />
          <ElTable :data="skus" style="margin-top:16px">
            <ElTableColumn prop="sku_name" label="SKU" />
            <ElTableColumn label="当前库存"><template #default="{row}">{{ row.inventory?.stock_quantity ?? '0.000' }} {{ row.stock_unit }}</template></ElTableColumn>
            <ElTableColumn label="锁定库存"><template #default="{row}">{{ row.inventory?.locked_quantity ?? '0.000' }}</template></ElTableColumn>
            <ElTableColumn label="可售库存"><template #default="{row}">{{ row.inventory?.available_quantity ?? '0.000' }}</template></ElTableColumn>
            <ElTableColumn prop="stock_warning" label="最低库存" />
            <ElTableColumn label="预警"><template #default="{row}"><ElTag :type="Number(row.inventory?.available_quantity ?? 0) <= Number(row.stock_warning) ? 'danger' : 'success'">{{ Number(row.inventory?.available_quantity ?? 0) <= Number(row.stock_warning) ? '预警' : '正常' }}</ElTag></template></ElTableColumn>
          </ElTable>
          <h3>库存调整记录</h3>
          <ElTable :data="workbench?.inventory_logs ?? []">
            <ElTableColumn prop="created_at" label="时间" width="180" />
            <ElTableColumn prop="sku_name" label="SKU" />
            <ElTableColumn prop="operation_type" label="类型" />
            <ElTableColumn prop="change_quantity" label="变化" />
            <ElTableColumn prop="reason" label="原因" min-width="200" />
          </ElTable>
        </ElTabPane>

        <ElTabPane v-if="auth.hasPermission('product.media.read')" label="商品详情" name="description">
          <div v-if="canMediaEdit" class="toolbar-group tab-toolbar">
            <ElInput v-model="descriptionText" placeholder="输入产地、品质、包装或售后说明" style="max-width:520px" />
            <ElButton type="primary" @click="addDescriptionText">添加文字</ElButton>
            <label class="upload-button secondary">添加图片<input type="file" accept="image/*" @change="addDescriptionImage" /></label>
          </div>
          <div class="description-list">
            <article v-for="item in descriptions" :key="item.id" class="description-item">
              <p v-if="item.content_json.type === 'TEXT'">{{ item.content_json.text }}</p>
              <img v-else :src="item.content_json.url" alt="详情图片" />
              <div v-if="canMediaEdit"><ElButton link @click="moveDescription(item,-1)">上移</ElButton><ElButton link @click="moveDescription(item,1)">下移</ElButton><ElButton link type="danger" @click="deleteDescription(item)">删除</ElButton></div>
            </article>
          </div>
        </ElTabPane>

        <ElTabPane v-if="auth.hasPermission('purchase.read') || auth.hasPermission('cost.read')" label="采购信息" name="procurement">
          <ElAlert :title="canProcurementEdit ? '采购价格通过采购订单与入库流程维护，避免覆盖历史成本。' : '当前角色仅可查看采购信息。'" type="info" :closable="false" />
          <div v-if="canProcurementEdit" class="tab-toolbar"><ElButton type="primary" @click="router.push('/purchases')">进入采购单维护</ElButton></div>
          <ElTable :data="workbench?.purchases ?? []">
            <ElTableColumn prop="supplier_name" label="供应商" />
            <ElTableColumn prop="sku_name" label="SKU" />
            <ElTableColumn prop="purchase_price" label="采购价" />
            <ElTableColumn prop="purchase_date" label="采购时间" />
            <ElTableColumn prop="remark" label="采购备注" />
            <ElTableColumn prop="status" label="状态" />
          </ElTable>
        </ElTabPane>

        <ElTabPane label="操作日志" name="logs">
          <ElTable :data="workbench?.operation_logs ?? []">
            <ElTableColumn prop="operator_name" label="修改人" width="150" />
            <ElTableColumn prop="created_at" label="修改时间" width="190" />
            <ElTableColumn prop="action_code" label="修改内容" min-width="180" />
            <ElTableColumn label="变更数据" min-width="280"><template #default="{row}"><code>{{ JSON.stringify(row.after_data ?? {}) }}</code></template></ElTableColumn>
          </ElTable>
        </ElTabPane>
      </ElTabs>
    </div>

    <ElDialog v-model="skuDialog" :title="editingSkuId ? '编辑SKU' : '新增SKU'" width="680">
      <ElForm label-width="110px">
        <div class="form-grid">
          <ElFormItem label="SKU编号"><ElInput v-model="skuForm.sku_code" /></ElFormItem>
          <ElFormItem label="规格名称"><ElInput v-model="skuForm.sku_name" /></ElFormItem>
          <ElFormItem label="规格"><ElInput v-model="skuForm.specification" /></ElFormItem>
          <ElFormItem label="销售模式"><ElSelect v-model="skuForm.sale_type" style="width:100%"><ElOption label="按件销售" value="PIECE" /><ElOption label="固定重量销售" value="WEIGHT" /></ElSelect></ElFormItem>
          <ElFormItem label="销售单位"><ElInput v-model="skuForm.unit" /></ElFormItem>
          <ElFormItem label="标准重量" v-if="skuForm.sale_type === 'WEIGHT'"><ElInputNumber v-model="skuForm.standard_weight" :min="0.001" /><span>{{ skuForm.weight_unit }}</span></ElFormItem>
          <ElFormItem label="重量单位" v-if="skuForm.sale_type === 'WEIGHT'"><ElSelect v-model="skuForm.weight_unit"><ElOption label="斤" value="斤" /><ElOption label="公斤" value="公斤" /></ElSelect></ElFormItem>
          <ElFormItem label="毛重单价" v-if="skuForm.sale_type === 'WEIGHT'"><ElInputNumber v-model="skuForm.gross_weight_unit_price" :min="0" /></ElFormItem>
          <ElFormItem label="净重单价" v-if="skuForm.sale_type === 'WEIGHT'"><ElInputNumber v-model="skuForm.net_weight_unit_price" :min="0" /></ElFormItem>
          <ElFormItem label="单件配送重量" v-if="skuForm.sale_type === 'PIECE'"><ElInputNumber v-model="skuForm.delivery_weight_per_piece" :min="0.001" /></ElFormItem>
          <ElFormItem label="配送重量单位" v-if="skuForm.sale_type === 'PIECE'"><ElSelect v-model="skuForm.delivery_weight_unit"><ElOption label="斤" value="斤" /><ElOption label="公斤" value="公斤" /></ElSelect></ElFormItem>
          <ElFormItem label="成本价"><ElInputNumber v-model="skuForm.cost_price" :min="0" /></ElFormItem>
          <ElFormItem label="销售价"><ElInputNumber v-model="skuForm.base_price" :min="0" /></ElFormItem>
          <ElFormItem label="市场价"><ElInputNumber v-model="skuForm.market_price" :min="0" /></ElFormItem>
          <ElFormItem label="最低库存"><ElInputNumber v-model="skuForm.stock_warning" :min="0" /></ElFormItem>
        </div>
      </ElForm>
      <template #footer><ElButton @click="skuDialog=false">取消</ElButton><ElButton type="primary" @click="saveSku">保存</ElButton></template>
    </ElDialog>

    <ElDialog v-model="priceDialog" title="新增价格规则" width="540">
      <ElForm label-width="100px">
        <ElFormItem label="SKU"><ElSelect v-model="priceForm.sku_id" style="width:100%"><ElOption v-for="item in skus" :key="item.id" :label="item.sku_name" :value="item.id" /></ElSelect></ElFormItem>
        <ElFormItem v-if="priceType === 'levels'" label="客户等级"><ElSelect v-model="priceForm.level_id" style="width:100%"><ElOption v-for="item in priceReferences?.levels ?? []" :key="item.id" :label="item.name" :value="item.id" /></ElSelect></ElFormItem>
        <ElFormItem v-if="priceType === 'customers'" label="客户"><ElSelect v-model="priceForm.customer_id" filterable style="width:100%"><ElOption v-for="item in priceReferences?.customers ?? []" :key="item.id" :label="item.customer_name" :value="item.id" /></ElSelect></ElFormItem>
        <template v-if="priceType === 'quantities'"><ElFormItem label="起始数量"><ElInputNumber v-model="priceForm.min_quantity" :min="0.001" /></ElFormItem><ElFormItem label="结束数量"><ElInputNumber v-model="priceForm.max_quantity" :min="priceForm.min_quantity" /></ElFormItem></template>
        <ElFormItem label="价格"><ElInputNumber v-model="priceForm.price" :min="0" /></ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="priceDialog=false">取消</ElButton><ElButton type="primary" @click="savePrice">保存</ElButton></template>
    </ElDialog>
  </section>
</template>

<style scoped>
.product-workbench { min-width: 0; }
.workbench-header { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; margin-bottom:18px; }
.workbench-header h1 { margin:8px 0; }
.workbench-meta,.toolbar-group { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.workbench-form { max-width:1040px; padding-top:12px; }
.form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 24px; }
.tab-toolbar { margin:12px 0 18px; }
.muted { color:#64748b; font-size:13px; }
.upload-button { display:inline-flex; align-items:center; padding:8px 15px; color:#fff; background:#16a34a; border-radius:6px; cursor:pointer; font-size:14px; }
.upload-button.secondary { color:#334155; background:#f1f5f9; }
.upload-button input { display:none; }
.media-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:16px; }
.media-card { border:1px solid #e2e8f0; border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:8px; cursor:grab; }
.media-card img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:8px; background:#f8fafc; }
.description-list { display:flex; flex-direction:column; gap:14px; }
.description-item { border:1px solid #e2e8f0; border-radius:8px; padding:14px; }
.description-item img { max-width:420px; max-height:280px; object-fit:contain; }
h3 { margin:22px 0 10px; }
code { white-space:normal; word-break:break-all; font-size:12px; }
@media (max-width:900px) { .form-grid { grid-template-columns:1fr; } .workbench-header { flex-direction:column; } }
</style>
