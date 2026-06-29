/**
 * 24Houring API Worker — Pro sync backend.
 *
 * Phase 1: /api/health + ASSETS fallthrough.
 * Phase 2: Google OAuth (code + PKCE) → opaque session cookie in D1; /api/me,
 *          /api/logout. Sync + billing arrive in later phases.
 * See docs/pro-sync-design.md.
 */

export interface Env {
  /** Static assets binding (the built SPA in ./dist). */
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  /** D1 database (Pro sync). Optional until the binding is live everywhere. */
  DB?: D1Database;
  /** Google OAuth client (set as Worker secrets). */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

const SID_COOKIE = 'sid';
const TX_COOKIE = 'oauth_tx';
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToString(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function randomToken(bytes = 32): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64urlFromBytes(a);
}

async function sha256b64url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return b64urlFromBytes(new Uint8Array(digest));
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookie(name: string, value: string, maxAge: number): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(b64urlToString(parts[1])) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function redirectHome(origin: string, setCookie: string, query: string): Response {
  return new Response(null, { status: 302, headers: { location: `${origin}/${query}`, 'set-cookie': setCookie } });
}

// ─── D1 ──────────────────────────────────────────────────────────────────────

interface UserRow { id: string; provider: string; provider_sub: string; email: string | null; created_at: number }

async function upsertUser(db: D1Database, provider: string, sub: string, email: string | null): Promise<string> {
  const found = await db.prepare('SELECT id FROM users WHERE provider=? AND provider_sub=?').bind(provider, sub).first<{ id: string }>();
  if (found?.id) {
    if (email) await db.prepare('UPDATE users SET email=? WHERE id=?').bind(email, found.id).run();
    return found.id;
  }
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO users (id, provider, provider_sub, email, created_at) VALUES (?,?,?,?,?)').bind(id, provider, sub, email, Date.now()).run();
  return id;
}

async function createSession(db: D1Database, userId: string): Promise<string> {
  const token = randomToken(32);
  const now = Date.now();
  await db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)').bind(token, userId, now, now + SESSION_TTL_MS).run();
  return token;
}

async function sessionUser(db: D1Database, token: string): Promise<UserRow | null> {
  return db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token=? AND s.expires_at > ?').bind(token, Date.now()).first<UserRow>();
}

/** The signed-in user for this request (via the `sid` cookie), or null. */
async function currentUser(request: Request, env: Env): Promise<UserRow | null> {
  if (!env.DB) return null;
  const sid = parseCookies(request.headers.get('cookie'))[SID_COOKIE];
  if (!sid) return null;
  return sessionUser(env.DB, sid);
}

// ─── OAuth (Google) ───────────────────────────────────────────────────────────

function callbackUrl(request: Request): string {
  return new URL(request.url).origin + '/api/auth/google/callback';
}

async function handleStart(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID) return json({ error: 'oauth_not_configured' }, 503);
  const state = randomToken(16);
  const verifier = randomToken(32);
  const challenge = await sha256b64url(verifier);
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(request),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'online',
    prompt: 'select_account',
  });
  return new Response(null, {
    status: 302,
    headers: {
      location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      'set-cookie': cookie(TX_COOKIE, JSON.stringify({ state, verifier }), 600),
    },
  });
}

async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  const clearTx = cookie(TX_COOKIE, '', 0);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  let tx: { state: string; verifier: string } | null = null;
  try {
    const raw = parseCookies(request.headers.get('cookie'))[TX_COOKIE];
    const o = raw ? JSON.parse(raw) : null;
    if (o && typeof o.state === 'string' && typeof o.verifier === 'string') tx = o;
  } catch { /* ignore */ }

  if (!code || !state || !tx || tx.state !== state) return redirectHome(origin, clearTx, '?login_error=state');
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.DB) return redirectHome(origin, clearTx, '?login_error=unconfigured');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl(request),
      code_verifier: tx.verifier,
    }).toString(),
  });
  if (!tokenRes.ok) return redirectHome(origin, clearTx, '?login_error=token');

  const token = (await tokenRes.json()) as { id_token?: string };
  const payload = token.id_token ? decodeJwtPayload(token.id_token) : null;
  if (!payload) return redirectHome(origin, clearTx, '?login_error=idtoken');

  const sub = String(payload.sub ?? '');
  const aud = String(payload.aud ?? '');
  const iss = String(payload.iss ?? '');
  const exp = Number(payload.exp ?? 0);
  const validIss = iss === 'https://accounts.google.com' || iss === 'accounts.google.com';
  if (!sub || aud !== env.GOOGLE_CLIENT_ID || !validIss || exp * 1000 < Date.now()) {
    return redirectHome(origin, clearTx, '?login_error=claims');
  }

  const email = typeof payload.email === 'string' ? payload.email : null;
  const userId = await upsertUser(env.DB, 'google', sub, email);
  const sid = await createSession(env.DB, userId);

  const headers = new Headers();
  headers.append('set-cookie', clearTx);
  headers.append('set-cookie', cookie(SID_COOKIE, sid, Math.floor(SESSION_TTL_MS / 1000)));
  headers.set('location', `${origin}/?login=ok`);
  return new Response(null, { status: 302, headers });
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ user: null });
  const sid = parseCookies(request.headers.get('cookie'))[SID_COOKIE];
  if (!sid) return json({ user: null });
  const user = await sessionUser(env.DB, sid);
  if (!user) return json({ user: null });
  const sub = await env.DB.prepare('SELECT status, current_period_end FROM subscriptions WHERE user_id=?').bind(user.id).first<{ status: string; current_period_end: number | null }>();
  const active = !!sub && (sub.status === 'active' || sub.status === 'on_trial') && (sub.current_period_end == null || sub.current_period_end > Date.now());
  return json({ user: { id: user.id, email: user.email, provider: user.provider }, plan: active ? 'pro' : 'free' });
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const sid = parseCookies(request.headers.get('cookie'))[SID_COOKIE];
  if (sid && env.DB) await env.DB.prepare('DELETE FROM sessions WHERE token=?').bind(sid).run();
  return json({ ok: true }, 200, { 'set-cookie': cookie(SID_COOKIE, '', 0) });
}

