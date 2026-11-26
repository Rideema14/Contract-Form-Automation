import { NextRequest } from "next/server";
import {
  authError,
  backendApiBaseUrl,
  clearContractCookieHeader,
  forwardAuthResponse,
  getContractTokenCookie,
} from "@/lib/auth-bff";

export async function GET(request: NextRequest) {
  const cookie = getContractTokenCookie(request.headers.get("cookie"));
  if (!cookie) {
    const response = authError(401, "Authentication required", "UNAUTHENTICATED");
    response.headers.set("Set-Cookie", clearContractCookieHeader());
    return response;
  }

  let backendUrl: string;
  try {
    backendUrl = `${backendApiBaseUrl()}/auth/me`;
  } catch {
    return authError(500, "Authentication service is misconfigured", "BACKEND_CONFIGURATION_ERROR");
  }

  let response: Response;
  try {
    response = await fetch(backendUrl, {
      headers: {
        Accept: "application/json",
        Cookie: cookie,
      },
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return authError(502, "Authentication service is unavailable", "AUTH_SERVICE_UNAVAILABLE");
  }

  return forwardAuthResponse(
    response,
    response.status === 401 ? clearContractCookieHeader() : undefined,
  );
}
