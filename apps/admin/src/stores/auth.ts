import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import {
  employeeLogin,
  getCurrentPrincipal,
  logout as logoutRequest,
  type AuthPrincipal,
} from '@/api/auth';
import {
  ADMIN_PRINCIPAL_KEY,
  clearStoredSession,
  getStoredAccessToken,
  storeTokens,
} from '@/auth/storage';

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(getStoredAccessToken());
  const principal = ref<AuthPrincipal | null>(readStoredPrincipal());
  const permissions = computed(() => principal.value?.permissions ?? []);
  const isAuthenticated = computed(() => Boolean(accessToken.value));
  let restorePromise: Promise<void> | null = null;

  async function login(input: {
    tenant_code: string;
    username: string;
    password: string;
  }): Promise<void> {
    const result = await employeeLogin(input);
    accessToken.value = result.access_token;
    principal.value = result.principal;
    storeTokens(result.access_token, result.refresh_token);
    storePrincipal(result.principal);
  }

  async function restore(): Promise<void> {
    if (!accessToken.value || principal.value) {
      return;
    }
    restorePromise ??= getCurrentPrincipal()
      .then((current) => {
        principal.value = current;
        storePrincipal(current);
      })
      .finally(() => {
        restorePromise = null;
      });
    return restorePromise;
  }

  function clearSession(): void {
    accessToken.value = null;
    principal.value = null;
    clearStoredSession();
  }

  async function logout(): Promise<void> {
    try {
      await logoutRequest();
    } finally {
      clearSession();
    }
  }

  function hasPermission(code: string): boolean {
    return permissions.value.includes('*') || permissions.value.includes(code);
  }

  return {
    accessToken,
    principal,
    permissions,
    isAuthenticated,
    login,
    restore,
    logout,
    clearSession,
    hasPermission,
  };
});

function readStoredPrincipal(): AuthPrincipal | null {
  const raw = window.localStorage.getItem(ADMIN_PRINCIPAL_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthPrincipal;
  } catch {
    clearStoredSession();
    return null;
  }
}

function storePrincipal(principal: AuthPrincipal): void {
  window.localStorage.setItem(
    ADMIN_PRINCIPAL_KEY,
    JSON.stringify(principal),
  );
}
