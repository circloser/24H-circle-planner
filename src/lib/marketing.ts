/**
 * News-email consent (app half). See worker/marketing.ts for why this exists:
 * the email stored at Google sign-in may only be used for the session and the
 * subscription check, so a mailing list needs its own explicit opt-in.
 */

/** Must equal the worker's MARKETING_CONSENT_VERSION (a test pins them together). */
export const MARKETING_CONSENT_VERSION = '2026-09-11';

/** Closing the question without answering holds it back for two weeks on this device. */
const DISMISS_KEY = '24h-circle-planner.marketing-ask-dismissed';
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

export interface MarketingState {
  decided: boolean;
  optIn: boolean;
  version: string;
  decidedAt: number | null;
}

function isState(x: unknown): x is MarketingState {
  if (!x || typeof x !== 'object') return false;
  const s = x as Record<string, unknown>;
  return typeof s.decided === 'boolean' && typeof s.optIn === 'boolean' && typeof s.version === 'string'
    && (s.decidedAt === null || typeof s.decidedAt === 'number');
}

export async function fetchMarketing(): Promise<MarketingState | null> {
  try {
    const res = await fetch('/api/marketing', { credentials: 'include', headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return isState(data) ? data : null;
  } catch {
    return null;
  }
}

/** 'stale' = the server's notice has moved on from the one this build shows. */
export async function saveMarketing(optIn: boolean): Promise<MarketingState | 'stale' | null> {
  try {
    const res = await fetch('/api/marketing', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ optIn, version: MARKETING_CONSENT_VERSION }),
    });
    if (res.status === 409) return 'stale';
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return isState(data) ? data : null;
  } catch {
    return null;
  }
}

export function wasRecentlyDismissed(now = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && now - at < DISMISS_MS;
  } catch {
    return false;
  }
}

export function rememberDismissal(now = Date.now()): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(now));
  } catch {
    /* storage unavailable — the question may come back sooner, which is harmless */
  }
}

/** Local calendar date, YYYY-MM-DD — the date a user would call "today". */
export function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
