import { apiClient } from './client';

export type AuthPrincipal = {
  id: string;
  tenant_id: string;
  tenant_code: string;
  principal_type: 'EMPLOYEE' | 'CUSTOMER_ACCOUNT';
  user_id: string | null;
  customer_account_id: string | null;
  customer_id: string | null;
  display_name: string;
  role_code: string;
  permissions: string[];
};

export type LoginResult = {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  session_id: string;
  principal: AuthPrincipal;
};

type ApiEnvelope<T> = {
  code: 'OK';
  message: string;
  data: T;
};

export async function employeeLogin(input: {
  tenant_code: string;
  username: string;
  password: string;
}): Promise<LoginResult> {
  const response = await apiClient.post<ApiEnvelope<LoginResult>>(
    '/auth/employee/login',
    input,
  );
  return response.data.data;
}

export async function getCurrentPrincipal(): Promise<AuthPrincipal> {
  const response =
    await apiClient.get<ApiEnvelope<AuthPrincipal>>('/auth/me');
  return response.data.data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}
