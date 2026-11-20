import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/register"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api";
  try {
    const response = await fetch(`${apiBase}/auth/me`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (response.ok) return NextResponse.next();
  } catch {
    // The login page will show the backend connection state.
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}
