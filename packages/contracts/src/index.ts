export type ApiSuccessResponse<T> = {
  code: 'OK';
  message: string;
  data: T;
  request_id: string;
  timestamp: string;
};

export type ApiErrorResponse = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  request_id: string;
  timestamp: string;
};

export type PaginatedData<T> = {
  items: T[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

export const SALE_TYPES = ['PIECE', 'WEIGHT'] as const;
export type SaleType = (typeof SALE_TYPES)[number];

export const PRINCIPAL_TYPES = ['CUSTOMER_ACCOUNT', 'EMPLOYEE'] as const;
export type PrincipalType = (typeof PRINCIPAL_TYPES)[number];
