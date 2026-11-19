const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    requestId?: string;
    pagination?: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  };
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details: unknown[] = []
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body?.message || `Request failed with status ${response.status}`;
    const code = body?.error?.code || "REQUEST_FAILED";
    const details = body?.error?.details || [];
    throw new ApiError(response.status, code, message, details);
  }

  return body as ApiResponse<T>;
}

export async function apiPost<T>(path: string, payload?: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body?.message || `Request failed with status ${response.status}`;
    const code = body?.error?.code || "REQUEST_FAILED";
    const details = body?.error?.details || [];
    throw new ApiError(response.status, code, message, details);
  }

  return body as ApiResponse<T>;
}

export async function apiPatch<T>(path: string, payload?: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message = body?.message || `Request failed with status ${response.status}`;
    const code = body?.error?.code || "REQUEST_FAILED";
    const details = body?.error?.details || [];
    throw new ApiError(response.status, code, message, details);
  }

  return body as ApiResponse<T>;
}
