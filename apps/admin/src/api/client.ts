import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

import {
  clearStoredSession,
  getStoredAccessToken,
  getStoredRefreshToken,
  storeTokens,
} from '@/auth/storage';

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };
type RefreshEnvelope = {
  data: {
    access_token: string;
    refresh_token: string;
  };
};

let refreshPromise: Promise<string> | null = null;

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const accessToken = getStoredAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }
  config.headers['X-Request-ID'] = createRequestId();
  return config;
});

function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    if (error.response?.status !== 401 || !config || config._retry) {
      return Promise.reject(error);
    }

    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      clearStoredSession();
      return Promise.reject(error);
    }

    config._retry = true;
    refreshPromise ??= axios
      .post<RefreshEnvelope>(
        `${apiClient.defaults.baseURL}/auth/token/refresh`,
        { refresh_token: refreshToken },
      )
      .then((response) => {
        const data = response.data.data;
        storeTokens(data.access_token, data.refresh_token);
        return data.access_token;
      })
      .catch((refreshError: unknown) => {
        clearStoredSession();
        throw refreshError;
      })
      .finally(() => {
        refreshPromise = null;
      });

    const accessToken = await refreshPromise;
    config.headers.Authorization = `Bearer ${accessToken}`;
    return apiClient.request(config);
  },
);
