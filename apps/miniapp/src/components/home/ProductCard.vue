<script setup lang="ts">
import type { CatalogProduct } from '@/api/catalog';
import WholesaleProductCard from '@/components/catalog/WholesaleProductCard.vue';

defineProps<{ product: CatalogProduct; quantity: number; loading: boolean }>();
defineEmits<{ open: []; add: []; increase: []; decrease: [] }>();
</script>

<template>
  <WholesaleProductCard
    :product="product"
    :quantity="quantity"
    :loading="loading"
    @open="$emit('open')"
    @add="$emit('add')"
    @increase="$emit('increase')"
    @decrease="$emit('decrease')"
  />
</template>
