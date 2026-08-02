<script setup lang="ts">
defineProps<{page:number;pageSize:number;total:number}>();
const emit=defineEmits<{change:[page:number,pageSize:number]}>();
</script>
<template><ElPagination :current-page="page" :page-size="pageSize" :total="total" :page-sizes="[20,50,100]" layout="total, sizes, prev, pager, next, jumper" background @update:current-page="emit('change',$event,pageSize)" @update:page-size="emit('change',1,$event)"/></template>
<style scoped>.el-pagination{padding:18px 0 2px;justify-content:flex-end}</style>
