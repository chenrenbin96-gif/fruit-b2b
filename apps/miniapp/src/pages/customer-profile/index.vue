<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app';
import { reactive, ref } from 'vue';

import {
  getCustomerProfile,
  getDeliveryRegions,
  type DeliveryRegionOption,
  updateCustomerProfile,
} from '@/api/customer';

const loading = ref(false);
const saving = ref(false);
const form = reactive({
  customer_name: '',
  contact_name: '',
  phone: '',
  address: '',
  delivery_region_id: '',
});
const regions = ref<DeliveryRegionOption[]>([]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [profile, regionRows] = await Promise.all([
      getCustomerProfile(),
      getDeliveryRegions(),
    ]);
    regions.value = regionRows;
    Object.assign(form, {
      customer_name: profile.customer_name,
      contact_name: profile.contact_name,
      phone: profile.phone,
      address: profile.address,
      delivery_region_id: profile.delivery_region?.id ?? '',
    });
  } catch (error) {
    uni.showToast({
      title: (error as { message?: string }).message ?? '客户资料加载失败',
      icon: 'none',
    });
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  if (form.customer_name.trim().length < 2) {
    uni.showToast({ title: '请输入店铺名称', icon: 'none' });
    return;
  }
  if (form.contact_name.trim().length < 2) {
    uni.showToast({ title: '请输入联系人姓名', icon: 'none' });
    return;
  }
  if (!/^1\d{10}$/.test(form.phone)) {
    uni.showToast({ title: '请输入正确联系电话', icon: 'none' });
    return;
  }
  if (form.address.trim().length < 5) {
    uni.showToast({ title: '请输入完整收货地址', icon: 'none' });
    return;
  }
  saving.value = true;
  try {
    await updateCustomerProfile({
      customer_name: form.customer_name.trim(),
      contact_name: form.contact_name.trim(),
      phone: form.phone,
      address: form.address.trim(),
      delivery_region_id: form.delivery_region_id || undefined,
    });
    uni.showToast({ title: '客户资料已更新', icon: 'success' });
    setTimeout(() => uni.navigateBack(), 500);
  } catch (error) {
    uni.showToast({
      title: (error as { message?: string }).message ?? '客户资料保存失败',
      icon: 'none',
    });
  } finally {
    saving.value = false;
  }
}

function selectRegion(event: Event): void {
  const index = Number(
    (event as unknown as { detail: { value: string } }).detail.value,
  );
  form.delivery_region_id = regions.value[index]?.id ?? '';
}

function chooseLocation(): void {
  uni.chooseLocation({
    success: (result) => {
      form.address = [result.name, result.address]
        .filter(Boolean)
        .join(' ')
        .trim();
    },
    fail: (error) => {
      const message = String(error.errMsg ?? '');
      if (!message.includes('cancel')) {
        uni.showToast({
          title: '定位失败，请检查小程序定位权限',
          icon: 'none',
        });
      }
    },
  });
}

onShow(load);
</script>

<template>
  <view class="profile-edit">
    <view class="identity">
      <view class="avatar">客</view>
      <view><strong>{{ form.customer_name || '采购客户' }}</strong><text>企业采购资料</text></view>
    </view>

    <view class="form-card">
      <label>
        <text>店铺名称</text>
        <input v-model="form.customer_name" maxlength="150" placeholder="请输入店铺名称" />
      </label>
      <label>
        <text>联系人姓名</text>
        <input v-model="form.contact_name" maxlength="50" placeholder="请输入联系人" />
      </label>
      <label>
        <text>联系电话</text>
        <input v-model="form.phone" type="number" maxlength="11" placeholder="请输入手机号" />
      </label>
      <label>
        <text>配送区域</text>
        <picker
          :range="regions.map((item) => `${item.region_name} · ¥${item.min_order_amount}起送`)"
          @change="selectRegion"
        >
          <view class="location">
            {{ regions.find((item) => item.id === form.delivery_region_id)?.region_name || '自动匹配' }} ›
          </view>
        </picker>
      </label>
      <label>
        <text>定位地址</text>
        <view class="location location-action" @click="chooseLocation">
          ⌖ {{ form.address || '点击选择定位' }} ›
        </view>
      </label>
      <label class="address">
        <text>详细收货地址</text>
        <textarea v-model="form.address" maxlength="255" placeholder="请输入省市区、街道及门牌号" />
      </label>
    </view>

    <view class="notice">修改联系电话后，下次登录请使用新手机号获取验证码。</view>
    <view class="bottom-space" />
    <view class="save-bar">
      <button :loading="saving" :disabled="loading" @click="save">确认修改</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.profile-edit { min-height:100vh; padding:24rpx 22rpx 140rpx; background:#f4f5f2; }
.identity { display:flex; padding:28rpx; border-radius:20rpx; color:#fff; background:linear-gradient(135deg,#1e583b,#347854); align-items:center; gap:18rpx; }
.avatar { display:grid; width:86rpx; height:86rpx; border-radius:24rpx; color:#3f3300; background:#f9c800; font-size:34rpx; font-weight:900; place-items:center; }
.identity strong,.identity text { display:block; }
.identity strong { font-size:30rpx; }
.identity text { margin-top:6rpx; color:#d0dfd5; font-size:20rpx; }
.form-card { margin-top:18rpx; padding:0 24rpx; border-radius:20rpx; background:#fff; }
label { display:flex; min-height:96rpx; border-bottom:1rpx solid #edf0ed; align-items:center; }
label > text { width:180rpx; color:#3a473f; font-size:23rpx; flex:none; }
label input { height:92rpx; color:#28362d; font-size:23rpx; text-align:right; flex:1; }
.location { color:#708078; font-size:20rpx; text-align:right; flex:1; }
.location-action { color:#28704b; }
label.address { display:block; padding:24rpx 0; }
label.address > text { display:block; width:auto; }
label textarea { width:100%; height:120rpx; margin-top:14rpx; padding:16rpx; border-radius:12rpx; background:#f5f7f5; font-size:22rpx; }
.notice { margin-top:18rpx; padding:18rpx 22rpx; border-radius:13rpx; color:#846825; background:#fff8dc; font-size:19rpx; }
.bottom-space { height:40rpx; }
.save-bar { position:fixed; right:0; bottom:0; left:0; padding:18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); border-top:1rpx solid #e7ebe8; background:#fff; }
.save-bar button { width:100%; margin:0; border-radius:44rpx; color:#403400; background:#f9c800; font-size:27rpx; font-weight:800; }
</style>
