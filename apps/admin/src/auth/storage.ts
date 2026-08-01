export const ADMIN_ACCESS_TOKEN_KEY = 'fruit_b2b_admin_access_token';
export const ADMIN_REFRESH_TOKEN_KEY = 'fruit_b2b_admin_refresh_token';
export const ADMIN_PRINCIPAL_KEY = 'fruit_b2b_admin_principal';

export function getStoredAccessToken(): string | null {
  return window.localStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  return window.localStorage.getItem(ADMIN_REFRESH_TOKEN_KEY);
}

export function storeTokens(accessToken: string, refreshToken: string): void {
  window.localStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, refreshToken);
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_PRINCIPAL_KEY);
}
