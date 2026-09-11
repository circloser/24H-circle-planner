/**
 * Mailing-list consent (app half). See worker/marketing.ts for why this exists:
 * the email stored at Google sign-in may only be used for the session and the
 * subscription check, so a mailing list needs its own explicit opt-in.
 *
 * Nobody is asked unprompted. Joining starts from the ⚙ menu.
 */

/** Must equal the worker's MARKETING_CONSENT_VERSION (a test pins them together). */
export const MARKETING_CONSENT_VERSION = '2026-09-11.2';

/**
 * Set when a signed-out visitor presses "sign in" inside the mailing-list
 * dialog, so the dialog they were in reopens once they are back from Google.
 * Session-scoped: it belongs to that one round trip, not to the device.
 */
const RESUME_KEY = '24h-circle-planner.mailing-list-resume';

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

export function rememberMarketingResume(): void {
  try {
    sessionStorage.setItem(RESUME_KEY, '1');
  } catch {
    /* storage unavailable — the user just reopens the menu item after signing in */
  }
}

/** True once, right after the sign-in round trip that the dialog started. */
export function consumeMarketingResume(): boolean {
  try {
    if (sessionStorage.getItem(RESUME_KEY) !== '1') return false;
    sessionStorage.removeItem(RESUME_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Local calendar date, YYYY-MM-DD — the date a user would call "today". */
export function localDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
