<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const activeMenu = computed(() => route.path);
const biMenus = computed(() => {
  const role=auth.principal?.role_code;
  const all:Array<[string,string]>=[['/bi/inventory','库存分析'],['/bi/delivery','配送分析'],['/bi/finance','财务分析'],['/bi/salespersons','业务员分析'],['/bi/customers','客户分析'],['/bi/products','商品分析'],['/bi/purchases','采购分析']];
  const scoped:Record<string,string[]>={SALES:['/bi/salespersons','/bi/customers','/bi/products','/bi/finance'],PURCHASER:['/bi/purchases','/bi/products'],WAREHOUSE:['/bi/inventory'],DELIVERY:['/bi/delivery'],OPERATIONS:['/bi/inventory','/bi/customers','/bi/products']};
  return role==='ADMIN'||role==='FINANCE'?all:all.filter(([path])=>(scoped[role??'']??[]).includes(path));
});

async function logout(): Promise<void> {
  await auth.logout();
  await router.replace('/login');
}
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="brand">
        <span class="brand-mark">鲜</span>
        <div>
          <strong>鲜链云</strong>
          <small>水果批发 B2B</small>
        </div>
      </div>

      <ElMenu
        :default-active="activeMenu"
        router
        background-color="transparent"
        text-color="#cbd5e1"
        active-text-color="#ffffff"
      >
        <ElMenuItem index="/dashboard">数据看板</ElMenuItem>
        <ElSubMenu v-permission="'product.read'" index="product-center">
          <template #title>商品中心</template>
          <ElMenuItem index="/products">商品列表</ElMenuItem>
          <ElMenuItem index="/categories">分类管理</ElMenuItem>
        </ElSubMenu>
        <ElSubMenu v-permission="'home.operation.manage'" index="operations">
          <template #title>运营中心</template>
          <ElMenuItem index="/home-operations">首页管理</ElMenuItem>
        </ElSubMenu>
        <ElSubMenu v-permission="'customer.center.read'" index="customer-center"><template #title>客户中心</template>
          <ElMenuItem index="/customer-archives">客户档案</ElMenuItem><ElMenuItem index="/customer-types">客户类型</ElMenuItem>
          <ElMenuItem index="/customer-groups">集团管理</ElMenuItem><ElMenuItem index="/customer-tags">客户标签</ElMenuItem>
          <ElMenuItem index="/customer-dashboard">客户看板</ElMenuItem><ElMenuItem index="/customer-orders">下单情况</ElMenuItem>
          <ElMenuItem index="/customer-history">订货历史</ElMenuItem><ElMenuItem index="/customer-agreements">协议价</ElMenuItem>
          <ElMenuItem index="/customer-credit">信用管理</ElMenuItem>
        </ElSubMenu>
        <ElSubMenu
          v-if="
            auth.hasPermission('supplier.manage') ||
            auth.hasPermission('purchase.read') ||
            auth.hasPermission('cost.read') ||
            auth.hasPermission('inventory.alert.read')
          "
          index="procurement-center"
        >
          <template #title>采购中心</template>
          <ElMenuItem v-permission="'purchase.read'" index="/purchases">
            采购订单
          </ElMenuItem>
          <ElMenuItem v-permission="'purchase.read'" index="/purchase-returns">采购退货</ElMenuItem>
          <ElMenuItem v-permission="'purchase.read'" index="/purchase-history">采购历史</ElMenuItem>
          <ElMenuItem v-permission="'purchase.price.read'" index="/purchase-prices">采购价格</ElMenuItem>
          <ElMenuItem v-permission="'supplier.manage'" index="/suppliers">供应商管理</ElMenuItem>
          <ElMenuItem v-permission="'purchase.read'" index="/supplier-products">供应商商品库</ElMenuItem>
          <ElMenuItem v-permission="'purchase.read'" index="/purchasers">采购员管理</ElMenuItem>
          <ElMenuItem v-permission="'purchase.plan.manage'" index="/purchase-plans">采购计划</ElMenuItem>
          <ElMenuItem v-permission="'purchase.analysis.read'" index="/purchase-analysis">采购分析</ElMenuItem>
        </ElSubMenu>
        <ElSubMenu
          v-if="auth.hasPermission('cost.read') || auth.hasPermission('inventory.alert.read')"
          index="supply-chain-analysis"
        >
          <template #title>经营分析</template>
          <ElMenuItem v-permission="'cost.read'" index="/cost-profit">成本与毛利分析</ElMenuItem>
          <ElMenuItem v-permission="'inventory.alert.read'" index="/inventory-planning">库存预警与采购建议</ElMenuItem>
        </ElSubMenu>
        <ElMenuItem v-permission="'order.read'" index="/orders">
          订单管理
        </ElMenuItem>
        <ElSubMenu v-permission="'after.sale.read'" index="after-sales-center">
          <template #title>售后服务</template>
          <ElMenuItem index="/after-sales">售后管理</ElMenuItem>
          <ElMenuItem v-permission="'after.sale.reason.manage'" index="/after-sale-reasons">售后原因设置</ElMenuItem>
        </ElSubMenu>
        <ElSubMenu
          v-if="
            auth.hasPermission('warehouse.task.read') ||
            auth.hasPermission('order.fulfill')
          "
          index="warehouse"
        >
          <template #title>仓库管理</template>
          <ElMenuItem v-permission="'warehouse.task.read'" index="/warehouse-tasks">
            仓库任务
          </ElMenuItem>
          <ElMenuItem v-permission="'order.fulfill'" index="/weighing">
            称重与履约
          </ElMenuItem>
        </ElSubMenu>
        <ElMenuItem v-permission="'coupon.manage'" index="/coupons">
          优惠券管理
        </ElMenuItem>
        <ElMenuItem v-permission="'delivery.read'" index="/deliveries">
          配送管理
        </ElMenuItem>
        <ElMenuItem
          v-if="auth.principal?.role_code === 'DELIVERY'"
          v-permission="'delivery.read'"
          index="/delivery-mobile"
        >
          今日配送
        </ElMenuItem>
        <ElMenuItem v-permission="'shipping.manage'" index="/trading-config">
          交易配置
        </ElMenuItem>
        <ElMenuItem v-permission="'finance.read'" index="/finance">
          财务管理
        </ElMenuItem>
        <ElMenuItem
          v-permission="'system.security.read'"
          index="/foundation"
        >
          安全与权限
        </ElMenuItem>
        <ElMenuItem v-permission="'operation_log.read'" index="/operation-logs">
          操作日志
        </ElMenuItem>
        <ElSubMenu v-permission="'report.read'" index="report-center"><template #title>报表中心</template>
          <ElMenuItem index="/reports/business">营业报表</ElMenuItem><ElMenuItem index="/reports/products">商品销售</ElMenuItem>
          <ElMenuItem index="/reports/orders">订单统计</ElMenuItem><ElMenuItem index="/reports/customers">客户统计</ElMenuItem>
          <ElMenuItem index="/reports/purchases">采购统计</ElMenuItem><ElMenuItem index="/reports/estimated-margin">预计毛利</ElMenuItem>
          <ElMenuItem index="/reports/sales-margin">销售毛利</ElMenuItem><ElMenuItem index="/reports/profit">利润报表</ElMenuItem>
        </ElSubMenu>
        <ElSubMenu v-permission="'bi.report.read'" index="bi-center"><template #title>BI报表中心</template>
          <ElMenuItem v-for="item in biMenus" :key="item[0]" :index="item[0]">{{item[1]}}</ElMenuItem>
        </ElSubMenu>
        <ElMenuItem v-permission="'bi.screen.read'" index="/business-screen">经营大屏</ElMenuItem>
      </ElMenu>
    </aside>

    <section class="admin-main">
      <header class="admin-header">
        <div>
          <strong>{{ route.meta.title }}</strong>
          <span class="environment-badge">
            {{ auth.principal?.display_name }} · {{ auth.principal?.role_code }}
          </span>
        </div>
        <ElButton text @click="logout">退出</ElButton>
      </header>

      <main class="admin-content">
        <RouterView />
      </main>
    </section>
  </div>
</template>
