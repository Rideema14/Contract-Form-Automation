import { NextResponse } from "next/server";

// Placeholder: route protection is added with the authentication module.
// Real authorization is always enforced by the Express backend.
export function middleware() {
  return NextResponse.next();
}
