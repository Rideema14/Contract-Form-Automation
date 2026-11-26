import { NextRequest } from "next/server";
import {
  authError,
  backendApiBaseUrl,
  forwardAuthResponse,
  getContractSetCookie,
  isSameOriginRequest,
} from "@/lib/auth-bff";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return authError(403, "Cross-origin authentication request rejected", "FORBIDDEN");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return authError(400, "Invalid JSON request body", "INVALID_REQUEST");
  }

  let backendUrl: string;
  try {
    backendUrl = `${backendApiBaseUrl()}/auth/login`;
  } catch {
    return authError(500, "Authentication service is misconfigured", "BACKEND_CONFIGURATION_ERROR");
  }

  let response: Response;
  try {
    response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return authError(502, "Authentication service is unavailable", "AUTH_SERVICE_UNAVAILABLE");
  }

  if (!response.ok) return forwardAuthResponse(response);

  const cookie = getContractSetCookie(response.headers);
  if (!cookie || !cookie.value) {
    return authError(502, "Authentication service did not issue a session cookie", "SESSION_COOKIE_MISSING");
  }

  return forwardAuthResponse(response, cookie.header);
}
