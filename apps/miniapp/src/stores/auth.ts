import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import {
  clearSessionStorage,
  getAccessToken,
  getStoredPrincipal,
  setStoredPrincipal,
  setTokens,
  type CustomerPrincipal,
} from '@/api/token';
import { request } from '@/api/request';

type LoginResult = {
  access_token: string;
  refresh_token: string;
  principal: CustomerPrincipal;
};

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(getAccessToken());
  const principal = ref<CustomerPrincipal | null>(getStoredPrincipal());
  const isAuthenticated = computed(() => Boolean(accessToken.value));

  async function requestVerificationCode(input: {
    tenant_code: string;
    phone: string;
  }): Promise<{ expires_in: number; debug_code?: string }> {
    const response = await request<{
      expires_in: number;
      debug_code?: string;
    }>({
      url: '/auth/customer/verification-code',
      method: 'POST',
      data: input,
    });
    return response.data;
  }

  async function login(input: {
    tenant_code: string;
    phone: string;
    verification_code: string;
  }): Promise<void> {
    const response = await request<LoginResult>({
      url: '/auth/customer/login',
      method: 'POST',
      data: input,
    });
    accessToken.value = response.data.access_token;
    principal.value = response.data.principal;
    setTokens(
      response.data.access_token,
      response.data.refresh_token,
    );
    setStoredPrincipal(response.data.principal);
  }

  async function passwordLogin(input: {
    tenant_code: string;
    account: string;
    password: string;
  }): Promise<void> {
    const response = await request<LoginResult>({
      url: '/auth/customer/password-login',
      method: 'POST',
      data: input,
    });
    accessToken.value = response.data.access_token;
    principal.value = response.data.principal;
    setTokens(response.data.access_token, response.data.refresh_token);
    setStoredPrincipal(response.data.principal);
  }

  async function restore(): Promise<void> {
    if (!accessToken.value) {
      return;
    }
    const response = await request<CustomerPrincipal>({
      url: '/auth/me',
    });
    principal.value = response.data;
    setStoredPrincipal(response.data);
  }

  function clearSession(): void {
    accessToken.value = null;
    principal.value = null;
    clearSessionStorage();
  }

  async function logout(): Promise<void> {
    try {
      await request({ url: '/auth/logout', method: 'POST' });
    } finally {
      clearSession();
    }
  }

  return {
    accessToken,
    principal,
    isAuthenticated,
    requestVerificationCode,
    login,
    passwordLogin,
    restore,
    logout,
    clearSession,
  };
});
