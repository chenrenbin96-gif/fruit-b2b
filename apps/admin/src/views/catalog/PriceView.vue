<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import {
  catalogApi,
  type PriceReferences,
  type PriceResult,
  type PriceRules,
} from '@/api/catalog';

type RuleType = 'levels' | 'customers' | 'quantities';

const loading = ref(false);
const dialogVisible = ref(false);
const dialogType = ref<RuleType>('levels');
const references = ref<PriceReferences>({
  skus: [],
  customers: [],
  levels: [],
});
const rules = ref<PriceRules>({
  level_prices: [],
  customer_prices: [],
  quantity_prices: [],
});
const form = reactive({
  sku_id: '',
  level_id: '',
  customer_id: '',
  min_quantity: 1,
  max_quantity: undefined as number | undefined,
  price: 0,
  status: 'ACTIVE',
});
const calculator = reactive({
  sku_id: '',
  customer_id: '',
  purchase_quantity: 1,
});
const calculation = ref<PriceResult | null>(null);
const dialogTitle = computed(() => ({
  levels: '设置客户等级价',
  customers: '设置客户专属价',
  quantities: '新增数量阶梯价',
})[dialogType.value]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    [references.value, rules.value] = await Promise.all([
      catalogApi.priceReferences(),
      catalogApi.listPrices(),
    ]);
  } finally {
    loading.value = false;
  }
}

function nameOf(
  type: 'sku' | 'level' | 'customer',
  id: string,
): string {
  if (type === 'sku') {
    const item = references.value.skus.find((row) => row.id === id);
    return item ? `${item.product_name} · ${item.sku_name}` : id;
  }
  if (type === 'level') {
    return references.value.levels.find((row) => row.id === id)?.name ?? id;
  }
  return (
    references.value.customers.find((row) => row.id === id)?.customer_name ??
    id
  );
}

function open(type: RuleType): void {
  dialogType.value = type;
  Object.assign(form, {
    sku_id: '',
    level_id: '',
    customer_id: '',
    min_quantity: 1,
    max_quantity: undefined,
    price: 0,
    status: 'ACTIVE',
  });
  dialogVisible.value = true;
}

async function save(): Promise<void> {
  if (dialogType.value === 'levels') {
    await catalogApi.upsertLevelPrice({
      sku_id: form.sku_id,
      level_id: form.level_id,
      price: form.price,
      status: form.status,
    });
  } else if (dialogType.value === 'customers') {
    await catalogApi.upsertCustomerPrice({
      sku_id: form.sku_id,
      customer_id: form.customer_id,
      price: form.price,
      status: form.status,
    });
  } else {
    await catalogApi.createQuantityPrice({
      sku_id: form.sku_id,
      min_quantity: form.min_quantity,
      max_quantity: form.max_quantity,
      price: form.price,
      status: form.status,
    });
  }
  ElMessage.success('价格规则已保存');
  dialogVisible.value = false;
  await load();
}

async function remove(type: RuleType, id: string): Promise<void> {
  await ElMessageBox.confirm('确认删除这条价格规则？', '删除价格规则', {
    type: 'warning',
  });
  await catalogApi.deletePrice(type, id);
  ElMessage.success('价格规则已删除');
  await load();
}

async function calculate(): Promise<void> {
  calculation.value = await catalogApi.calculatePrice({
    sku_id: calculator.sku_id,
    customer_id: calculator.customer_id || undefined,
    purchase_quantity: calculator.purchase_quantity,
  });
}

onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">PRICE ENGINE</p>
        <h1>价格管理</h1>
      </div>
      <div class="toolbar-group">
        <ElButton v-permission="'price.write'" @click="open('levels')">
          等级价
        </ElButton>
        <ElButton v-permission="'price.write'" @click="open('customers')">
          客户专属价
        </ElButton>
        <ElButton
          v-permission="'price.write'"
          type="primary"
          @click="open('quantities')"
        >
          阶梯价
        </ElButton>
      </div>
    </div>

    <div class="management-card" style="margin-bottom: 18px">
      <h3>价格试算</h3>
      <div class="toolbar-group">
        <ElSelect
          v-model="calculator.sku_id"
          filterable
          placeholder="选择SKU"
          style="width: 270px"
        >
          <ElOption
            v-for="item in references.skus"
            :key="item.id"
            :label="`${item.product_name} · ${item.sku_name}`"
            :value="item.id"
          />
        </ElSelect>
        <ElSelect
          v-model="calculator.customer_id"
          clearable
          filterable
          placeholder="选择客户（可选）"
          style="width: 220px"
        >
          <ElOption
            v-for="item in references.customers"
            :key="item.id"
            :label="item.customer_name"
            :value="item.id"
          />
        </ElSelect>
        <ElInputNumber
          v-model="calculator.purchase_quantity"
          :min="0.001"
          :precision="3"
        />
        <ElButton
          type="primary"
          :disabled="!calculator.sku_id"
          @click="calculate"
        >
          计算价格
        </ElButton>
      </div>
      <div v-if="calculation" class="price-summary">
        <div><small>基础价</small><strong>¥{{ calculation.base_price }}</strong></div>
        <div><small>等级价</small><strong>{{ calculation.level_price ?? '—' }}</strong></div>
        <div><small>客户价</small><strong>{{ calculation.customer_price ?? '—' }}</strong></div>
        <div><small>阶梯价</small><strong>{{ calculation.quantity_price ?? '—' }}</strong></div>
        <div><small>最终单价</small><strong>¥{{ calculation.final_unit_price }}/{{ calculation.price_unit }}</strong></div>
      </div>
    </div>

    <div class="management-card">
      <ElTabs v-loading="loading">
        <ElTabPane label="客户等级价">
          <ElTable :data="rules.level_prices">
            <ElTableColumn label="SKU" min-width="220">
              <template #default="{ row }">{{ nameOf('sku', row.sku_id) }}</template>
            </ElTableColumn>
            <ElTableColumn label="客户等级" width="150">
              <template #default="{ row }">{{ nameOf('level', row.level_id) }}</template>
            </ElTableColumn>
            <ElTableColumn prop="price" label="价格" width="130" />
            <ElTableColumn label="操作" width="90">
              <template #default="{ row }">
                <ElButton link type="danger" @click="remove('levels', row.id)">删除</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
        <ElTabPane label="客户专属价">
          <ElTable :data="rules.customer_prices">
            <ElTableColumn label="SKU" min-width="220">
              <template #default="{ row }">{{ nameOf('sku', row.sku_id) }}</template>
            </ElTableColumn>
            <ElTableColumn label="客户" width="180">
              <template #default="{ row }">{{ nameOf('customer', row.customer_id) }}</template>
            </ElTableColumn>
            <ElTableColumn prop="price" label="价格" width="130" />
            <ElTableColumn label="操作" width="90">
              <template #default="{ row }">
                <ElButton link type="danger" @click="remove('customers', row.id)">删除</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
        <ElTabPane label="数量阶梯价">
          <ElTable :data="rules.quantity_prices">
            <ElTableColumn label="SKU" min-width="220">
              <template #default="{ row }">{{ nameOf('sku', row.sku_id) }}</template>
            </ElTableColumn>
            <ElTableColumn prop="min_quantity" label="起始数量" width="120" />
            <ElTableColumn label="结束数量" width="120">
              <template #default="{ row }">{{ row.max_quantity ?? '以上' }}</template>
            </ElTableColumn>
            <ElTableColumn prop="price" label="价格" width="130" />
            <ElTableColumn label="操作" width="90">
              <template #default="{ row }">
                <ElButton link type="danger" @click="remove('quantities', row.id)">删除</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
      </ElTabs>
    </div>

    <ElDialog v-model="dialogVisible" :title="dialogTitle" width="520">
      <ElForm label-width="100px">
        <ElFormItem label="SKU">
          <ElSelect v-model="form.sku_id" filterable style="width: 100%">
            <ElOption
              v-for="item in references.skus"
              :key="item.id"
              :label="`${item.product_name} · ${item.sku_name}`"
              :value="item.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem v-if="dialogType === 'levels'" label="客户等级">
          <ElSelect v-model="form.level_id" style="width: 100%">
            <ElOption v-for="item in references.levels" :key="item.id" :label="item.name" :value="item.id" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem v-if="dialogType === 'customers'" label="客户">
          <ElSelect v-model="form.customer_id" filterable style="width: 100%">
            <ElOption v-for="item in references.customers" :key="item.id" :label="item.customer_name" :value="item.id" />
          </ElSelect>
        </ElFormItem>
        <template v-if="dialogType === 'quantities'">
          <ElFormItem label="起始数量">
            <ElInputNumber v-model="form.min_quantity" :min="0.001" :precision="3" />
          </ElFormItem>
          <ElFormItem label="结束数量">
            <ElInputNumber v-model="form.max_quantity" :min="form.min_quantity" :precision="3" placeholder="留空表示以上" />
          </ElFormItem>
        </template>
        <ElFormItem label="单价">
          <ElInputNumber v-model="form.price" :min="0" :precision="4" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :disabled="!form.sku_id" @click="save">保存</ElButton>
      </template>
    </ElDialog>
  </section>
</template>
