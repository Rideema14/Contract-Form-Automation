
import type {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "@/types/api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details: unknown[];
  statusCode: number;

  constructor(response: ApiErrorResponse, status: number) {
    super(response.message);
    this.name = "ApiError";
    this.status = status;
    this.statusCode = status;
    this.code = response.error?.code;
    this.details = response.error?.details ?? [];
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

function isApiSuccessResponse(
  value: unknown,
): value is ApiSuccessResponse<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    value.success === true
  );
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    value.success === false
  );
}

function isFormDataBody(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function toApiError(response: Response, payload: unknown): ApiError {
  const errorResponse: ApiErrorResponse = isApiErrorResponse(payload)
    ? payload
    : {
        success: false,
        message: `API request failed: ${response.status}`,
        error: {
          code: "HTTP_ERROR",
          details: [],
        },
      };

  return new ApiError(errorResponse, response.status);
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const payload = await requestPayload(path, options);

  if (isApiSuccessResponse(payload) && "data" in payload) {
    return payload.data as T;
  }

  return payload as T;
}

export async function apiRequestWithMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiSuccessResponse<T>> {
  const payload = await requestPayload(path, options);

  if (isApiSuccessResponse(payload) && "data" in payload) {
    return payload as ApiSuccessResponse<T>;
  }

  throw new Error("Expected an API success response envelope.");
}

async function requestPayload(
  path: string,
  options: RequestOptions,
): Promise<unknown> {
  const headers = new Headers(options.headers);
  const isFormData = isFormDataBody(options.body);
  const body: BodyInit | undefined =
    options.body === undefined
      ? undefined
      : isFormDataBody(options.body)
        ? options.body
        : JSON.stringify(options.body);

  if (options.body !== undefined && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
    body,
    cache: "no-store",
  });

  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok || isApiErrorResponse(payload)) {
    throw toApiError(response, payload);
  }

  return payload;
}

export async function apiGetBlob(path: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => undefined);
    throw toApiError(response, payload);
  }

  return response.blob();
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "PATCH", body });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "PUT", body });
}

export function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "DELETE" });
}

