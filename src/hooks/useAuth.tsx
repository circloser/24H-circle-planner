import { useCallback, useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  email: string | null;
  provider: string;
}

export interface AuthState {
  user: AuthUser | null;
  plan: 'free' | 'pro';
  loading: boolean;
}

const SIGNED_OUT: AuthState = { user: null, plan: 'free', loading: false };

/** Read the current session from the Worker. Never throws — any failure (no
 * Worker, offline, non-200) resolves to signed-out. */
async function fetchMe(): Promise<AuthState> {
  try {
    const res = await fetch('/api/me', { credentials: 'include', headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`me ${res.status}`);
    const data = (await res.json()) as { user: AuthUser | null; plan?: 'free' | 'pro' };
    return { user: data.user ?? null, plan: data.plan ?? 'free', loading: false };
  } catch {
    return SIGNED_OUT;
  }
}

/**
 * Pro-sync auth. Reads the session from the Worker (`GET /api/me`) and exposes
 * Google sign-in / sign-out.
 *
 * On static/offline hosting where no Worker answers `/api/me` (e.g. the file://
 * verification build), the fetch fails and the user is simply treated as signed
 * out — the app is fully usable without an account.
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, plan: 'free', loading: true });

  useEffect(() => {
    let cancelled = false;
    void fetchMe().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setState(await fetchMe());
  }, []);

  const login = useCallback(() => {
    // Top-level navigation to the Worker, which 302s to Google's consent screen.
    window.location.href = '/api/auth/google/start';
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* ignore — clear local state regardless */
    }
    setState(SIGNED_OUT);
  }, []);

  return { ...state, login, logout, refresh };
}
