'use client';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

/** Hook to fetch the currently authenticated user via backend endpoint */
export function useAuth() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const rawResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api'}/auth/me`,
          {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          }
        );
        if (rawResponse.ok) {
          const body = (await rawResponse.json()) as { success: boolean; user: AuthUser };
          setAuthUser(body.user);
        } else if (rawResponse.status === 401) {
          // Not authenticated – treat as no user.
          setAuthUser(null);
        } else {
          const errBody = await rawResponse.json().catch(() => null);
          const msg = errBody?.message || `Request failed with status ${rawResponse.status}`;
          throw new ApiError(rawResponse.status, 'REQUEST_FAILED', msg);
        }
      } catch (e) {
        if (e instanceof ApiError) {
          if (e.statusCode !== 401) {
            setError(e.message);
          }
        } else {
          setError(String(e));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { authUser, loading, error };
}
