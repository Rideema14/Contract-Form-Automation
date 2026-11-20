export type ApiMeta = {
  requestId?: string;
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  [key: string]: unknown;
};

export type ApiSuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
  meta?: ApiMeta;
};

export type ApiErrorResponse = {
  success: false;
  message: string;
  error?: {
    code?: string;
    details?: unknown[];
  };
  meta?: ApiMeta;
};
