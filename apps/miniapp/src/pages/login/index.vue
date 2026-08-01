<script setup lang="ts">
import { reactive, ref } from 'vue';

import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const form = reactive({
  tenant_code: 'DEFAULT',
  phone: '',
  verification_code: '',
});
const loginMode = ref<'PASSWORD' | 'CODE'>('PASSWORD');
const passwordForm = reactive({
  tenant_code: 'DEFAULT',
  account: 'DEV001',
  password: '',
});
const sending = ref(false);
const submitting = ref(false);
const countdown = ref(0);

async function sendCode(): Promise<void> {
  if (!/^1\d{10}$/.test(form.phone)) {
    uni.showToast({ title: '请输入正确手机号', icon: 'none' });
    return;
  }
  sending.value = true;
  try {
    const result = await auth.requestVerificationCode({
      tenant_code: form.tenant_code,
      phone: form.phone,
    });
    if (result.debug_code) {
      form.verification_code = result.debug_code;
      uni.showToast({ title: '开发验证码已填入', icon: 'none' });
    } else {
      uni.showToast({ title: '验证码已发送', icon: 'success' });
    }
    startCountdown();
  } catch (error) {
    showError(error, '验证码发送失败');
  } finally {
    sending.value = false;
  }
}

async function submit(): Promise<void> {
  if (!/^\d{6}$/.test(form.verification_code)) {
    uni.showToast({ title: '请输入6位验证码', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    await auth.login(form);
    uni.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => uni.switchTab({ url: '/pages/profile/index' }), 300);
  } catch (error) {
    showError(error, '登录失败');
  } finally {
    submitting.value = false;
  }
}

async function submitPassword(): Promise<void> {
  if (!passwordForm.account.trim() || passwordForm.password.length < 6) {
    uni.showToast({ title: '请输入账号和至少6位密码', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    await auth.passwordLogin(passwordForm);
    uni.showToast({ title: '登录成功', icon: 'success' });
    setTimeout(() => uni.switchTab({ url: '/pages/profile/index' }), 300);
  } catch (error) {
    showError(error, '登录失败');
  } finally {
    submitting.value = false;
  }
}

function startCountdown(): void {
  countdown.value = 60;
  const timer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      clearInterval(timer);
    }
  }, 1_000);
}

function showError(error: unknown, fallback: string): void {
  const message =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : fallback;
  uni.showToast({ title: message, icon: 'none' });
}
</script>

<template>
  <view class="login">
    <view class="login__heading">
      <text class="login__eyebrow">B2B PROCUREMENT</text>
      <text class="login__title">采购客户登录</text>
      <text class="login__description">
        客户账号与后台员工账号相互独立
      </text>
    </view>

    <view class="login__form">
      <view class="login__mode">
        <text :class="{ active: loginMode === 'PASSWORD' }" @click="loginMode = 'PASSWORD'">密码登录</text>
        <text :class="{ active: loginMode === 'CODE' }" @click="loginMode = 'CODE'">验证码登录</text>
      </view>
      <template v-if="loginMode === 'PASSWORD'">
        <text class="login__label">租户编码</text>
        <input v-model="passwordForm.tenant_code" class="login__input" placeholder="请输入租户编码" />
        <text class="login__label">客户账号或手机号</text>
        <input v-model="passwordForm.account" class="login__input" placeholder="请输入客户账号或手机号" />
        <text class="login__label">密码</text>
        <input v-model="passwordForm.password" class="login__input" password placeholder="请输入密码" />
        <button class="login__submit" :loading="submitting" @click="submitPassword">登录</button>
      </template>
      <template v-else>
      <text class="login__label">租户编码</text>
      <input
        v-model="form.tenant_code"
        class="login__input"
        placeholder="请输入租户编码"
      />

      <text class="login__label">手机号</text>
      <input
        v-model="form.phone"
        class="login__input"
        type="number"
        maxlength="11"
        placeholder="请输入采购账号手机号"
      />

      <text class="login__label">验证码</text>
      <view class="login__code-row">
        <input
          v-model="form.verification_code"
          class="login__input login__input--code"
          type="number"
          maxlength="6"
          placeholder="6位验证码"
        />
        <button
          class="login__code-button"
          :disabled="sending || countdown > 0"
          @click="sendCode"
        >
          {{ countdown > 0 ? `${countdown}s` : "获取验证码" }}
        </button>
      </view>

      <button
        class="login__submit"
        :loading="submitting"
        @click="submit"
      >
        登录
      </button>
      </template>
    </view>

    <text class="login__note">
      生产环境须接入正式短信服务；开发环境可使用控制台验证码。
    </text>
  </view>
</template>

<style scoped lang="scss">
.login {
  min-height: 100vh;
  padding: 80rpx 40rpx;
  background:
    radial-gradient(circle at 86% 4%, rgb(208 232 121 / 40%), transparent 28%),
    #f4f7f5;

  &__heading {
    display: flex;
    flex-direction: column;
  }

  &__eyebrow {
    color: #4f7c63;
    font-size: 22rpx;
    font-weight: 700;
    letter-spacing: 4rpx;
  }

  &__title {
    margin-top: 18rpx;
    font-size: 54rpx;
    font-weight: 800;
  }

  &__description {
    margin-top: 16rpx;
    color: #748078;
    font-size: 27rpx;
  }

  &__form {
    margin-top: 64rpx;
    padding: 38rpx;
    border: 1rpx solid #e0e8e2;
    border-radius: 28rpx;
    background: #ffffff;
    box-shadow: 0 24rpx 70rpx rgb(30 71 46 / 8%);
  }

  &__mode {
    display: flex;
    gap: 42rpx;
    margin-bottom: 26rpx;
    color: #7b877f;

    .active {
      padding-bottom: 12rpx;
      border-bottom: 5rpx solid #1f6a43;
      color: #1f6a43;
      font-weight: 700;
    }
  }

  &__label {
    display: block;
    margin: 26rpx 0 14rpx;
    font-size: 26rpx;
    font-weight: 600;
  }

  &__label:first-child {
    margin-top: 0;
  }

  &__input {
    height: 88rpx;
    padding: 0 24rpx;
    border: 1rpx solid #dbe4de;
    border-radius: 16rpx;
    background: #f9fbf9;
    font-size: 29rpx;
  }

  &__code-row {
    display: flex;
    gap: 16rpx;
  }

  &__input--code {
    min-width: 0;
    flex: 1;
  }

  &__code-button {
    width: 220rpx;
    height: 88rpx;
    margin: 0;
    border: 0;
    border-radius: 16rpx;
    color: #1f6a43;
    background: #e9f1ec;
    font-size: 26rpx;
    line-height: 88rpx;
  }

  &__submit {
    height: 92rpx;
    margin-top: 42rpx;
    border: 0;
    border-radius: 18rpx;
    color: #ffffff;
    background: #1f6a43;
    font-size: 30rpx;
    font-weight: 700;
    line-height: 92rpx;
  }

  &__note {
    display: block;
    margin-top: 30rpx;
    color: #8b968f;
    font-size: 23rpx;
    line-height: 1.6;
    text-align: center;
  }
}
</style>
