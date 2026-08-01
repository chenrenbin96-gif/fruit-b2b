import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

type PurchaseListLine = {
  skuId: string;
  displayName: string;
};

export const usePurchaseListStore = defineStore('purchase-list', () => {
  const lines = ref<PurchaseListLine[]>([]);
  const lineCount = computed(() => lines.value.length);

  function reset(): void {
    lines.value = [];
  }

  return { lines, lineCount, reset };
});
