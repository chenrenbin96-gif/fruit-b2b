<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';

import {
  catalogApi,
  type Product,
  type Sku,
} from '@/api/catalog';

const loading = ref(false);
const dialogVisible = ref(false);
const editingId = ref<string | null>(null);
const skus = ref<Sku[]>([]);
const products = ref<Product[]>([]);
const form = reactive({
  product_id: '',
  sku_code: '',
  sku_name: '',
  specification: '',
  sale_type: 'PIECE' as 'PIECE' | 'WEIGHT',
  unit: '箱',
  weight_unit: '斤',
  standard_weight: 20,
  gross_weight_unit_price: 10,
  net_weight_unit_price: 11,
  delivery_weight_per_piece: 10,
  delivery_weight_unit: '公斤' as '斤' | '公斤',
  cost_price: 0,
  base_price: 0,
  market_price: 0,
  stock_warning: 0,
  status: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
});
const unitLabel = computed(() =>
  '销售单位',
);

watch(
  () => form.sale_type,
  (value) => {
    if (!editingId.value) form.unit = value === 'PIECE' ? '箱' : '件';
  },
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [skuRows, productRows] = await Promise.all([
      catalogApi.listSkus(),
      catalogApi.listProducts({ page_size: 100 }),
    ]);
    skus.value = skuRows;
    products.value = productRows.items;
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  editingId.value = null;
  Object.assign(form, {
    product_id: '',
    sku_code: '',
    sku_name: '',
    specification: '',
    sale_type: 'PIECE',
    unit: '箱',
    weight_unit: '斤',
    standard_weight: 20,
    gross_weight_unit_price: 10,
    net_weight_unit_price: 11,
    delivery_weight_per_piece: 10,
    delivery_weight_unit: '公斤',
    cost_price: 0,
    base_price: 0,
    market_price: 0,
    stock_warning: 0,
    status: 'ACTIVE',
  });
  dialogVisible.value = true;
}

function openEdit(row: Sku): void {
  editingId.value = row.id;
  Object.assign(form, {
    product_id: row.product_id,
    sku_code: row.sku_code,
    sku_name: row.sku_name,
    specification: row.specification ?? '',
    sale_type: row.sale_type,
    unit: row.piece_unit ?? '件',
    weight_unit: row.weight_unit ?? '斤',
    standard_weight: Number(row.standard_weight ?? 20),
    gross_weight_unit_price: Number(row.gross_weight_unit_price ?? 0),
    net_weight_unit_price: Number(row.net_weight_unit_price ?? 0),
    delivery_weight_per_piece: Number(row.delivery_weight_per_piece ?? 10),
    delivery_weight_unit: row.delivery_weight_unit ?? '公斤',
    cost_price: Number(row.cost_price),
    base_price: Number(row.base_price),
    market_price: Number(row.market_price ?? row.base_price),
    stock_warning: Number(row.stock_warning),
    status: row.status,
  });
  dialogVisible.value = true;
}

async function save(): Promise<void> {
  await catalogApi.saveSku(editingId.value, {
    product_id: form.product_id,
    sku_code: form.sku_code,
    sku_name: form.sku_name,
    specification: form.specification || undefined,
    sale_type: form.sale_type,
    piece_unit: form.unit,
    weight_unit: form.sale_type === 'WEIGHT' ? form.weight_unit : undefined,
    stock_unit: form.sale_type === 'WEIGHT' ? form.weight_unit : form.unit,
    price_unit: form.unit,
    standard_weight:
      form.sale_type === 'WEIGHT' ? form.standard_weight : undefined,
    weight_price_type:
      form.sale_type === 'WEIGHT' ? 'ACTUAL_WEIGHT' : undefined,
    gross_weight_unit_price:
      form.sale_type === 'WEIGHT'
        ? form.gross_weight_unit_price
        : undefined,
    net_weight_unit_price:
      form.sale_type === 'WEIGHT'
        ? form.net_weight_unit_price
        : undefined,
    delivery_weight_per_piece:
      form.sale_type === 'PIECE'
        ? form.delivery_weight_per_piece
        : undefined,
    delivery_weight_unit:
      form.sale_type === 'PIECE'
        ? form.delivery_weight_unit
        : undefined,
    cost_price: form.cost_price,
    base_price: form.base_price,
    market_price: form.market_price,
    stock_warning: form.stock_warning,
    status: form.status,
  });
  ElMessage.success('SKU已保存');
  dialogVisible.value = false;
  await load();
}

async function toggleStatus(row: Sku): Promise<void> {
  await catalogApi.setSkuStatus(
    row.id,
    row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
  );
  ElMessage.success('SKU状态已更新');
  await load();
}

onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">SALES MODE</p>
        <h1>SKU管理</h1>
      </div>
      <ElButton
        v-permission="'product.sku.write'"
        type="primary"
        @click="openCreate"
      >
        新建SKU
      </ElButton>
    </div>
    <div class="management-card">
      <ElTable v-loading="loading" :data="skus">
        <ElTableColumn prop="sku_code" label="SKU编码" width="140" />
        <ElTableColumn prop="product_name" label="商品" min-width="150" />
        <ElTableColumn prop="sku_name" label="规格名称" min-width="160" />
        <ElTableColumn label="销售方式" width="120">
          <template #default="{ row }">
            <ElTag
              :class="
                row.sale_type === 'PIECE'
                  ? 'sale-tag-piece'
                  : 'sale-tag-weight'
              "
              effect="plain"
            >
              {{ row.sale_type === 'PIECE' ? '按件' : '称重' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="stock_unit" label="库存单位" width="100" />
        <ElTableColumn label="基础价" width="120">
          <template #default="{ row }">
            ¥{{ row.base_price }}/{{ row.price_unit }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="status" label="状态" width="100" />
        <ElTableColumn label="操作" width="170">
          <template #default="{ row }">
            <ElButton
              v-permission="'product.sku.write'"
              link
              @click="openEdit(row)"
            >
              编辑
            </ElButton>
            <ElButton
              v-permission="'product.sku.write'"
              link
              type="primary"
              @click="toggleStatus(row)"
            >
              {{ row.status === 'ACTIVE' ? '停用' : '启用' }}
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <ElDialog
      v-model="dialogVisible"
      :title="editingId ? '编辑SKU' : '新建SKU'"
      width="640"
    >
      <ElForm label-width="100px">
        <ElFormItem label="所属商品">
          <ElSelect v-model="form.product_id" filterable style="width: 100%">
            <ElOption
              v-for="item in products"
              :key="item.id"
              :label="`${item.product_code} · ${item.name}`"
              :value="item.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="SKU编码">
          <ElInput v-model="form.sku_code" />
        </ElFormItem>
        <ElFormItem label="规格名称">
          <ElInput v-model="form.sku_name" />
        </ElFormItem>
        <ElFormItem label="规格说明">
          <ElInput v-model="form.specification" />
        </ElFormItem>
        <ElFormItem label="销售方式">
          <ElRadioGroup v-model="form.sale_type">
            <ElRadio value="PIECE">按件销售</ElRadio>
            <ElRadio value="WEIGHT">称重销售</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem :label="unitLabel">
          <ElInput v-model="form.unit" placeholder="箱 / 件 / 盒" />
        </ElFormItem>
        <template v-if="form.sale_type === 'WEIGHT'">
          <ElFormItem label="标准重量">
            <ElInputNumber v-model="form.standard_weight" :min="0.001" :precision="3" />
            <ElSelect v-model="form.weight_unit" style="width: 100px; margin-left: 8px">
              <ElOption label="斤" value="斤" />
              <ElOption label="公斤" value="公斤" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="计价方式">
            <ElTag>实际重量结算</ElTag>
          </ElFormItem>
          <ElFormItem label="毛重单价">
            <ElInputNumber v-model="form.gross_weight_unit_price" :min="0" :precision="4" />
            <span style="margin-left: 8px">元/{{ form.weight_unit }}</span>
          </ElFormItem>
          <ElFormItem label="净重单价">
            <ElInputNumber v-model="form.net_weight_unit_price" :min="0" :precision="4" />
            <span style="margin-left: 8px">元/{{ form.weight_unit }}</span>
          </ElFormItem>
        </template>
        <ElFormItem
          v-if="form.sale_type === 'PIECE'"
          label="单件配送重量"
        >
          <ElInputNumber
            v-model="form.delivery_weight_per_piece"
            :min="0.001"
            :precision="3"
          />
          <ElSelect
            v-model="form.delivery_weight_unit"
            style="width: 100px; margin-left: 8px"
          >
            <ElOption label="斤" value="斤" />
            <ElOption label="公斤" value="公斤" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="成本价">
          <ElInputNumber v-model="form.cost_price" :min="0" :precision="4" />
        </ElFormItem>
        <ElFormItem label="基础价">
          <ElInputNumber v-model="form.base_price" :min="0" :precision="4" />
        </ElFormItem>
        <ElFormItem label="市场价">
          <ElInputNumber v-model="form.market_price" :min="0" :precision="4" />
        </ElFormItem>
        <ElFormItem label="库存预警">
          <ElInputNumber v-model="form.stock_warning" :min="0" :precision="3" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :disabled="!form.product_id || !form.sku_code || !form.sku_name || !form.unit"
          @click="save"
        >
          保存
        </ElButton>
      </template>
    </ElDialog>
  </section>
</template>
