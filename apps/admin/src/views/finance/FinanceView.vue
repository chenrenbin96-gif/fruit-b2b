<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';

import {
  financeApi,
  type CreditCustomer,
  type Payment,
  type Receivable,
  type FinancialReport,
  type MonthlyStatement,
} from '@/api/finance';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const active = ref('credit');
const customers = ref<CreditCustomer[]>([]);
const receivables = ref<Receivable[]>([]);
const payments = ref<Payment[]>([]);
const report = ref<FinancialReport | null>(null);
const statement = ref<MonthlyStatement | null>(null);
const reportPeriod = ref<'DAY' | 'WEEK' | 'MONTH'>('MONTH');
const reportDate = ref(new Date().toISOString().slice(0, 10));
const statementCustomer = ref('');
const statementMonth = ref(new Date().toISOString().slice(0, 7));
const receivableCustomer = ref('');
const receivableStatus = ref('');
const receivableDates = ref<[string, string] | null>(null);
const creditForms = reactive<Record<string, { enabled: boolean; limit: number; days: number }>>({});
const paymentVisible = ref(false);
const paymentForm = reactive({
  customer_id: '',
  amount: 0,
  payment_method: 'BANK_TRANSFER',
  payment_time: new Date().toISOString().slice(0, 19),
  remark: '',
});

async function load() {
  const [customerRows, billRows, paymentRows] = await Promise.all([
    financeApi.customers(),
    financeApi.receivables(),
    financeApi.payments(),
  ]);
  customers.value = customerRows;
  receivables.value = billRows;
  payments.value = paymentRows;
  customerRows.forEach((item) => {
    creditForms[item.customer_id] = {
      enabled: item.credit_enabled,
      limit: Number(item.credit_limit),
      days: item.credit_days,
    };
  });
}

async function loadReceivables() {
  receivables.value = await financeApi.receivables({
    customer_id: receivableCustomer.value || undefined,
    status: receivableStatus.value || undefined,
    start_time: receivableDates.value?.[0],
    end_time: receivableDates.value?.[1],
  });
}

async function loadReport() {
  report.value = await financeApi.report(reportPeriod.value, reportDate.value);
}

async function loadStatement() {
  if (!statementCustomer.value) return;
  statement.value = await financeApi.statement(
    statementCustomer.value,
    statementMonth.value,
  );
}

function creditForm(id: string) {
  return creditForms[id]!;
}

async function saveCredit(row: CreditCustomer) {
  const form = creditForm(row.customer_id);
  await financeApi.updateCredit(row.customer_id, {
    credit_enabled: form.enabled,
    credit_limit: form.limit,
    credit_days: form.days,
  });
  ElMessage.success('客户账期已更新');
  await load();
}

function openPayment(row?: CreditCustomer) {
  paymentForm.customer_id = row?.customer_id ?? '';
  paymentForm.amount = row ? Number(row.balance_due) : 0;
  paymentForm.payment_method = 'BANK_TRANSFER';
  paymentForm.payment_time = new Date().toISOString().slice(0, 19);
  paymentForm.remark = '';
  paymentVisible.value = true;
}

async function submitPayment() {
  await financeApi.createPayment({
    ...paymentForm,
    payment_time: new Date(paymentForm.payment_time).toISOString(),
  });
  paymentVisible.value = false;
  ElMessage.success('收款已登记并核销应收');
  await load();
}

const methodLabels: Record<string, string> = {
  CASH: '现金',
  BANK_TRANSFER: '银行转账',
  WECHAT: '微信',
  ALIPAY: '支付宝',
};

onMounted(load);
</script>

