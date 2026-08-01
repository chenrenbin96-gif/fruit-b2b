<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';

import {
  catalogApi,
  type Inventory,
} from '@/api/catalog';

type References = Awaited<ReturnType<typeof catalogApi.inventoryReferences>>;

const loading = ref(false);
const dialogVisible = ref(false);
const inventory = ref<Inventory[]>([]);
const references = ref<References>({ warehouses: [], skus: [] });
const form = reactive({
  warehouse_id: '',
  sku_id: '',
  operation_type: 'ADJUST_IN' as 'ADJUST_IN' | 'ADJUST_OUT' | 'SET',
  quantity: 0,
  reason: '',
});
const selectedSku = computed(() =>
  references.value.skus.find((item) => item.id === form.sku_id),
);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [rows, refs] = await Promise.all([
      catalogApi.listInventory(),
      catalogApi.inventoryReferences(),
    ]);
    inventory.value = rows;
    references.value = refs;
  } finally {
    loading.value = false;
  }
}

function openAdjust(row?: Inventory): void {
  Object.assign(form, {
    warehouse_id: row?.warehouse_id ?? references.value.warehouses[0]?.id ?? '',
    sku_id: row?.sku_id ?? '',
    operation_type: 'ADJUST_IN',
    quantity: 0,
    reason: '',
  });
  dialogVisible.value = true;
}

async function adjust(): Promise<void> {
  await catalogApi.adjustInventory(form);
  ElMessage.success('库存调整成功');
  dialogVisible.value = false;
  await load();
}

onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">INVENTORY</p>
        <h1>库存管理</h1>
      </div>
      <ElButton
        v-permission="'inventory.adjust'"
        type="primary"
        @click="openAdjust()"
      >
        库存调整
      </ElButton>
    </div>
    <div class="management-card">
      <ElTable v-loading="loading" :data="inventory">
        <ElTableColumn prop="product_name" label="商品" min-width="150" />
        <ElTableColumn prop="sku_name" label="SKU" min-width="150" />
        <ElTableColumn label="销售方式" width="100">
          <template #default="{ row }">
            {{ row.sale_type === 'PIECE' ? '按件' : '称重' }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="stock_quantity" label="实际库存" width="110" />
        <ElTableColumn prop="locked_quantity" label="锁定库存" width="110" />
        <ElTableColumn prop="available_quantity" label="可售库存" width="110" />
        <ElTableColumn prop="stock_unit" label="单位" width="80" />
        <ElTableColumn label="预警" width="90">
          <template #default="{ row }">
            <ElTag :type="row.warning ? 'danger' : 'success'">
              {{ row.warning ? '预警' : '正常' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="100">
          <template #default="{ row }">
            <ElButton
              v-permission="'inventory.adjust'"
              link
              type="primary"
              @click="openAdjust(row)"
            >
              调整
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
      <ElEmpty v-if="!loading && inventory.length === 0" description="暂无库存记录，首次调整后自动创建" />
    </div>

    <ElDialog v-model="dialogVisible" title="库存调整" width="520">
      <ElForm label-width="90px">
        <ElFormItem label="仓库">
          <ElSelect v-model="form.warehouse_id" style="width: 100%">
            <ElOption
              v-for="item in references.warehouses"
              :key="item.id"
              :label="item.warehouse_name"
              :value="item.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="SKU">
          <ElSelect v-model="form.sku_id" filterable style="width: 100%">
            <ElOption
              v-for="item in references.skus"
              :key="item.id"
              :label="`${item.product_name} · ${item.sku_name}（${item.stock_unit}）`"
              :value="item.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="调整方式">
          <ElSelect v-model="form.operation_type">
            <ElOption label="增加库存" value="ADJUST_IN" />
            <ElOption label="减少库存" value="ADJUST_OUT" />
            <ElOption label="设置实际库存" value="SET" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem :label="`数量${selectedSku ? `（${selectedSku.stock_unit}）` : ''}`">
          <ElInputNumber
            v-model="form.quantity"
            :min="0"
            :precision="selectedSku?.sale_type === 'PIECE' ? 0 : 3"
          />
        </ElFormItem>
        <ElFormItem label="调整原因">
          <ElInput v-model="form.reason" type="textarea" :rows="3" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :disabled="!form.warehouse_id || !form.sku_id || !form.reason"
          @click="adjust"
        >
          确认调整
        </ElButton>
      </template>
    </ElDialog>
  </section>
</template>
