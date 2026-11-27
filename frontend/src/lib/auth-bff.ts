import { NextResponse } from "next/server";

const COOKIE_NAME = "contract_token";
const DEFAULT_BACKEND_API_BASE_URL = "http://localhost:4000/api";

export function backendApiBaseUrl(): string {
  const configuredUrl =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    DEFAULT_BACKEND_API_BASE_URL;
  const authority = /^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i.exec(configuredUrl)?.[1];
  const baseUrl = new URL(configuredUrl);
  const isLoopback =
    baseUrl.hostname === "localhost" ||
    baseUrl.hostname === "127.0.0.1" ||
    baseUrl.hostname === "[::1]" ||
    baseUrl.hostname === "::1";
  const isLocalDevelopment =
    process.env.NODE_ENV === "development" &&
    baseUrl.protocol === "http:" &&
    isLoopback;

  if (
    (baseUrl.protocol !== "https:" && !isLocalDevelopment) ||
    baseUrl.username ||
    baseUrl.password ||
    authority?.includes("@") ||
    configuredUrl.trim() !== configuredUrl ||
    configuredUrl.includes("?") ||
    configuredUrl.includes("#") ||
    !/^\/api\/?$/i.test(baseUrl.pathname) ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new Error("The configured backend API URL is invalid.");
  }

  return `${baseUrl.origin}/api`;
}

function parseAppOrigin(value: string): URL | null {
  // Only a bare origin is accepted: no credentials, path, query or fragment.
  if (!/^https?:\/\/[^/\\?#@\s]+\/?$/i.test(value)) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * The public origin that browsers use to reach this app.
 *
 * Behind a reverse proxy such as Azure App Service, Next.js builds `request.url`
 * from its internal listener (for example https://localhost:8080), so production
 * relies on server configuration instead of anything sent with the request:
 *   1. APP_ORIGIN, if set (required for a custom domain).
 *   2. WEBSITE_HOSTNAME, which Azure App Service sets automatically.
 * Outside production, with neither set, the Host header is used.
 * Returns null when no trustworthy origin can be determined.
 */
export function publicAppOrigin(request: Request): string | null {
  const isProduction = process.env.NODE_ENV === "production";
  const azureHostname = process.env.WEBSITE_HOSTNAME;
  const configured =
    process.env.APP_ORIGIN ||
    (azureHostname ? `https://${azureHostname}` : undefined);

  if (configured) {
    const url = parseAppOrigin(configured);
    if (!url || (isProduction && url.protocol !== "https:")) return null;
    return url.origin;
  }

  if (isProduction) return null;

  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  return parseAppOrigin(`${requestUrl.protocol}//${host}`)?.origin ?? null;
}

export function isSameOriginRequest(request: Request): boolean {
  const expectedOrigin = publicAppOrigin(request);
  if (!expectedOrigin) {
    console.error(
      "Rejected request: set APP_ORIGIN to the public HTTPS origin of this app, for example https://app.example.com",
    );
    return false;
  }

  const origin = request.headers.get("origin");

  if (origin !== null) {
    try {
      const parsedOrigin = new URL(origin);
      return (
        parsedOrigin.origin === expectedOrigin &&
        !parsedOrigin.username &&
        !parsedOrigin.password &&
        parsedOrigin.pathname === "/" &&
        !parsedOrigin.search &&
        !parsedOrigin.hash
      );
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("referer");
  if (referer !== null) {
    try {
      const parsedReferer = new URL(referer);
      return (
        parsedReferer.origin === expectedOrigin &&
        !parsedReferer.username &&
        !parsedReferer.password
      );
    } catch {
      return false;
    }
  }

  return request.headers.get("sec-fetch-site") === "same-origin";
}

export function getContractTokenCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  let tokenCookie: string | null = null;
  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== COOKIE_NAME) {
      continue;
    }

    const value = cookie.slice(separator + 1).trim();
    if (!value || /[\u0000-\u0020\u007f;,]/.test(value) || tokenCookie) {
      return null;
    }
    tokenCookie = `${COOKIE_NAME}=${value}`;
  }

  return tokenCookie;
}

export function getContractSetCookie(headers: Headers): {
  header: string;
  value: string;
} | null {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const values =
    typeof headersWithSetCookie.getSetCookie === "function"
      ? headersWithSetCookie.getSetCookie()
      : [headers.get("set-cookie") ?? ""];

  for (const setCookie of values) {
    const [cookiePair, ...attributes] = setCookie.split(";");
    const separator = cookiePair.indexOf("=");
    if (separator < 0 || cookiePair.slice(0, separator).trim() !== COOKIE_NAME) {
      continue;
    }

    const value = cookiePair.slice(separator + 1).trim();
    const maxAge = attributes
      .map((attribute) => attribute.trim())
      .find((attribute) => /^max-age=-?\d+$/i.test(attribute));
    const expires = attributes
      .map((attribute) => attribute.trim())
      .find((attribute) => {
        const match = /^expires=(.+)$/i.exec(attribute);
        return Boolean(match && !Number.isNaN(Date.parse(match[1])));
      });
    const hasSecure = attributes.some(
      (attribute) => attribute.trim().toLowerCase() === "secure",
    );
    const secure = process.env.NODE_ENV === "production" || hasSecure;

    const forwardedAttributes = [
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      maxAge,
      expires,
      secure ? "Secure" : undefined,
    ].filter((attribute): attribute is string => Boolean(attribute));

    return {
      header: `${COOKIE_NAME}=${value}; ${forwardedAttributes.join("; ")}`,
      value,
    };
  }

  return null;
}

export function clearContractCookieHeader(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`;
}

export function authError(
  status: number,
  message: string,
  code: string,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      message,
      error: { code, details: [] },
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function forwardAuthResponse(
  response: Response,
  cookie?: string,
): Promise<NextResponse> {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": response.headers.get("content-type") ?? "application/json",
  });
  if (cookie) headers.set("Set-Cookie", cookie);

  const body = [204, 205, 304].includes(response.status)
    ? null
    : await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers,
  });
}
