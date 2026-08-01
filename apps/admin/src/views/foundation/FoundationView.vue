<script setup lang="ts">
const modules = [
  '商品与价格',
  '客户 CRM',
  '订单与称重',
  '库存与采购',
  '配送区域与运费',
  '配送任务',
  '优惠券',
  '财务与系统',
];
</script>

<template>
  <section>
    <div class="page-heading">
      <div>
        <p class="eyebrow">MODULES</p>
        <h1>后台模块占位</h1>
      </div>
    </div>

    <div class="module-grid">
      <article v-for="(item, index) in modules" :key="item">
        <span>{{ String(index + 1).padStart(2, '0') }}</span>
        <strong>{{ item }}</strong>
        <small>待后续阶段开发</small>
      </article>
    </div>
  </section>
</template>
