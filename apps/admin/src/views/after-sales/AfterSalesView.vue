<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { afterSalesApi, type AfterSale } from '@/api/after-sales';

const rows = ref<AfterSale[]>([]);
const total = ref(0);
const loading = ref(false);
const detail = ref<AfterSale | null>(null);
const visible = ref(false);
const query = reactive({ keyword: '', status: '', page: 1, page_size: 20 });
const labels: Record<string, string> = { PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回', PROCESSING: '处理中', COMPLETED: '已完成', CANCELLED: '已取消' };

async function load() { loading.value = true; try { const result = await afterSalesApi.list(query); rows.value = result.items; total.value = result.pagination.total; } finally { loading.value = false; } }
async function open(row: AfterSale) { detail.value = await afterSalesApi.detail(row.id); visible.value = true; }
function setApprovedQuantity(item: NonNullable<AfterSale['items']>[number], value: number | undefined) { item.approved_quantity = String(value ?? 0); }
function setApprovedWeight(item: NonNullable<AfterSale['items']>[number], value: number | undefined) { item.approved_weight = String(value ?? 0); }
function setRefundAmount(value: number | undefined) { if (detail.value) detail.value.refund_amount = String(value ?? 0); }
async function approve() { if (!detail.value) return; const items = detail.value.items?.map((item) => ({ id: item.id, ...(item.sale_type === 'PIECE' ? { approved_quantity: Number(item.approved_quantity ?? item.quantity) } : { approved_weight: Number(item.approved_weight ?? item.requested_weight) }) })); detail.value = await afterSalesApi.approve(detail.value.id, { items, refund_amount: Number(detail.value.refund_amount) }); ElMessage.success('售后已审核通过'); await load(); }
async function reject() { if (!detail.value) return; const { value } = await ElMessageBox.prompt('请输入驳回原因', '驳回售后', { inputValidator: (text) => Boolean(text?.trim()) || '请输入驳回原因' }); detail.value = await afterSalesApi.reject(detail.value.id, value); ElMessage.success('售后已驳回'); await load(); }
async function complete() { if (!detail.value) return; await ElMessageBox.confirm('确认退款/补偿已线下处理完成？此操作不修改原订单金额。', '完成售后'); detail.value = await afterSalesApi.complete(detail.value.id); ElMessage.success('售后已完成'); await load(); }
onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading"><div><p class="eyebrow">AFTER SALES</p><h1>售后管理</h1></div></div>
    <div class="management-card">
      <ElForm inline><ElFormItem label="搜索"><ElInput v-model="query.keyword" placeholder="售后单/订单/客户" clearable /></ElFormItem><ElFormItem label="状态"><ElSelect v-model="query.status" clearable style="width:150px"><ElOption v-for="(label, key) in labels" :key="key" :label="label" :value="key" /></ElSelect></ElFormItem><ElButton type="primary" @click="query.page = 1; load()">查询</ElButton></ElForm>
      <ElTable v-loading="loading" :data="rows">
        <ElTableColumn prop="after_sale_no" label="售后单号" min-width="175" /><ElTableColumn prop="order_no" label="订单号" min-width="155" /><ElTableColumn prop="customer_name" label="客户" min-width="130" />
        <ElTableColumn label="原因" width="120"><template #default="scope">{{ scope.row.reason?.name }}</template></ElTableColumn>
        <ElTableColumn label="退款/补偿" width="120"><template #default="scope">¥{{ scope.row.refund_amount }}</template></ElTableColumn>
        <ElTableColumn label="状态" width="100"><template #default="scope">{{ labels[scope.row.status] ?? scope.row.status }}</template></ElTableColumn>
        <ElTableColumn prop="created_at" label="申请时间" min-width="170" /><ElTableColumn label="操作" width="90"><template #default="scope"><ElButton link type="primary" @click="open(scope.row)">详情</ElButton></template></ElTableColumn>
      </ElTable>
      <ElPagination v-model:current-page="query.page" v-model:page-size="query.page_size" :page-sizes="[20,50,100]" :total="total" layout="total,sizes,prev,pager,next,jumper" @current-change="load" @size-change="load" />
    </div>
    <ElDrawer v-model="visible" title="售后详情" size="720px">
      <div v-if="detail">
        <ElDescriptions :column="2" border><ElDescriptionsItem label="售后单">{{ detail.after_sale_no }}</ElDescriptionsItem><ElDescriptionsItem label="订单号">{{ detail.order_no }}</ElDescriptionsItem><ElDescriptionsItem label="客户">{{ detail.customer_name }}</ElDescriptionsItem><ElDescriptionsItem label="原因">{{ detail.reason?.name }}</ElDescriptionsItem><ElDescriptionsItem label="问题说明" :span="2">{{ detail.description || '-' }}</ElDescriptionsItem></ElDescriptions>
        <h3>售后商品</h3>
        <ElTable :data="detail.items">
          <ElTableColumn prop="product_name" label="商品" /><ElTableColumn prop="sku_name" label="SKU" />
          <ElTableColumn label="申请"><template #default="scope">{{ scope.row.sale_type === 'PIECE' ? scope.row.quantity : scope.row.requested_weight }} {{ scope.row.unit }}</template></ElTableColumn>
          <ElTableColumn label="核准" width="165"><template #default="scope"><template v-if="detail.status === 'PENDING'"><ElInputNumber v-if="scope.row.sale_type === 'PIECE'" :model-value="Number(scope.row.approved_quantity ?? scope.row.quantity)" :min="0" :max="Number(scope.row.quantity)" :precision="0" @update:model-value="setApprovedQuantity(scope.row, $event)" /><ElInputNumber v-else :model-value="Number(scope.row.approved_weight ?? scope.row.requested_weight)" :min="0" :max="Number(scope.row.requested_weight)" :precision="3" @update:model-value="setApprovedWeight(scope.row, $event)" /></template><span v-else>{{ scope.row.sale_type === 'PIECE' ? scope.row.approved_quantity : scope.row.approved_weight }} {{ scope.row.unit }}</span></template></ElTableColumn>
          <ElTableColumn label="退款单价"><template #default="scope">¥{{ scope.row.refund_price }}/{{ scope.row.unit }}</template></ElTableColumn>
        </ElTable>
        <h3>问题凭证</h3><div class="media"><template v-for="item in detail.media" :key="item.id"><ElImage v-if="item.media_type === 'IMAGE'" :src="item.url" :preview-src-list="detail.media?.filter((row) => row.media_type === 'IMAGE').map((row) => row.url)" fit="cover" /><video v-else controls :poster="item.thumbnail_url || undefined" :src="item.url" /></template></div>
        <p>核准退款/补偿：<ElInputNumber v-if="detail.status === 'PENDING'" :model-value="Number(detail.refund_amount)" :min="0" :precision="2" @update:model-value="setRefundAmount" /><strong v-else>¥{{ detail.refund_amount }}</strong></p><p v-if="detail.review_remark">审核说明：{{ detail.review_remark }}</p>
      </div>
      <template #footer><ElButton v-if="detail?.status === 'PENDING'" type="danger" @click="reject">驳回</ElButton><ElButton v-if="detail?.status === 'PENDING'" type="primary" @click="approve">审核通过</ElButton><ElButton v-if="detail && ['APPROVED', 'PROCESSING'].includes(detail.status)" type="success" @click="complete">确认退款完成</ElButton></template>
    </ElDrawer>
  </section>
</template>

<style scoped>.management-card{padding:20px}.media{display:flex;flex-wrap:wrap;gap:12px}.media .el-image,.media video{width:140px;height:120px;border-radius:8px;object-fit:cover}.el-pagination{margin-top:18px;justify-content:flex-end}</style>
