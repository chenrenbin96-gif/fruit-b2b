<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import {
  procurementApi,
  type PurchaseOrder,
  type PurchaseReferences,
} from '@/api/procurement';
import { useAuthStore } from '@/stores/auth';

type PurchaseLine = {
  sku_id: string;
  quantity: number;
  purchase_price: number;
};

const auth = useAuthStore();
const loading = ref(false);
const rows = ref<PurchaseOrder[]>([]);
const references = ref<PurchaseReferences>({
  suppliers: [],
  warehouses: [],
  skus: [],
});
const status = ref('');
const purchaseDialog = ref(false);
const receiveDialog = ref(false);
const detailDrawer = ref(false);
const editingId = ref<string | null>(null);
const activeOrder = ref<PurchaseOrder | null>(null);
const form = reactive({
  supplier_id: '',
  warehouse_id: '',
  remark: '',
  purchase_date: '',
  purchase_type: 'SUPPLIER' as 'MARKET' | 'SUPPLIER',
  planned_delivery_date: '',
  sort_mode: 'ADDED' as 'ADDED' | 'CATEGORY',
  update_last_purchase_price: true,
  items: [] as PurchaseLine[],
});
const receiveForm = reactive({
  remark: '',
  items: [] as Array<{
    purchase_order_item_id: string;
    received_quantity: number;
    gross_weight?: number;
    net_weight?: number;
  }>,
});
const canWrite = computed(() => auth.hasPermission('purchase.write'));
const canReceive = computed(() => auth.hasPermission('inventory.receive'));
const statusLabels: Record<string, string> = {
  PENDING_PURCHASE: '待采购',
  PURCHASING: '采购中',
  ARRIVED: '已到货',
  PARTIALLY_RECEIVED: '部分收货',
  RECEIVED: '全部收货',
  COMPLETED: '已完成',
  STOCKED: '已入库',
  CANCELLED: '已取消',
};

async function load(): Promise<void> {
  loading.value = true;
  try {
    [rows.value, references.value] = await Promise.all([
      procurementApi.purchases({ status: status.value || undefined }),
      procurementApi.references(),
    ]);
  } finally {
    loading.value = false;
  }
}

function addLine(): void {
  form.items.push({ sku_id: '', quantity: 1, purchase_price: 0 });
}

function removeLine(index: number): void {
  form.items.splice(index, 1);
}

function selectedSku(id: string) {
  return references.value.skus.find((item) => item.id === id);
}

function openCreate(row?: PurchaseOrder): void {
  editingId.value = row?.id ?? null;
  Object.assign(form, {
    supplier_id: row?.supplier_id ?? references.value.suppliers[0]?.id ?? '',
    warehouse_id: row?.warehouse_id ?? references.value.warehouses[0]?.id ?? '',
    remark: row?.remark ?? '',
    purchase_date: row?.purchase_date ?? '',
    purchase_type: row?.purchase_type ?? 'SUPPLIER',
    planned_delivery_date: row?.planned_delivery_date ?? '',
    sort_mode: 'ADDED',
    update_last_purchase_price: true,
    items:
      row?.items.map((item) => ({
        sku_id: item.sku_id,
        quantity: Number(item.ordered_quantity),
        purchase_price: Number(item.purchase_price),
      })) ?? [{ sku_id: '', quantity: 1, purchase_price: 0 }],
  });
  purchaseDialog.value = true;
}

async function saveDraft(): Promise<void> {
  const result = await procurementApi.savePurchase(editingId.value, {
    supplier_id: form.supplier_id,
    warehouse_id: form.warehouse_id,
    remark: form.remark || undefined,
    purchase_date: form.purchase_date || undefined,
    purchase_type: form.purchase_type,
    planned_delivery_date: form.planned_delivery_date || undefined,
    sort_mode: form.sort_mode,
    update_last_purchase_price: form.update_last_purchase_price,
    items: form.items,
  });
  ElMessage.success(editingId.value ? '采购单已更新' : '采购单草稿已创建');
  editingId.value = result.id;
  purchaseDialog.value = false;
  await load();
}

async function arrive(row: PurchaseOrder): Promise<void> {
  await ElMessageBox.confirm(`确认采购单 ${row.purchase_no} 已到货？`, '到货验收');
  await procurementApi.arrive(row.id);
  ElMessage.success('已确认到货，可进行入库验收');
  await load();
}

