export type PrincipalType = 'EMPLOYEE' | 'CUSTOMER_ACCOUNT';

export type AuthPrincipal = {
  subjectId: string;
  tenantId: string;
  tenantCode: string;
  principalType: PrincipalType;
  userId: string | null;
  customerAccountId: string | null;
  customerId: string | null;
  displayName: string;
  roleCode: string;
  permissions: string[];
  sessionId: string;
};

export type TokenPayload = {
  sub: string;
  tenant_id: string;
  tenant_code: string;
  principal_type: PrincipalType;
  user_id: string | null;
  customer_account_id: string | null;
  customer_id: string | null;
  role_code: string;
  session_id: string;
  token_type: 'access' | 'refresh';
  refresh_jti?: string;
  iat?: number;
  exp?: number;
};

export type SessionRecord = {
  subjectId: string;
  tenantId: string;
  principalType: PrincipalType;
  refreshJti: string;
};
