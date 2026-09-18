/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { track } from '@/lib/track';

export interface AuthUser {
  id: string;
  email: string | null;
  provider: string;
}

export interface AuthState {
  user: AuthUser | null;
  plan: 'free' | 'pro';
  /** True once the Worker has Polar billing configured (gates the upgrade CTA). */
  billingEnabled: boolean;
  /** True when the signed-in email is on the admin allowlist (shows coupon panel). */
  admin: boolean;
  loading: boolean;
}

export interface AuthContextValue extends AuthState {
  login: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SIGNED_OUT: AuthState = { user: null, plan: 'free', billingEnabled: false, admin: false, loading: false };

/** The last session the server confirmed, kept on this device only for the
 *  case below. */
const AUTH_CACHE_KEY = '24h-auth-last';

function rememberAuth(state: AuthState): void {
  try {
    if (state.user) localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ ...state, loading: false }));
    else localStorage.removeItem(AUTH_CACHE_KEY);
  } catch { /* storage unavailable */ }
}

function lastAuth(): AuthState | null {
  try {
    const s = JSON.parse(localStorage.getItem(AUTH_CACHE_KEY) ?? 'null') as AuthState | null;
    return s && s.user ? { ...s, loading: false } : null;
  } catch {
    return null;
  }
}

/** Read the current session from the Worker. Never throws — any failure (no
 * Worker, offline, non-200) resolves to signed-out, except one: when the server
 * says its database is busy (503), the session is still valid, so the last one
 * it confirmed stands and sync simply reports the server as resting. */
async function fetchMe(): Promise<AuthState> {
  try {
    const res = await fetch('/api/me', { credentials: 'include', headers: { accept: 'application/json' } });
    if (res.status === 503) return lastAuth() ?? SIGNED_OUT;
    if (!res.ok) throw new Error(`me ${res.status}`);
    const data = (await res.json()) as { user: AuthUser | null; plan?: 'free' | 'pro'; billing?: boolean; admin?: boolean };
    const state = { user: data.user ?? null, plan: data.plan ?? 'free', billingEnabled: Boolean(data.billing), admin: Boolean(data.admin), loading: false } as AuthState;
    rememberAuth(state);
    return state;
  } catch {
    return SIGNED_OUT;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Pro-sync auth. Reads the session from the Worker (`GET /api/me`) once and
 * shares it app-wide, exposing Google sign-in / sign-out.
 *
 * On static/offline hosting where no Worker answers `/api/me` (e.g. the file://
 * verification build), the fetch fails and the user is simply treated as signed
 * out — the app is fully usable without an account.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, plan: 'free', billingEnabled: false, admin: false, loading: true });

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
    track('login_start');
    // Top-level navigation to the Worker, which 302s to Google's consent screen.
    window.location.href = '/api/auth/google/start';
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* ignore — clear local state regardless */
    }
    rememberAuth(SIGNED_OUT);
    setState(SIGNED_OUT);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, refresh }),
    [state, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Consume the shared auth state. Returns signed-out defaults if no provider is
 * mounted (keeps components safe to render anywhere). */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  return { ...SIGNED_OUT, login: () => {}, logout: async () => {}, refresh: async () => {} };
}
