<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const activeMenu = computed(() => route.path);

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
