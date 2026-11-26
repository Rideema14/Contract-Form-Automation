import { NextRequest } from "next/server";
import {
  authError,
  backendApiBaseUrl,
  clearContractCookieHeader,
  forwardAuthResponse,
  getContractSetCookie,
  getContractTokenCookie,
  isSameOriginRequest,
} from "@/lib/auth-bff";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return authError(403, "Cross-origin authentication request rejected", "FORBIDDEN");
  }

  const cookie = getContractTokenCookie(request.headers.get("cookie"));

  let backendUrl: string;
  try {
    backendUrl = `${backendApiBaseUrl()}/auth/logout`;
  } catch {
    const error = authError(500, "Authentication service is misconfigured", "BACKEND_CONFIGURATION_ERROR");
    error.headers.set("Set-Cookie", clearContractCookieHeader());
    return error;
  }

  let response: Response;
  try {
    response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    const error = authError(
      502,
      "Authentication service is unavailable",
      "AUTH_SERVICE_UNAVAILABLE",
    );
    error.headers.set("Set-Cookie", clearContractCookieHeader());
    return error;
  }

  const cookieToClear = getContractSetCookie(response.headers);
  return forwardAuthResponse(
    response,
    cookieToClear?.value === "" ? cookieToClear.header : clearContractCookieHeader(),
  );
}
