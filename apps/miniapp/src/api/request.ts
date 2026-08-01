import type {
  ApiErrorResponse,
  ApiSuccessResponse,
} from '@fruit-b2b/contracts';

import {
  clearSessionStorage,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './token';

type RequestOptions<T> = {
  url: string;
  method?: UniApp.RequestOptions['method'] | 'PATCH';
  data?: UniApp.RequestOptions['data'];
  header?: Record<string, string>;
  timeout?: number;
};

type RefreshResult = {
  access_token: string;
  refresh_token: string;
};

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';
let refreshPromise: Promise<string> | null = null;

export function resolveAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url;
  const apiOrigin = API_BASE_URL.replace(/\/api\/v\d+\/?$/i, '');
  return `${apiOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function request<T>(
  options: RequestOptions<T>,
): Promise<ApiSuccessResponse<T>> {
  return execute<T>(options, false);
}

function execute<T>(
  options: RequestOptions<T>,
  retried: boolean,
): Promise<ApiSuccessResponse<T>> {
  const token = getAccessToken();

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE_URL}${options.url}`,
      method: (options.method ?? 'GET') as UniApp.RequestOptions['method'],
      data: options.data,
      timeout: options.timeout ?? 15_000,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.header,
      },
      async success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as ApiSuccessResponse<T>);
          return;
        }

        if (response.statusCode === 401 && !retried) {
          try {
            await refreshAccessToken();
            resolve(await execute(options, true));
            return;
          } catch {
            clearSessionStorage();
          }
        }

        reject(response.data as ApiErrorResponse);
      },
      fail(error) {
        reject({
          code: 'NETWORK_ERROR',
          message: error.errMsg,
          request_id: '',
          timestamp: new Date().toISOString(),
        } satisfies ApiErrorResponse);
      },
    });
  });
}

function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return Promise.reject(new Error('Refresh token is missing'));
  }

  const pending =
    refreshPromise ??
    new Promise<string>((resolve, reject) => {
      uni.request({
        url: `${API_BASE_URL}/auth/token/refresh`,
        method: 'POST',
        data: { refresh_token: refreshToken },
        header: { 'Content-Type': 'application/json' },
        success(response) {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(response.data);
            return;
          }
          const envelope =
            response.data as ApiSuccessResponse<RefreshResult>;
          setTokens(
            envelope.data.access_token,
            envelope.data.refresh_token,
          );
          resolve(envelope.data.access_token);
        },
        fail: reject,
      });
    }).finally(() => {
      refreshPromise = null;
    });

  refreshPromise = pending;
  return pending;
}
