<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';

import {
  purchaseOrderApi,
  type PurchaseCart,
  type PurchaseCartItem,
} from '@/api/orders';
import { getAccessToken } from '@/api/token';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const loading = ref(false);
const cart = ref<PurchaseCart | null>(null);
const loadError = ref('');
const selectedIds = ref<Set<string>>(new Set());
const remark = ref('');

const selectedCount = computed(() => selectedIds.value.size);
const allSelected = computed(
  () =>
    Boolean(cart.value?.items.length) &&
    selectedIds.value.size === cart.value?.items.length,
);
const cartGroups = computed(() => {
  const groups = new Map<string, PurchaseCartItem[]>();
  for (const item of cart.value?.items ?? []) {
    const key = item.category_name || '其他商品';
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].map(([name, items]) => ({ name, items }));
});

async function load(): Promise<void> {
  loadError.value = '';
  if (!getAccessToken()) {
    auth.clearSession();
    cart.value = null;
    return;
  }
  loading.value = true;
  try {
    cart.value = await purchaseOrderApi.cart();
    selectedIds.value = new Set(cart.value.items.map((item) => item.id));
    remark.value = String(uni.getStorageSync('purchase_order_remark') || '');
  } catch (error) {
    if (!getAccessToken()) {
      auth.clearSession();
      cart.value = null;
      return;
    }
    loadError.value =
      (error as { message?: string }).message ?? '进货单加载失败，请点击重试';
    uni.showToast({ title: '进货单加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function update(item: PurchaseCartItem, value: number): Promise<void> {
  if (!Number.isFinite(value) || value <= 0) {
    uni.showToast({ title: '请输入正确数量', icon: 'none' });
    return;
  }
  try {
    cart.value = await purchaseOrderApi.updateItem(item.id, { quantity: value });
  } catch {
    uni.showToast({ title: '数量修改失败', icon: 'none' });
    await load();
  }
}

function updateFromInput(item: PurchaseCartItem, event: Event): void {
  const inputEvent = event as unknown as { detail: { value: string } };
  void update(item, Number(inputEvent.detail.value));
}

async function adjust(item: PurchaseCartItem, delta: number): Promise<void> {
  const current = Number(item.quantity);
  if (current + delta <= 0) {
    await remove(item);
    return;
  }
  await update(item, current + delta);
}

async function batchAdjust(items: PurchaseCartItem[], delta: number): Promise<void> {
  loading.value = true;
  try {
    for (const item of items) {
      const current = Number(item.quantity);
      if (current + delta <= 0) continue;
      await purchaseOrderApi.updateItem(
        item.id,
        { quantity: current + delta },
      );
    }
    await load();
    uni.showToast({ title: '本分类数量已批量调整', icon: 'success' });
  } catch (error) {
    uni.showToast({
      title: (error as { message?: string }).message ?? '批量修改失败',
      icon: 'none',
    });
    await load();
  } finally {
    loading.value = false;
  }
}

async function remove(item: PurchaseCartItem): Promise<void> {
  cart.value = await purchaseOrderApi.removeItem(item.id);
  const next = new Set(selectedIds.value);
  next.delete(item.id);
  selectedIds.value = next;
}

async function clear(): Promise<void> {
  const result = await new Promise<UniApp.ShowModalRes>((resolve) => {
    uni.showModal({
      title: '清空进货单',
      content: '确认删除进货单中的全部商品？',
      success: resolve,
    });
  });
  if (!result.confirm) return;
  cart.value = await purchaseOrderApi.clear();
  selectedIds.value = new Set();
}

async function removeSelected(): Promise<void> {
  const selected = [...selectedIds.value];
  if (!selected.length) {
    uni.showToast({ title: '请先选择需要删除的商品', icon: 'none' });
    return;
  }
  const result = await new Promise<UniApp.ShowModalRes>((resolve) => {
    uni.showModal({
      title: '批量删除',
      content: `确认删除已选择的${selected.length}种商品？`,
      success: resolve,
    });
  });
  if (!result.confirm) return;
  loading.value = true;
  try {
    let latest = cart.value;
    for (const id of selected) {
      latest = await purchaseOrderApi.removeItem(id);
    }
    cart.value = latest;
    selectedIds.value = new Set();
    uni.showToast({ title: '已删除所选商品', icon: 'success' });
  } catch (error) {
    uni.showToast({
      title: (error as { message?: string }).message ?? '批量删除失败',
      icon: 'none',
    });
    await load();
  } finally {
    loading.value = false;
  }
}

function toggleItem(id: string): void {
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
}

function toggleAll(): void {
  selectedIds.value = allSelected.value
    ? new Set()
    : new Set(cart.value?.items.map((item) => item.id) ?? []);
}

function checkout(): void {
  if (!cart.value?.items.length) return;
  if (!allSelected.value) {
    uni.showToast({ title: '请先选择全部结算商品', icon: 'none' });
    return;
  }
  if (!cart.value.summary.all_items_purchasable) {
    uni.showToast({ title: '进货单中存在不可采购商品', icon: 'none' });
    return;
  }
  uni.setStorageSync('purchase_order_remark', remark.value.trim());
  uni.navigateTo({ url: '/pages/order-confirm/index' });
}

function login(): void {
  uni.navigateTo({ url: '/pages/login/index' });
}

function sourcing(): void {
  uni.switchTab({ url: '/pages/sourcing/index' });
}

onShow(load);
</script>

<template>
  <view class="cart-page">
    <view v-if="!auth.isAuthenticated" class="empty-card">
      <strong>登录后使用进货单</strong>
      <button @click="login">客户登录</button>
    </view>

    <view v-else-if="loadError" class="empty-card">
      <strong>进货单暂时未能加载</strong>
      <text>{{ loadError }}</text>
      <button @click="load">重新加载</button>
    </view>

    <template v-else-if="cart">
      <view class="heading">
        <view><text>已选 {{ selectedCount }} 件商品</text><strong>进货单</strong></view>
        <text v-if="cart.items.length" class="clear" @click="clear">清空</text>
      </view>

      <view v-if="cart.items.length">
        <view class="selection-tools">
          <text>已选择 {{ selectedCount }} 种</text>
          <button :disabled="selectedCount === 0" @click="removeSelected">
            删除所选
          </button>
        </view>
        <view v-for="group in cartGroups" :key="group.name" class="category-group">
          <view class="category-heading">
            <strong>{{ group.name }}</strong>
            <view>
              <button @click="batchAdjust(group.items, -1)">全部−1</button>
              <button @click="batchAdjust(group.items, 1)">全部+1</button>
            </view>
          </view>
        <view v-for="item in group.items" :key="item.id" class="cart-item">
          <view
            class="checkbox"
            :class="{ checked: selectedIds.has(item.id) }"
            @click="toggleItem(item.id)"
          >
            {{ selectedIds.has(item.id) ? '✓' : '' }}
          </view>
          <image v-if="item.main_image" :src="item.main_image" mode="aspectFill" />
          <view v-else class="image-placeholder">鲜</view>
          <view class="item-body">
            <view class="item-heading">
              <strong>{{ item.product_name }}</strong>
              <text @click="remove(item)">删除</text>
            </view>
            <text class="spec">{{ item.sku_name }} · {{ item.sale_type === 'PIECE' ? '按件' : '称重' }}</text>
            <view class="item-footer">
              <view class="price">
                <strong>¥{{ item.unit_price ?? '—' }}</strong>
                <text>/{{ item.price_unit }}</text>
              </view>
              <view class="stepper">
                <button @click="adjust(item, -1)">−</button>
                <input
                  :value="Number(item.quantity)"
                  type="digit"
                  @blur="updateFromInput(item, $event)"
                />
                <text>{{ item.unit }}</text>
                <button @click="adjust(item, 1)">+</button>
              </view>
            </view>
            <text v-if="!item.purchasable" class="invalid">{{ item.invalid_reason }}</text>
          </view>
        </view>
        </view>

        <view class="remark">
          <text>采购备注</text>
          <input v-model="remark" maxlength="500" placeholder="选填，例如配送时间、分拣要求" />
        </view>

        <view class="summary-card">
          <view><text>商品金额</text><strong>¥{{ cart.summary.estimated_product_amount }}</strong></view>
          <view><text>预计重量</text><strong>{{ cart.summary.estimated_weight }} {{ cart.summary.estimated_weight_unit }}</strong></view>
          <view><text>预计运费</text><strong>¥{{ cart.summary.estimated_shipping_fee }}</strong></view>
          <view><text>优惠金额</text><strong>结算页选择</strong></view>
          <view class="pay"><text>预计付款</text><strong>¥{{ cart.summary.estimated_amount }}</strong></view>
        </view>

        <view class="footer-space" />
        <view class="cart-footer">
          <view class="select-all" @click="toggleAll">
            <text :class="{ checked: allSelected }">{{ allSelected ? '✓' : '' }}</text>
            全选
          </view>
          <view class="total"><small>预计付款</small><strong>¥{{ cart.summary.estimated_amount }}</strong></view>
          <button @click="checkout">去结算</button>
        </view>
      </view>

      <view v-else class="empty-card">
        <strong>进货单还是空的</strong>
        <text>去找货页选择需要采购的水果</text>
        <button @click="sourcing">去找货</button>
      </view>
    </template>
    <view v-else-if="loading" class="empty-card">正在加载进货单…</view>
  </view>
</template>

<style scoped lang="scss">
.cart-page { min-height:100vh; padding:22rpx 22rpx 150rpx; background:#f4f5f2; }
.heading { display:flex; padding:10rpx 4rpx 22rpx; align-items:flex-end; justify-content:space-between; }
.heading view,.heading text,.heading strong { display:block; }
.heading view > text { color:#7e8981; font-size:19rpx; }
.heading strong { margin-top:3rpx; color:#1e3025; font-size:38rpx; }
.clear { color:#b65d4b; font-size:22rpx; }
.selection-tools { display:flex; margin-bottom:12rpx; padding:14rpx 18rpx; border-radius:14rpx; color:#647168; background:#fff; font-size:20rpx; align-items:center; justify-content:space-between; }
.selection-tools button { height:48rpx; margin:0; padding:0 18rpx; border-radius:24rpx; color:#a84f40; background:#fff0ed; font-size:19rpx; line-height:48rpx; }
.selection-tools button[disabled] { color:#aab1ac; background:#f0f2f0; }
.category-group { margin-bottom:16rpx; }
.category-heading { display:flex; padding:14rpx 10rpx; align-items:center; justify-content:space-between; }
.category-heading > strong { color:#2e4838; font-size:25rpx; }
.category-heading > view { display:flex; gap:8rpx; }
.category-heading button { height:46rpx; margin:0; padding:0 13rpx; border-radius:23rpx; color:#42634f; background:#e8f0ea; font-size:17rpx; line-height:46rpx; }
.cart-item { display:flex; margin-bottom:14rpx; padding:18rpx; border-radius:18rpx; background:#fff; align-items:center; gap:13rpx; }
.checkbox,.select-all > text { display:grid; width:34rpx; height:34rpx; border:2rpx solid #cfd6d1; border-radius:50%; color:#443800; background:#fff; font-size:18rpx; flex:none; place-items:center; }
.checkbox.checked,.select-all > text.checked { border-color:#f9c800; background:#f9c800; }
.cart-item image,.image-placeholder { display:grid; width:112rpx; height:112rpx; border-radius:14rpx; color:#2e6847; background:#e5eee2; font-size:38rpx; font-weight:900; flex:none; place-items:center; }
.item-body { min-width:0; flex:1; }
.item-heading { display:flex; align-items:center; justify-content:space-between; }
.item-heading strong { overflow:hidden; color:#27342c; font-size:25rpx; text-overflow:ellipsis; white-space:nowrap; }
.item-heading text { color:#b86c5b; font-size:19rpx; }
.spec { display:block; margin-top:6rpx; color:#89928c; font-size:19rpx; }
.item-footer { display:flex; margin-top:16rpx; align-items:center; justify-content:space-between; gap:8rpx; }
.price strong { color:#df503d; font-size:27rpx; }
.price text { color:#df503d; font-size:16rpx; }
.stepper { display:flex; height:50rpx; border:1rpx solid #e1e6e2; border-radius:26rpx; align-items:center; }
.stepper button { display:grid; width:46rpx; height:46rpx; margin:0; padding:0; border-radius:50%; color:#fff; background:#26714a; font-size:26rpx; line-height:46rpx; place-items:center; }
.stepper input { width:52rpx; font-size:20rpx; text-align:right; }
.stepper > text { padding-right:4rpx; color:#7c8780; font-size:16rpx; }
.invalid { display:block; margin-top:8rpx; color:#cb4f41; font-size:19rpx; }
.remark { margin-top:16rpx; padding:24rpx; border-radius:18rpx; background:#fff; }
.remark > text { display:block; color:#303e35; font-size:25rpx; font-weight:700; }
.remark input { height:72rpx; margin-top:12rpx; padding:0 18rpx; border-radius:12rpx; background:#f5f7f5; font-size:22rpx; }
.summary-card { margin-top:16rpx; padding:20rpx 24rpx; border-radius:18rpx; background:#fff; }
.summary-card view { display:flex; padding:8rpx 0; color:#6c786f; font-size:21rpx; justify-content:space-between; }
.summary-card strong { color:#344138; font-weight:500; }
.summary-card .pay { margin-top:6rpx; padding-top:15rpx; border-top:1rpx solid #ecefec; }
.summary-card .pay strong { color:#dc5140; font-size:28rpx; font-weight:800; }
.footer-space { height:80rpx; }
.cart-footer { position:fixed; z-index:20; right:0; bottom:50px; left:0; display:flex; height:112rpx; padding:0 22rpx; border-top:1rpx solid #e6ebe7; background:#fff; align-items:center; gap:18rpx; }
.select-all { display:flex; color:#657168; font-size:21rpx; align-items:center; gap:8rpx; }
.total { min-width:0; text-align:right; flex:1; }
.total small,.total strong { display:block; }
.total small { color:#8b958e; font-size:17rpx; }
.total strong { color:#df503d; font-size:30rpx; }
.cart-footer button { width:210rpx; margin:0; border-radius:42rpx; color:#403300; background:#f9c800; font-size:26rpx; font-weight:800; }
.empty-card { display:flex; margin-top:130rpx; padding:60rpx 30rpx; border-radius:20rpx; color:#8a948d; background:#fff; align-items:center; flex-direction:column; gap:16rpx; }
.empty-card strong { color:#304238; font-size:30rpx; }
.empty-card button { color:#fff; background:#26714a; }
</style>
