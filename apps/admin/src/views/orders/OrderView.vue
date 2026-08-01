<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import {
  orderApi,
  type AdminOrder,
} from '@/api/orders';

const loading = ref(false);
const detailLoading = ref(false);
const drawerVisible = ref(false);
const orders = ref<AdminOrder[]>([]);
const detail = ref<AdminOrder | null>(null);
const total = ref(0);
const query = reactive({
  status: '',
  keyword: '',
  page: 1,
  page_size: 20,
});

const statusText: Record<string, string> = {
  CREATED: '已创建',
  WAITING_REVIEW: '待仓库审核',
  APPROVED: '已审核',
  PICKING: '备货中',
  WEIGHING: '称重中',
  WAITING_DELIVERY: '待配送',
  DELIVERING: '配送中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

async function load(): Promise<void> {
  loading.value = true;
  try {
    const result = await orderApi.list({
      ...query,
      status: query.status || undefined,
      keyword: query.keyword || undefined,
    });
    orders.value = result.items;
    total.value = result.pagination.total;
  } finally {
    loading.value = false;
  }
}

async function openDetail(row: AdminOrder): Promise<void> {
  drawerVisible.value = true;
  detailLoading.value = true;
  try {
    detail.value = await orderApi.detail(row.id);
  } finally {
    detailLoading.value = false;
  }
}

async function approve(): Promise<void> {
  if (!detail.value) return;
  await ElMessageBox.confirm('确认该订单商品与库存信息无误？', '审核通过', {
    type: 'success',
  });
  detail.value = await orderApi.review(detail.value.id, 'APPROVE');
  ElMessage.success('订单审核通过');
  await load();
}

async function reject(): Promise<void> {
  if (!detail.value) return;
  const result = await ElMessageBox.prompt('请输入拒绝原因', '拒绝订单', {
    inputPattern: /\S+/,
    inputErrorMessage: '必须填写拒绝原因',
    type: 'warning',
  });
  detail.value = await orderApi.review(
    detail.value.id,
    'REJECT',
    result.value,
  );
  ElMessage.success('订单已拒绝，库存已释放');
  await load();
}

onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">WAREHOUSE REVIEW</p>
        <h1>订单管理</h1>
      </div>
    </div>

    <div class="management-card">
      <div class="toolbar">
        <div class="toolbar-group">
          <ElInput
            v-model="query.keyword"
            clearable
            placeholder="订单号或客户名称"
            style="width: 260px"
            @keyup.enter="load"
          />
          <ElSelect
            v-model="query.status"
            clearable
            placeholder="全部状态"
            style="width: 170px"
          >
            <ElOption
              v-for="(label, value) in statusText"
              :key="value"
              :label="label"
              :value="value"
            />
          </ElSelect>
          <ElButton type="primary" @click="load">查询</ElButton>
        </div>
        <span class="muted">共 {{ total }} 笔订单</span>
      </div>

      <ElTable v-loading="loading" :data="orders">
        <ElTableColumn prop="order_no" label="订单号" min-width="210" />
        <ElTableColumn prop="customer_name" label="客户" min-width="150" />
        <ElTableColumn prop="warehouse_name" label="仓库" width="140" />
        <ElTableColumn label="预计金额" width="120">
          <template #default="{ row }">¥{{ row.estimated_amount }}</template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="130">
          <template #default="{ row }">
            <ElTag
              :type="
                row.status === 'WAITING_REVIEW'
                  ? 'warning'
                  : row.status === 'CANCELLED'
                    ? 'info'
                    : 'success'
              "
            >
              {{ statusText[row.status] }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="created_at" label="提交时间" width="185" />
        <ElTableColumn label="操作" width="100">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openDetail(row)">
              查看
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <ElPagination
        v-model:current-page="query.page"
        v-model:page-size="query.page_size"
        :total="total"
        layout="prev, pager, next, total"
        style="margin-top: 18px; justify-content: flex-end"
        @current-change="load"
      />
    </div>

    <ElDrawer
      v-model="drawerVisible"
      title="订单详情"
      size="680px"
    >
      <div v-loading="detailLoading">
        <template v-if="detail">
          <ElDescriptions :column="2" border>
            <ElDescriptionsItem label="订单号">
              {{ detail.order_no }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="状态">
              {{ statusText[detail.status] }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="客户">
              {{ detail.customer_name }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="仓库">
              {{ detail.warehouse_name }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="预计金额">
              ¥{{ detail.estimated_amount }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="最终金额">
              {{ detail.final_amount ? `¥${detail.final_amount}` : '待后续确认' }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="最终商品金额">
              {{ detail.final_product_amount ? `¥${detail.final_product_amount}` : '待履约' }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="优惠金额">
              -¥{{ detail.final_amount ? detail.discount_amount : detail.estimated_discount_amount }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="运费">
              ¥{{ detail.shipping_fee }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="配送状态">
              {{ detail.delivery?.status || '尚未生成配送单' }}
            </ElDescriptionsItem>
            <ElDescriptionsItem label="客户备注" :span="2">
              {{ detail.remark || '无' }}
            </ElDescriptionsItem>
          </ElDescriptions>

          <h3 style="margin-top: 24px">商品明细</h3>
          <ElTable :data="detail.items">
            <ElTableColumn prop="product_name" label="商品" min-width="130" />
            <ElTableColumn prop="sku_name" label="规格" min-width="120" />
            <ElTableColumn label="采购量" width="110">
              <template #default="{ row }">
                {{
                  row.sale_type === 'PIECE'
                    ? row.planned_quantity
                    : row.planned_weight
                }}
                {{ row.unit }}
              </template>
            </ElTableColumn>
            <ElTableColumn label="单价" width="110">
              <template #default="{ row }">
                ¥{{ row.unit_price }}/{{ row.unit }}
              </template>
            </ElTableColumn>
            <ElTableColumn prop="estimated_amount" label="预计金额" width="110" />
          </ElTable>

          <h3 style="margin-top: 24px">状态记录</h3>
          <ElTimeline>
            <ElTimelineItem
              v-for="log in detail.status_logs"
              :key="log.id"
              :timestamp="log.created_at"
            >
              {{ statusText[log.to_status] || log.to_status }}
              <span class="muted"> · {{ log.remark }}</span>
            </ElTimelineItem>
          </ElTimeline>

          <div
            v-if="detail.status === 'WAITING_REVIEW'"
            v-permission="'order.review'"
            class="toolbar-group"
            style="justify-content: flex-end"
          >
            <ElButton type="danger" plain @click="reject">拒绝订单</ElButton>
            <ElButton type="primary" @click="approve">审核通过</ElButton>
          </div>
        </template>
      </div>
    </ElDrawer>
  </section>
</template>
