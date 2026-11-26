import { NextRequest, NextResponse } from "next/server";
import { getContractTokenCookie } from "@/lib/auth-bff";

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

  let shouldClearCookie = false;
  try {
    const cookie = getContractTokenCookie(request.headers.get("cookie"));
    const authUrl = new URL("/api/auth/me", request.url);
    const response = await fetch(authUrl, {
      headers: cookie ? { Cookie: cookie } : undefined,
      cache: "no-store",
      redirect: "manual",
    });
    if (response.ok) return NextResponse.next();
    shouldClearCookie = response.status === 401;
  } catch {
    // The login page will show the backend connection state.
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
