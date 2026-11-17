import { apiGet, apiPost } from "@/lib/api-client";
import type { AuthUser, LoginResponse } from "@/types/auth";

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>("/auth/login", { email, password });
}

export function getCurrentUser(): Promise<{ success: true; user: AuthUser }> {
  return apiGet<{ success: true; user: AuthUser }>("/auth/me");
}

export function logout(): Promise<{ success: true; message: string }> {
  return apiPost<{ success: true; message: string }>("/auth/logout");
}