// ─── Sync (Pro cross-device) ───────────────────────────────────────────────────
// One JSON blob per user + a monotonic version for last-write-wins. See
// docs/pro-sync-design.md §4. Beta: any signed-in user may sync (subscription
// gating arrives with billing in a later phase).

const MAX_BLOB_BYTES = 1_000_000; // 1 MB cap (design §4-1)

interface SyncRow { blob: string; version: number; updated_at: number; device_label: string | null }

async function handleSyncGet(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: 'unconfigured' }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const row = await env.DB.prepare('SELECT blob, version, updated_at, device_label FROM sync_data WHERE user_id=?').bind(user.id).first<SyncRow>();
  if (!row) return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  return json({ blob: row.blob, version: row.version, updatedAt: row.updated_at, deviceLabel: row.device_label });
}

async function handleSyncPut(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: 'unconfigured' }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: { blob?: unknown; baseVersion?: unknown; deviceLabel?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const blob = typeof body.blob === 'string' ? body.blob : null;
  if (blob === null) return json({ error: 'missing_blob' }, 400);
  if (blob.length > MAX_BLOB_BYTES) return json({ error: 'too_large' }, 413);
  const baseVersion = typeof body.baseVersion === 'number' ? body.baseVersion : 0;
  const deviceLabel = typeof body.deviceLabel === 'string' ? body.deviceLabel.slice(0, 64) : null;
  const now = Date.now();

  const row = await env.DB.prepare('SELECT blob, version, updated_at, device_label FROM sync_data WHERE user_id=?').bind(user.id).first<SyncRow>();

  if (!row) {
    // First snapshot for this user.
    try {
      await env.DB.prepare('INSERT INTO sync_data (user_id, blob, version, updated_at, device_label) VALUES (?,?,?,?,?)').bind(user.id, blob, 1, now, deviceLabel).run();
      return json({ version: 1, updatedAt: now });
    } catch {
      // Lost an insert race — re-read and report the conflict.
      const r2 = await env.DB.prepare('SELECT blob, version, updated_at, device_label FROM sync_data WHERE user_id=?').bind(user.id).first<SyncRow>();
      if (r2) return json({ error: 'conflict', blob: r2.blob, version: r2.version, updatedAt: r2.updated_at, deviceLabel: r2.device_label }, 409);
      return json({ error: 'write_failed' }, 500);
    }
  }

  if (baseVersion !== row.version) {
    // Caller is behind — hand back the server's current snapshot to reconcile.
    return json({ error: 'conflict', blob: row.blob, version: row.version, updatedAt: row.updated_at, deviceLabel: row.device_label }, 409);
  }

  const newVersion = row.version + 1;
  await env.DB.prepare('UPDATE sync_data SET blob=?, version=?, updated_at=?, device_label=? WHERE user_id=?').bind(blob, newVersion, now, deviceLabel, user.id).run();
  return json({ version: newVersion, updatedAt: now });
}

// ─── Router ──────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const p = url.pathname;
    const m = request.method;

    if (p.startsWith('/api/')) {
      if (p === '/api/health' && m === 'GET') {
        return json({ ok: true, service: '24houring-api', db: Boolean(env.DB), auth: Boolean(env.GOOGLE_CLIENT_ID), ts: Date.now() });
      }
      if (p === '/api/auth/google/start' && m === 'GET') return handleStart(request, env);
      if (p === '/api/auth/google/callback' && m === 'GET') return handleCallback(request, env);
      if (p === '/api/me' && m === 'GET') return handleMe(request, env);
      if (p === '/api/logout' && m === 'POST') return handleLogout(request, env);
      if (p === '/api/sync' && m === 'GET') return handleSyncGet(request, env);
      if (p === '/api/sync' && m === 'PUT') return handleSyncPut(request, env);
      return json({ error: 'not_found' }, 404);
    }

    // Non-API request → serve the SPA (unchanged behaviour).
    return env.ASSETS.fetch(request);
  },
};