<template>
  <section>
    <div class="page-heading">
      <div><p class="eyebrow">FINANCE</p><h1>财务管理</h1></div>
      <ElButton
        v-if="auth.hasPermission('finance.payment.create')"
        type="primary"
        @click="openPayment()"
      >
        登记收款
      </ElButton>
    </div>
    <div class="management-card">
      <ElTabs v-model="active">
        <ElTabPane label="客户账期与欠款" name="credit">
          <ElTable :data="customers">
            <ElTableColumn prop="customer_name" label="客户" min-width="150" />
            <ElTableColumn label="启用信用" width="110">
              <template #default="{ row }"><ElSwitch v-model="creditForm(row.customer_id).enabled" /></template>
            </ElTableColumn>
            <ElTableColumn label="信用额度" width="170">
              <template #default="{ row }"><ElInputNumber v-model="creditForm(row.customer_id).limit" :min="0" :precision="2" /></template>
            </ElTableColumn>
            <ElTableColumn label="账期天数" width="150">
              <template #default="{ row }"><ElInputNumber v-model="creditForm(row.customer_id).days" :min="0" :max="3650" /></template>
            </ElTableColumn>
            <ElTableColumn prop="balance_due" label="当前欠款" width="120" />
            <ElTableColumn prop="available_credit" label="可用额度" width="120" />
            <ElTableColumn prop="overdue_amount" label="逾期金额" width="120" />
            <ElTableColumn label="操作" width="150">
              <template #default="{ row }">
                <ElButton
                  v-if="auth.hasPermission('finance.credit.manage')"
                  link type="primary" @click="saveCredit(row)"
                >保存</ElButton>
                <ElButton
                  v-if="auth.hasPermission('finance.payment.create') && Number(row.balance_due) > 0"
                  link type="success" @click="openPayment(row)"
                >收款</ElButton>
              </template>
            </ElTableColumn>
          </ElTable>
        </ElTabPane>
        <ElTabPane label="应收账单" name="receivables">
          <div style="display:flex;gap:10px;margin-bottom:14px">
            <ElSelect v-model="receivableCustomer" clearable filterable placeholder="客户" style="width:180px">
              <ElOption v-for="item in customers" :key="item.customer_id" :label="item.customer_name" :value="item.customer_id" />
            </ElSelect>
            <ElDatePicker v-model="receivableDates" type="daterange" value-format="YYYY-MM-DD" />
            <ElSelect v-model="receivableStatus" clearable placeholder="逾期状态" style="width:140px">
              <ElOption label="未付款" value="UNPAID" /><ElOption label="部分付款" value="PARTIALLY_PAID" />
              <ElOption label="已付款" value="PAID" /><ElOption label="已逾期" value="OVERDUE" />
            </ElSelect>
            <ElButton @click="loadReceivables">查询</ElButton>
          </div>
          <ElTable :data="receivables">
            <ElTableColumn prop="receivable_no" label="账单号" min-width="190" />
            <ElTableColumn prop="customer_name" label="客户" width="140" />
            <ElTableColumn prop="customer_level" label="等级" width="90" />
            <ElTableColumn prop="order_no" label="订单号" min-width="190" />
            <ElTableColumn prop="final_amount" label="最终金额" width="110" />
            <ElTableColumn prop="shipping_fee" label="运费" width="90" />
            <ElTableColumn prop="discount_amount" label="优惠" width="90" />
            <ElTableColumn prop="paid_amount" label="已收" width="100" />
            <ElTableColumn prop="remaining_amount" label="未收" width="100" />
            <ElTableColumn prop="credit_days" label="账期天数" width="90" />
            <ElTableColumn prop="overdue_amount" label="逾期金额" width="100" />
            <ElTableColumn prop="term_status" label="账期" width="90" />
            <ElTableColumn prop="due_date" label="到期时间" min-width="180" />
          </ElTable>
        </ElTabPane>
        <ElTabPane label="客户对账" name="statement">
          <div style="display:flex;gap:10px;margin-bottom:16px">
            <ElSelect v-model="statementCustomer" filterable placeholder="选择客户" style="width:220px">
              <ElOption v-for="item in customers" :key="item.customer_id" :label="item.customer_name" :value="item.customer_id" />
            </ElSelect>
            <ElDatePicker v-model="statementMonth" type="month" value-format="YYYY-MM" />
            <ElButton @click="loadStatement">生成对账单</ElButton>
            <ElButton v-if="statement" type="primary" @click="financeApi.downloadStatement(statementCustomer, statementMonth)">导出PDF</ElButton>
          </div>
          <ElDescriptions v-if="statement" :column="3" border>
            <ElDescriptionsItem label="销售金额">¥{{ statement.summary.sales_amount }}</ElDescriptionsItem>
            <ElDescriptionsItem label="已收">¥{{ statement.summary.paid_amount }}</ElDescriptionsItem>
            <ElDescriptionsItem label="欠款">¥{{ statement.summary.remaining_amount }}</ElDescriptionsItem>
          </ElDescriptions>
          <ElTable v-if="statement" :data="statement.items" style="margin-top:16px">
            <ElTableColumn prop="order_no" label="订单号" /><ElTableColumn prop="bill_date" label="订单日期" />
            <ElTableColumn prop="final_amount" label="订单金额" /><ElTableColumn prop="paid_amount" label="已收" />
            <ElTableColumn prop="remaining_amount" label="未收" />
          </ElTable>
        </ElTabPane>
        <ElTabPane label="财务报表" name="report">
          <div style="display:flex;gap:10px;margin-bottom:16px">
            <ElRadioGroup v-model="reportPeriod"><ElRadioButton value="DAY">日</ElRadioButton><ElRadioButton value="WEEK">周</ElRadioButton><ElRadioButton value="MONTH">月</ElRadioButton></ElRadioGroup>
            <ElDatePicker v-model="reportDate" type="date" value-format="YYYY-MM-DD" />
            <ElButton @click="loadReport">统计</ElButton>
          </div>
          <div v-if="report" class="report-grid">
            <ElStatistic title="销售额" :value="Number(report.sales_amount)" prefix="¥" />
            <ElStatistic title="采购成本" :value="Number(report.purchase_cost)" prefix="¥" />
            <ElStatistic title="毛利" :value="Number(report.gross_profit)" prefix="¥" />
            <ElStatistic title="毛利率" :value="Number(report.gross_margin_rate)" suffix="%" />
            <ElStatistic title="应收账款" :value="Number(report.receivables)" prefix="¥" />
            <ElStatistic title="现金收入" :value="Number(report.cash_income)" prefix="¥" />
          </div>
        </ElTabPane>
        <ElTabPane label="收款记录" name="payments">
          <ElTable :data="payments">
            <ElTableColumn prop="payment_no" label="收款单号" min-width="190" />
            <ElTableColumn prop="customer_name" label="客户" width="150" />
            <ElTableColumn prop="amount" label="金额" width="110" />
            <ElTableColumn label="方式" width="110">
              <template #default="{ row }">{{ methodLabels[row.payment_method] }}</template>
            </ElTableColumn>
            <ElTableColumn prop="payment_time" label="收款时间" min-width="180" />
            <ElTableColumn prop="operator_name" label="操作人" width="110" />
            <ElTableColumn prop="remark" label="备注" min-width="160" />
          </ElTable>
        </ElTabPane>
      </ElTabs>
    </div>

    <ElDialog v-model="paymentVisible" title="登记线下收款" width="520px">
      <ElForm label-width="90px">
        <ElFormItem label="客户">
          <ElSelect v-model="paymentForm.customer_id" filterable style="width: 100%">
            <ElOption
              v-for="item in customers" :key="item.customer_id"
              :label="`${item.customer_name}（欠款 ¥${item.balance_due}）`"
              :value="item.customer_id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="收款金额"><ElInputNumber v-model="paymentForm.amount" :min="0.01" :precision="2" style="width: 100%" /></ElFormItem>
        <ElFormItem label="付款方式">
          <ElSelect v-model="paymentForm.payment_method" style="width: 100%">
            <ElOption label="现金" value="CASH" />
            <ElOption label="银行转账" value="BANK_TRANSFER" />
            <ElOption label="微信" value="WECHAT" />
            <ElOption label="支付宝" value="ALIPAY" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="收款时间"><ElInput v-model="paymentForm.payment_time" type="datetime-local" /></ElFormItem>
        <ElFormItem label="备注"><ElInput v-model="paymentForm.remark" type="textarea" /></ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="paymentVisible = false">取消</ElButton><ElButton type="primary" @click="submitPayment">确认登记</ElButton></template>
    </ElDialog>
  </section>
</template>

<style scoped>
.report-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.report-grid>*{padding:20px;border:1px solid #e5ebe7;border-radius:12px}
</style>
