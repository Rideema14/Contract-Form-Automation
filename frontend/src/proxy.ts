import { NextRequest, NextResponse } from "next/server";
import { backendApiBaseUrl, getContractTokenCookie } from "@/lib/auth-bff";

const PUBLIC_PATHS = new Set(["/login", "/register", "/deploy-info.json"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    // API Route Handlers enforce backend authentication and authorization.
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const cookie = getContractTokenCookie(request.headers.get("cookie"));
  let shouldClearCookie = !cookie;
  if (cookie) {
    try {
      // Ask the backend directly. Calling this app's own /api/auth/me through
      // request.url fails behind Azure, where that URL is https://localhost:<port>.
      const response = await fetch(`${backendApiBaseUrl()}/auth/me`, {
        headers: { Accept: "application/json", Cookie: cookie },
        cache: "no-store",
        redirect: "manual",
      });
      if (response.ok) return NextResponse.next();
      shouldClearCookie = response.status === 401;
    } catch (error) {
      // The login page will show the backend connection state.
      console.error("Session check failed", error);
    }
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  const redirect = NextResponse.redirect(loginUrl);
  if (shouldClearCookie) {
    redirect.cookies.set("contract_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return redirect;
}
