<script setup lang="ts">
import { reactive, ref } from 'vue';
import { AxiosError } from 'axios';
import {
  ElMessage,
  type FormInstance,
  type FormRules,
} from 'element-plus';
import { useRoute, useRouter } from 'vue-router';

import { useAuthStore } from '@/stores/auth';

const form = reactive({
  tenant_code: 'DEFAULT',
  username: '',
  password: '',
});
const submitting = ref(false);
const formRef = ref<FormInstance>();
const rules: FormRules<typeof form> = {
  tenant_code: [{ required: true, message: '请输入租户编码', trigger: 'blur' }],
  username: [{ required: true, message: '请输入员工账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

async function handleLogin(): Promise<void> {
  if (submitting.value) return;
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    ElMessage.warning('请完整填写租户、账号和密码');
    return;
  }

  submitting.value = true;
  try {
    await auth.login(form);
    const redirect =
      typeof route.query.redirect === 'string' &&
      route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/dashboard';
    await router.replace(redirect);
  } catch (error) {
    const apiMessage =
      error instanceof AxiosError
        ? (error.response?.data as { message?: string } | undefined)?.message
        : undefined;
    ElMessage.error(apiMessage ?? '登录失败，请检查账号信息');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <section class="login-hero">
      <p class="eyebrow">FRESH SUPPLY CHAIN</p>
      <h1>鲜链云</h1>
      <p>面向水果批发业务的订货、仓储、配送与账务协同系统。</p>
      <div class="login-stat">
        <strong>Stage 5-A</strong>
        <span>租户认证与权限底座已启用</span>
      </div>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <div>
          <p class="eyebrow">MANAGEMENT CONSOLE</p>
          <h2>登录管理后台</h2>
          <p class="muted">请使用后台员工账号登录</p>
        </div>

        <ElForm
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          @submit.prevent="handleLogin"
        >
          <ElFormItem label="租户编码" prop="tenant_code">
            <ElInput
              v-model="form.tenant_code"
              autocomplete="organization"
              placeholder="请输入租户编码"
            />
          </ElFormItem>
          <ElFormItem label="账号" prop="username">
            <ElInput
              v-model="form.username"
              autocomplete="username"
              placeholder="请输入员工账号"
            />
          </ElFormItem>
          <ElFormItem label="密码" prop="password">
            <ElInput
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              show-password
              placeholder="请输入密码"
            />
          </ElFormItem>
          <ElButton
            type="primary"
            native-type="button"
            class="login-button"
            :loading="submitting"
            :disabled="submitting"
            data-testid="admin-login-submit"
            @click="handleLogin"
          >
            登录
          </ElButton>
        </ElForm>

        <p class="login-note">员工与客户使用相互独立的认证入口。</p>
      </div>
    </section>
  </div>
</template>
