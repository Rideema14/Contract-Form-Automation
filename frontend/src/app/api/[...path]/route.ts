import { NextRequest, NextResponse } from "next/server";
import {
  authError,
  backendApiBaseUrl,
  getContractTokenCookie,
  isSameOriginRequest,
} from "@/lib/auth-bff";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "cache-control",
  "content-type",
  "if-match",
  "if-modified-since",
  "if-none-match",
  "if-range",
  "if-unmodified-since",
  "pragma",
  "prefer",
  "range",
];

const RESPONSE_HEADERS = [
  "accept-ranges",
  "allow",
  "cache-control",
  "content-disposition",
  "content-range",
  "content-type",
  "etag",
  "expires",
  "last-modified",
  "retry-after",
  "vary",
  "www-authenticate",
];

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const BODYLESS_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isValidPathSegment(segment: string): boolean {
  return (
    segment.length > 0 &&
    segment !== "." &&
    segment !== ".." &&
    !/[\/\\?#%\u0000-\u001f\u007f]/.test(segment)
  );
}

function createBackendUrl(
  request: NextRequest,
  path: string[],
  backendBaseUrl: string,
): URL | null {
  if (
    path.length === 0 ||
    path[0].toLowerCase() === "auth" ||
    !path.every(isValidPathSegment)
  ) {
    return null;
  }

  let base: URL;
  try {
    base = new URL(backendBaseUrl);
  } catch {
    return null;
  }

  const apiPrefix = base.pathname.replace(/\/+$/, "");
  const trailingSlash = request.nextUrl.pathname.endsWith("/");
  const backendPath = `${apiPrefix}/${path.map(encodeURIComponent).join("/")}${
    trailingSlash ? "/" : ""
  }`;
  const target = new URL(base.origin);
  target.pathname = backendPath;
  target.search = request.nextUrl.search;

  const expectedPrefix = apiPrefix ? `${apiPrefix}/` : "/";
  if (
    target.origin !== base.origin ||
    !target.pathname.startsWith(expectedPrefix)
  ) {
    return null;
  }

  return target;
}

async function proxyApiRequest(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { path } = await context.params;
  const method = request.method.toUpperCase();

  if (MUTATING_METHODS.has(method) && !isSameOriginRequest(request)) {
    return authError(403, "Cross-origin API request rejected", "FORBIDDEN");
  }

  let backendBaseUrl: string;
  try {
    backendBaseUrl = backendApiBaseUrl();
  } catch {
    return authError(500, "Backend API is misconfigured", "BACKEND_CONFIGURATION_ERROR");
  }

  const target = createBackendUrl(request, path, backendBaseUrl);
  if (!target) {
    return authError(400, "Invalid API path", "INVALID_API_PATH");
  }

  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const cookie = getContractTokenCookie(request.headers.get("cookie"));
  if (cookie) headers.set("Cookie", cookie);

  const body = BODYLESS_METHODS.has(method) ? undefined : request.body ?? undefined;
  const upstreamOptions: RequestInit & { duplex?: "half" } = {
    method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
    signal: request.signal,
    ...(body ? { duplex: "half" as const } : {}),
  };

  let upstream: Response;
  try {
    upstream = await fetch(target, upstreamOptions);
  } catch {
    return authError(502, "Backend API is unavailable", "API_SERVICE_UNAVAILABLE");
  }

  const responseHeaders = new Headers({
    "Cache-Control": "private, no-store",
  });
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  const responseBody =
    method === "HEAD" || [204, 205, 304].includes(upstream.status)
      ? null
      : upstream.body;

  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext) {
  return proxyApiRequest(request, context);
}