async function cancelPurchase(row: PurchaseOrder): Promise<void> {
  await ElMessageBox.confirm(
    `确认取消采购单 ${row.purchase_no}？已入库订单不能取消。`,
    '取消采购',
    { type: 'warning' },
  );
  await procurementApi.cancel(row.id);
  ElMessage.success('采购单已取消');
  await load();
}

async function submit(row: PurchaseOrder): Promise<void> {
  await ElMessageBox.confirm(
    `提交采购单 ${row.purchase_no} 后将不能修改，是否继续？`,
    '提交采购',
  );
  await procurementApi.submit(row.id);
  ElMessage.success('采购单已提交');
  await load();
}

async function showDetail(row: PurchaseOrder): Promise<void> {
  activeOrder.value = await procurementApi.purchase(row.id);
  detailDrawer.value = true;
}

async function openReceive(row: PurchaseOrder): Promise<void> {
  const detail = await procurementApi.purchase(row.id);
  activeOrder.value = detail;
  receiveForm.remark = '';
  receiveForm.items = detail.items.map((item) => ({
    purchase_order_item_id: item.id,
    received_quantity: Number(item.ordered_quantity) - Number(item.received_quantity),
    ...(item.sale_type === 'WEIGHT'
      ? {
          gross_weight: Number(item.ordered_quantity) - Number(item.received_quantity),
          net_weight: Number(item.ordered_quantity) - Number(item.received_quantity),
        }
      : {}),
  }));
  receiveDialog.value = true;
}

async function receive(): Promise<void> {
  if (!activeOrder.value) return;
  await procurementApi.receive(activeOrder.value.id, {
    items: receiveForm.items,
    remark: receiveForm.remark || undefined,
  });
  ElMessage.success('采购入库成功，库存已增加');
  receiveDialog.value = false;
  await load();
}

function setReceivedQuantity(index: number, value: number | undefined): void {
  const item = receiveForm.items[index];
  if (item) item.received_quantity = Number(value ?? 0);
}

function setWeight(index: number, field: 'gross_weight' | 'net_weight', value: number | undefined): void {
  const item = receiveForm.items[index];
  if (!item) return;
  item[field] = Number(value ?? 0);
  if (field === 'net_weight') item.received_quantity = Number(value ?? 0);
}

onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">PROCUREMENT</p>
        <h1>采购订单</h1>
      </div>
      <ElButton v-if="canWrite" type="primary" @click="openCreate()">
        新建采购单
      </ElButton>
    </div>

    <div class="management-card">
      <div style="display:flex; gap:12px; margin-bottom:18px">
        <ElSelect v-model="status" clearable placeholder="全部状态" style="width:160px">
          <ElOption label="待采购" value="PENDING_PURCHASE" />
          <ElOption label="采购中" value="PURCHASING" />
          <ElOption label="已到货" value="ARRIVED" />
          <ElOption label="已入库" value="STOCKED" />
          <ElOption label="部分收货" value="PARTIALLY_RECEIVED" />
          <ElOption label="全部收货" value="RECEIVED" />
          <ElOption label="已完成" value="COMPLETED" />
        </ElSelect>
        <ElButton @click="load">查询</ElButton>
      </div>
      <ElTable v-loading="loading" :data="rows">
        <ElTableColumn prop="purchase_no" label="采购单号" width="200" />
        <ElTableColumn prop="supplier_name" label="供应商" min-width="150" />
        <ElTableColumn prop="warehouse_name" label="入库仓库" width="130" />
        <ElTableColumn label="采购类型" width="100">
          <template #default="{ row }">{{ row.purchase_type === 'MARKET' ? '市场采购' : '供应商采购' }}</template>
        </ElTableColumn>
        <ElTableColumn label="商品" min-width="190">
          <template #default="{ row }">
            {{ row.items.map((item: PurchaseOrder["items"][number]) => item.product_name).join("、") }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="total_amount" label="采购金额" width="120">
          <template #default="{ row }">¥{{ row.total_amount }}</template>
        </ElTableColumn>
        <ElTableColumn prop="received_amount" label="已收货金额" width="120">
          <template #default="{ row }">¥{{ row.received_amount }}</template>
        </ElTableColumn>
        <ElTableColumn prop="planned_delivery_date" label="计划交货" width="120" />
        <ElTableColumn label="进度" width="120">
          <template #default="{ row }"><ElProgress :percentage="Number(row.progress)" /></template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.status === 'STOCKED' ? 'success' : row.status === 'ARRIVED' ? 'warning' : 'info'">
              {{ statusLabels[row.status] }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <ElButton link @click="showDetail(row)">详情</ElButton>
            <ElButton
              v-if="canWrite && row.status === 'PENDING_PURCHASE'"
              link
              type="primary"
              @click="openCreate(row)"
            >
              编辑
            </ElButton>
            <ElButton
              v-if="canWrite && row.status === 'PENDING_PURCHASE'"
              link
              type="success"
              @click="submit(row)"
            >
              提交
            </ElButton>
            <ElButton
              v-if="canWrite && row.status === 'PURCHASING'"
              link
              type="success"
              @click="arrive(row)"
            >
              确认到货
            </ElButton>
            <ElButton
              v-if="canReceive && ['PURCHASING', 'ARRIVED', 'PARTIALLY_RECEIVED'].includes(row.status)"
              link
              type="warning"
              @click="openReceive(row)"
            >
              确认入库
            </ElButton>
            <ElButton
              v-if="
                canWrite &&
                ['PENDING_PURCHASE', 'PURCHASING', 'ARRIVED'].includes(row.status)
              "
              link
              type="danger"
              @click="cancelPurchase(row)"
            >
              取消
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </div>

    <ElDialog
      v-model="purchaseDialog"
      :title="editingId ? '编辑采购单' : '新建采购单'"
      width="900"
    >
      <ElForm label-width="90px">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px">
          <ElFormItem label="采购类型">
            <ElSelect v-model="form.purchase_type" style="width:100%">
              <ElOption label="供应商采购" value="SUPPLIER" /><ElOption label="市场采购" value="MARKET" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="供应商">
            <ElSelect v-model="form.supplier_id" filterable style="width:100%">
              <ElOption
                v-for="item in references.suppliers"
                :key="item.id"
                :label="item.supplier_name"
                :value="item.id"
              />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="入库仓库">
            <ElSelect v-model="form.warehouse_id" style="width:100%">
              <ElOption
                v-for="item in references.warehouses"
                :key="item.id"
                :label="item.warehouse_name"
                :value="item.id"
              />
            </ElSelect>
          </ElFormItem>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px">
          <ElFormItem label="计划交货">
            <ElDatePicker v-model="form.planned_delivery_date" type="date" value-format="YYYY-MM-DD" />
          </ElFormItem>
          <ElFormItem label="价格更新">
            <ElSwitch v-model="form.update_last_purchase_price" active-text="更新最近进货价" inactive-text="不更新" />
          </ElFormItem>
        </div>
        <ElFormItem label="采购日期">
          <ElDatePicker
            v-model="form.purchase_date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="默认开始采购当天"
          />
        </ElFormItem>
        <ElFormItem label="采购明细">
          <div style="width:100%">
            <div
              v-for="(line, index) in form.items"
              :key="index"
              style="display:grid; grid-template-columns:1fr 150px 160px 60px; gap:10px; margin-bottom:10px"
            >
              <ElSelect v-model="line.sku_id" filterable placeholder="选择SKU">
                <ElOption
                  v-for="sku in references.skus"
                  :key="sku.id"
                  :label="`${sku.product_name} · ${sku.sku_name}（${sku.stock_unit}）`"
                  :value="sku.id"
                />
              </ElSelect>
              <ElInputNumber
                v-model="line.quantity"
                :min="0.001"
                :precision="selectedSku(line.sku_id)?.sale_type === 'PIECE' ? 0 : 3"
              />
              <ElInputNumber
                v-model="line.purchase_price"
                :min="0"
                :precision="4"
              />
              <ElButton text type="danger" @click="removeLine(index)">删除</ElButton>
            </div>
            <ElButton plain @click="addLine">添加SKU</ElButton>
          </div>
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="form.remark" type="textarea" :rows="2" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="purchaseDialog = false">取消</ElButton>
        <ElButton
          type="primary"
          :disabled="
            !form.supplier_id ||
            !form.warehouse_id ||
            !form.items.length ||
            form.items.some((item) => !item.sku_id || item.quantity <= 0)
          "
          @click="saveDraft"
        >
          保存草稿
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="receiveDialog" title="采购到货确认" width="720">
      <ElAlert
        title="确认后将增加库存并保存本次采购成本，操作不可重复。"
        type="warning"
        :closable="false"
        style="margin-bottom:18px"
      />
      <ElTable :data="activeOrder?.items ?? []">
        <ElTableColumn prop="product_name" label="商品" min-width="140" />
        <ElTableColumn prop="sku_name" label="SKU" min-width="120" />
        <ElTableColumn label="采购数量" width="120">
          <template #default="{ row }">
            {{ row.ordered_quantity }} {{ row.purchase_unit }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="本次收货" width="190">
          <template #default="{ $index, row }">
            <ElInputNumber
              v-if="row.sale_type === 'PIECE'"
              :model-value="
                receiveForm.items[$index]?.received_quantity ?? 0
              "
              :min="0.001"
              :precision="row.sale_type === 'PIECE' ? 0 : 3"
              size="small"
              @update:model-value="setReceivedQuantity($index, $event)"
            />
            <template v-else>
              <div style="display:flex; flex-direction:column; gap:6px">
                <ElInputNumber
                  :model-value="receiveForm.items[$index]?.gross_weight ?? 0"
                  :min="0.001" :precision="3" size="small"
                  @update:model-value="setWeight($index, 'gross_weight', $event)"
                />
                <ElInputNumber
                  :model-value="receiveForm.items[$index]?.net_weight ?? 0"
                  :min="0.001" :precision="3" size="small"
                  @update:model-value="setWeight($index, 'net_weight', $event)"
                />
              </div>
            </template>
            {{ row.sale_type === 'WEIGHT' ? `毛重 / 净重（${row.purchase_unit}）` : row.purchase_unit }}
          </template>
        </ElTableColumn>
        <ElTableColumn label="采购价" width="110">
          <template #default="{ row }">¥{{ row.purchase_price }}</template>
        </ElTableColumn>
      </ElTable>
      <ElInput
        v-model="receiveForm.remark"
        type="textarea"
        :rows="2"
        placeholder="到货备注"
        style="margin-top:16px"
      />
      <template #footer>
        <ElButton @click="receiveDialog = false">取消</ElButton>
        <ElButton type="primary" @click="receive">确认入库</ElButton>
      </template>
    </ElDialog>

    <ElDrawer v-model="detailDrawer" title="采购单详情" size="620">
      <template v-if="activeOrder">
        <ElDescriptions :column="2" border>
          <ElDescriptionsItem label="采购单号">{{ activeOrder.purchase_no }}</ElDescriptionsItem>
          <ElDescriptionsItem label="状态">{{ statusLabels[activeOrder.status] }}</ElDescriptionsItem>
          <ElDescriptionsItem label="供应商">{{ activeOrder.supplier_name }}</ElDescriptionsItem>
          <ElDescriptionsItem label="仓库">{{ activeOrder.warehouse_name }}</ElDescriptionsItem>
          <ElDescriptionsItem label="采购金额">¥{{ activeOrder.total_amount }}</ElDescriptionsItem>
          <ElDescriptionsItem label="采购日期">{{ activeOrder.purchase_date || "—" }}</ElDescriptionsItem>
          <ElDescriptionsItem label="到货时间">{{ activeOrder.arrived_at || "—" }}</ElDescriptionsItem>
          <ElDescriptionsItem label="入库时间">{{ activeOrder.received_at || "—" }}</ElDescriptionsItem>
        </ElDescriptions>
        <ElTable :data="activeOrder.items" style="margin-top:20px">
          <ElTableColumn prop="product_name" label="商品" />
          <ElTableColumn prop="sku_name" label="SKU" />
          <ElTableColumn prop="ordered_quantity" label="采购数量" />
          <ElTableColumn prop="received_quantity" label="入库数量" />
          <ElTableColumn prop="purchase_price" label="历史采购价" />
        </ElTable>
      </template>
    </ElDrawer>
  </section>
</template>
