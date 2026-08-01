const ACCESS_TOKEN_KEY = 'fruit_b2b_customer_access_token';
const REFRESH_TOKEN_KEY = 'fruit_b2b_customer_refresh_token';
const PRINCIPAL_KEY = 'fruit_b2b_customer_principal';

export type CustomerPrincipal = {
  id: string;
  tenant_id: string;
  tenant_code: string;
  principal_type: 'CUSTOMER_ACCOUNT';
  customer_account_id: string;
  customer_id: string;
  display_name: string;
  role_code: 'CUSTOMER';
  permissions: string[];
};

export function getAccessToken(): string | null {
  return uni.getStorageSync(ACCESS_TOKEN_KEY) || null;
}

export function setAccessToken(token: string): void {
  uni.setStorageSync(ACCESS_TOKEN_KEY, token);
}

export function getRefreshToken(): string | null {
  return uni.getStorageSync(REFRESH_TOKEN_KEY) || null;
}

export function setTokens(accessToken: string, refreshToken: string): void {
  uni.setStorageSync(ACCESS_TOKEN_KEY, accessToken);
  uni.setStorageSync(REFRESH_TOKEN_KEY, refreshToken);
}

export function getStoredPrincipal(): CustomerPrincipal | null {
  const value = uni.getStorageSync(PRINCIPAL_KEY) as
    | CustomerPrincipal
    | ''
    | undefined;
  return value || null;
}

export function setStoredPrincipal(principal: CustomerPrincipal): void {
  uni.setStorageSync(PRINCIPAL_KEY, principal);
}

export function clearSessionStorage(): void {
  uni.removeStorageSync(ACCESS_TOKEN_KEY);
  uni.removeStorageSync(REFRESH_TOKEN_KEY);
  uni.removeStorageSync(PRINCIPAL_KEY);
}
