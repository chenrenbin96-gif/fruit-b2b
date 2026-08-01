import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

import { installRouterGuards } from './guards';
import { pinia } from '@/stores';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/LoginView.vue'),
    meta: { public: true, title: '登录' },
  },
  {
    path: '/',
    component: () => import('@/layout/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard',
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/dashboard/DashboardView.vue'),
        meta: { title: '数据看板', permission: 'dashboard.read' },
      },
      {
        path: 'foundation',
        name: 'foundation',
        component: () => import('@/views/foundation/FoundationView.vue'),
        meta: { title: '安全与权限', permission: 'system.security.read' },
      },
      {
        path: 'operation-logs',
        name: 'operation-logs',
        component: () => import('@/views/foundation/OperationLogView.vue'),
        meta: { title: '操作日志', permission: 'operation_log.read' },
      },
      {
        path: 'categories',
        name: 'categories',
        component: () => import('@/views/catalog/CategoryView.vue'),
        meta: { title: '分类管理', permission: 'product.read' },
      },
      {
        path: 'products',
        name: 'products',
        component: () => import('@/views/catalog/ProductView.vue'),
        meta: { title: '商品中心 / 商品列表', permission: 'product.read' },
      },
      {
        path: 'products/:id',
        name: 'product-workbench',
        component: () =>
          import('@/views/catalog/ProductWorkbenchView.vue'),
        meta: { title: '商品中心 / 商品编辑工作台', permission: 'product.read' },
      },
      {
        path: 'home-operations',
        name: 'home-operations',
        component: () => import('@/views/catalog/HomeOperationsView.vue'),
        meta: {
          title: '运营中心 / 首页管理',
          permission: 'home.operation.manage',
        },
      },
      {
        path: 'skus',
        name: 'skus',
        component: () => import('@/views/catalog/SkuView.vue'),
        meta: { title: 'SKU管理', permission: 'product.read' },
      },
      {
        path: 'inventory',
        name: 'inventory',
        component: () => import('@/views/catalog/InventoryView.vue'),
        meta: { title: '库存管理', permission: 'inventory.read' },
      },
      {
        path: 'prices',
        name: 'prices',
        component: () => import('@/views/catalog/PriceView.vue'),
        meta: { title: '价格管理', permission: 'price.read' },
      },
      {
        path: 'suppliers',
        name: 'suppliers',
        component: () => import('@/views/procurement/SupplierView.vue'),
        meta: { title: '供应商管理', permission: 'supplier.manage' },
      },
      {
        path: 'purchases',
        name: 'purchases',
        component: () => import('@/views/procurement/PurchaseView.vue'),
        meta: { title: '采购中心 / 采购订单', permission: 'purchase.read' },
      },
      { path: 'purchase-returns', component: () => import('@/views/procurement/PurchaseCenterView.vue'), meta: { title: '采购中心 / 采购退货', permission: 'purchase.read', procurementMode: 'returns' } },
      { path: 'purchase-history', component: () => import('@/views/procurement/PurchaseCenterView.vue'), meta: { title: '采购中心 / 采购历史', permission: 'purchase.read', procurementMode: 'history' } },
      { path: 'purchase-prices', component: () => import('@/views/procurement/PurchaseCenterView.vue'), meta: { title: '采购中心 / 采购价格', permission: 'purchase.price.read', procurementMode: 'prices' } },
      { path: 'supplier-products', component: () => import('@/views/procurement/PurchaseCenterView.vue'), meta: { title: '采购中心 / 供应商商品库', permission: 'purchase.read', procurementMode: 'supplierProducts' } },
      { path: 'purchasers', component: () => import('@/views/procurement/PurchaseCenterView.vue'), meta: { title: '采购中心 / 采购员管理', permission: 'purchase.read', procurementMode: 'purchasers' } },
      { path: 'purchase-plans', component: () => import('@/views/procurement/PurchaseCenterView.vue'), meta: { title: '采购中心 / 采购计划', permission: 'purchase.plan.manage', procurementMode: 'plans' } },
      { path: 'purchase-analysis', component: () => import('@/views/procurement/PurchaseCenterView.vue'), meta: { title: '采购中心 / 采购分析', permission: 'purchase.analysis.read', procurementMode: 'analysis' } },
      {
        path: 'cost-profit',
        name: 'cost-profit',
        component: () => import('@/views/procurement/CostProfitView.vue'),
        meta: { title: '成本与毛利分析', permission: 'cost.read' },
      },
      {
        path: 'inventory-planning',
        name: 'inventory-planning',
        component: () =>
          import('@/views/procurement/InventoryPlanningView.vue'),
        meta: {
          title: '库存预警与采购建议',
          permission: 'inventory.alert.read',
        },
      },
      {
        path: 'customer-analysis',
        name: 'customer-analysis',
        component: () => import('@/views/customer/CustomerAnalysisView.vue'),
        meta: { title: '客户采购分析', permission: 'customer.read' },
      },
      { path:'customer-archives',component:()=>import('@/views/customer/CustomerCenterView.vue'),meta:{title:'客户中心 / 客户档案',permission:'customer.center.read',customerMode:'archives'}},
      { path:'customer-types',component:()=>import('@/views/customer/CustomerCenterView.vue'),meta:{title:'客户中心 / 客户类型',permission:'customer.center.read',customerMode:'types'}},
      { path:'customer-groups',component:()=>import('@/views/customer/CustomerCenterView.vue'),meta:{title:'客户中心 / 集团管理',permission:'customer.center.read',customerMode:'groups'}},
      { path:'customer-tags',component:()=>import('@/views/customer/CustomerCenterView.vue'),meta:{title:'客户中心 / 客户标签',permission:'customer.center.read',customerMode:'tags'}},
      { path:'customer-dashboard',component:()=>import('@/views/customer/CustomerCenterView.vue'),meta:{title:'客户中心 / 客户看板',permission:'customer.center.read',customerMode:'dashboard'}},
      { path:'customer-orders',component:()=>import('@/views/customer/CustomerCenterView.vue'),meta:{title:'客户中心 / 下单情况',permission:'customer.center.read',customerMode:'orders'}},
      { path:'customer-history',component:()=>import('@/views/customer/CustomerCenterView.vue'),meta:{title:'客户中心 / 订货历史',permission:'customer.center.read',customerMode:'history'}},
      { path:'customer-agreements',component:()=>import('@/views/customer/CustomerCenterView.vue'),meta:{title:'客户中心 / 协议价',permission:'customer.center.read',customerMode:'agreements'}},
      { path:'customer-credit',component:()=>import('@/views/customer/CustomerCenterView.vue'),meta:{title:'客户中心 / 信用管理',permission:'customer.center.read',customerMode:'credit'}},
      {
        path: 'orders',
        name: 'orders',
        component: () => import('@/views/orders/OrderView.vue'),
        meta: { title: '订单管理', permission: 'order.read' },
      },
      {
        path: 'warehouse-tasks',
        name: 'warehouse-tasks',
        component: () =>
          import('@/views/fulfillment/WarehouseTasksView.vue'),
        meta: { title: '仓库管理 / 仓库任务', permission: 'warehouse.task.read' },
      },
      {
        path: 'weighing',
        name: 'weighing',
        component: () => import('@/views/fulfillment/WeighingView.vue'),
        meta: { title: '称重与履约', permission: 'order.fulfill' },
      },
      {
        path: 'coupons',
        name: 'coupons',
        component: () => import('@/views/fulfillment/CouponView.vue'),
        meta: { title: '优惠券管理', permission: 'coupon.manage' },
      },
      {
        path: 'trading-config',
        name: 'trading-config',
        component: () => import('@/views/fulfillment/TradingConfigView.vue'),
        meta: { title: '交易配置', permission: 'shipping.manage' },
      },
      {
        path: 'delivery-mobile',
        name: 'delivery-mobile',
        component: () =>
          import('@/views/fulfillment/DeliveryMobileView.vue'),
        meta: { title: '今日配送任务', permission: 'delivery.read' },
      },
      {
        path: 'deliveries',
        name: 'deliveries',
        component: () => import('@/views/fulfillment/DeliveryView.vue'),
        meta: { title: '配送管理', permission: 'delivery.read' },
      },
      {
        path: 'finance',
        name: 'finance',
        component: () => import('@/views/finance/FinanceView.vue'),
        meta: { title: '财务管理', permission: 'finance.read' },
      },
      { path: 'after-sales', name: 'after-sales', component: () => import('@/views/after-sales/AfterSalesView.vue'), meta: { title: '售后管理', permission: 'after.sale.read' } },
      { path: 'after-sale-reasons', name: 'after-sale-reasons', component: () => import('@/views/after-sales/AfterSaleReasonsView.vue'), meta: { title: '售后原因设置', permission: 'after.sale.reason.manage' } },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

installRouterGuards(router, pinia);
