'use client';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { getCurrentUser } from '@/services/auth';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

/** Hook to fetch the currently authenticated user via the same-origin auth route. */
export function useAuth() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const response = await getCurrentUser();
        setAuthUser({
          ...response.user,
          fullName: response.user.fullName ?? response.user.name,
        });
      } catch (e) {
        if (e instanceof ApiError && e.statusCode === 401) {
          setAuthUser(null);
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { authUser, loading, error };
}
