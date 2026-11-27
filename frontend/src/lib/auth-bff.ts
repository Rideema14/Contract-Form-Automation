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


export function isSameOriginRequest(request: Request): boolean {
  const configuredOrigin = process.env.FRONTEND_PUBLIC_ORIGIN;

  let expectedOrigin: string;

  if (configuredOrigin) {
    // Reject whitespace or malformed configuration.
    if (configuredOrigin.trim() !== configuredOrigin) {
      return false;
    }

    try {
      const parsedConfiguredOrigin = new URL(configuredOrigin);

      if (
        parsedConfiguredOrigin.protocol !== "https:" ||
        parsedConfiguredOrigin.username ||
        parsedConfiguredOrigin.password ||
        parsedConfiguredOrigin.pathname !== "/" ||
        parsedConfiguredOrigin.search ||
        parsedConfiguredOrigin.hash
      ) {
        return false;
      }

      expectedOrigin = parsedConfiguredOrigin.origin;
    } catch {
      return false;
    }
  } else {
    // Production must always have an explicitly configured public origin.
    if (process.env.NODE_ENV === "production") {
      return false;
    }

    // Preserve local development and test behavior.
    try {
      expectedOrigin = new URL(request.url).origin;
    } catch {
      return false;
    }
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
