<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import { afterSalesApi, type AfterSale } from '@/api/after-sales';
import { resolveAssetUrl } from '@/api/request';

const detail = ref<AfterSale | null>(null);
const loading = ref(true);
const labels: Record<string, string> = { PENDING: '待平台审核', APPROVED: '审核通过，等待退款', REJECTED: '已驳回', PROCESSING: '退款处理中', COMPLETED: '售后已完成', CANCELLED: '已取消' };
const imageUrls = computed(() => detail.value?.media?.filter((item) => item.media_type === 'IMAGE').map((item) => resolveAssetUrl(item.url) || '') ?? []);
function preview(url: string): void { uni.previewImage({ current: resolveAssetUrl(url) || '', urls: imageUrls.value }); }
onLoad(async (options) => { try { detail.value = await afterSalesApi.detail(String(options?.id ?? '')); } catch (error) { uni.showToast({ title: (error as { message?: string }).message ?? '加载失败', icon: 'none' }); } finally { loading.value = false; } });
</script>

<template>
  <view v-if="detail" class="page">
    <view class="status"><strong>{{ labels[detail.status] ?? detail.status }}</strong><text>{{ detail.after_sale_no }}</text></view>
    <view class="panel"><text class="title">申请信息</text><text>订单：{{ detail.order_no }}</text><text>原因：{{ detail.reason?.name }}</text><text>说明：{{ detail.description || '-' }}</text><text v-if="detail.review_remark">审核意见：{{ detail.review_remark }}</text></view>
    <view class="panel"><text class="title">售后商品</text><view v-for="item in detail.items" :key="item.id" class="item"><view><strong>{{ item.product_name }}</strong><text>{{ item.sku_name }}</text></view><view><text>申请 {{ item.sale_type === 'PIECE' ? item.quantity : item.requested_weight }} {{ item.unit }}</text><text v-if="item.approved_quantity || item.approved_weight">核准 {{ item.sale_type === 'PIECE' ? item.approved_quantity : item.approved_weight }} {{ item.unit }}</text><strong>¥{{ item.refund_amount }}</strong></view></view></view>
    <view v-if="detail.media?.length" class="panel"><text class="title">问题凭证</text><view class="media"><template v-for="item in detail.media" :key="item.id"><image v-if="item.media_type === 'IMAGE'" :src="resolveAssetUrl(item.url) || ''" mode="aspectFill" @click="preview(item.url)"/><video v-else :src="resolveAssetUrl(item.url) || ''" :poster="resolveAssetUrl(item.thumbnail_url) || ''" controls/></template></view></view>
    <view class="refund"><text>{{ detail.refund_type === 'COMPENSATION' ? '补偿金额' : '退款金额' }}</text><strong>¥{{ detail.refund_amount }}</strong><text v-if="detail.refund">{{ detail.refund.status === 'COMPLETED' ? '已完成' : '待处理' }}</text></view>
  </view>
  <view v-else class="loading">{{ loading ? '正在加载…' : '售后申请不存在' }}</view>
</template>

<style scoped lang="scss">
.page{min-height:100vh;padding:22rpx;background:#f4f6f3}.status{padding:34rpx;border-radius:22rpx;color:#fff;background:#236344}.status strong,.status text,.panel>text,.item text{display:block}.status strong{font-size:31rpx}.status text{margin-top:8rpx;color:#d2e4d8;font-size:21rpx}.panel,.refund{margin-top:18rpx;padding:26rpx;border-radius:20rpx;background:#fff}.title{margin-bottom:16rpx;font-size:28rpx;font-weight:800}.panel>text:not(.title){margin-top:9rpx;color:#66736b;font-size:22rpx}.item{display:flex;padding:18rpx 0;border-top:1rpx solid #edf0ed;justify-content:space-between}.item>view:last-child{text-align:right}.item strong{font-size:24rpx}.item text{margin-top:5rpx;color:#7e8982;font-size:20rpx}.item>view:last-child strong{display:block;margin-top:5rpx;color:#d95740}.media{display:flex;flex-wrap:wrap;gap:12rpx}.media image,.media video{width:195rpx;height:170rpx;border-radius:14rpx}.refund{display:flex;align-items:center;justify-content:space-between}.refund strong{color:#d95740;font-size:34rpx}.refund text{color:#758078;font-size:22rpx}.loading{padding:220rpx;text-align:center}
</style>
