/**
 * 24Houring API Worker — Pro sync backend.
 *
 * Phase 1: /api/health + ASSETS fallthrough.
 * Phase 2: Google OAuth (code + PKCE) → opaque session cookie in D1; /api/me,
 *          /api/logout. Sync + billing arrive in later phases.
 * See docs/pro-sync-design.md.
 */

import { sendWebPush } from '../src/lib/webpush';

export interface Env {
  /** Static assets binding (the built SPA in ./dist). */
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  /** D1 database (Pro sync). Optional until the binding is live everywhere. */
  DB?: D1Database;
  /** Google OAuth client (set as Worker secrets). */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Polar billing (Merchant of Record). Token + webhook secret are Worker secrets;
   *  server + product id are non-secret vars (wrangler.jsonc). */
  POLAR_ACCESS_TOKEN?: string; // Organization Access Token (polar_oat_…)
  POLAR_WEBHOOK_SECRET?: string; // Standard Webhooks secret (polar_whs_…)
  POLAR_PRODUCT_ID?: string; // Pro product id
  POLAR_SERVER?: string; // 'sandbox' (default) | 'production'
  /** Comma-separated emails always entitled to Pro (no subscription). Non-secret var. */
  ADMIN_EMAILS?: string;
  /** Web Push (Pro closed-tab alarms): VAPID public key (var) + subject (var);
   *  the pkcs8 private key lives in the VAPID_PRIVATE_KEY runtime secret. */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

/** Whether `email` is on the admin allowlist (always Pro). */
function isAdminEmail(env: Env, email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(email.toLowerCase());
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

async function upsertUser(db: D1Database, provider: string, sub: string, email: string | null): Promise<{ id: string; isNew: boolean }> {
  const found = await db.prepare('SELECT id FROM users WHERE provider=? AND provider_sub=?').bind(provider, sub).first<{ id: string }>();
  if (found?.id) {
    if (email) await db.prepare('UPDATE users SET email=? WHERE id=?').bind(email, found.id).run();
    return { id: found.id, isNew: false };
  }
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO users (id, provider, provider_sub, email, created_at) VALUES (?,?,?,?,?)').bind(id, provider, sub, email, Date.now()).run();
  return { id, isNew: true };
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

async function handleCallback(request: Request, env: Env, ctx?: Waiter): Promise<Response> {
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
  const { id: userId, isNew } = await upsertUser(env.DB, 'google', sub, email);
  const sid = await createSession(env.DB, userId);

  // Ops: tell the admins a NEW user just signed up (never delays the redirect).
  if (isNew) {
    ctx?.waitUntil(
      (async () => {
        const c = await env.DB!.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>();
        await notifyAdmins(env, '🎉 새 가입', `${email ?? '(이메일 없음)'} · 누적 ${c?.n ?? '?'}명`);
      })(),
    );
  }

  const headers = new Headers();
  headers.append('set-cookie', clearTx);
  headers.append('set-cookie', cookie(SID_COOKIE, sid, Math.floor(SESSION_TTL_MS / 1000)));
  headers.set('location', `${origin}/?login=ok`);
  return new Response(null, { status: 302, headers });
}

/** Pro entitlement shared by /api/me, the push endpoints and the push cron:
 *  admin allowlist OR live Polar subscription OR active coupon grant. */
async function isEntitled(env: Env, user: { id: string; email: string | null }): Promise<boolean> {
  if (isAdminEmail(env, user.email)) return true;
  if (!env.DB) return false;
  const sub = await env.DB.prepare('SELECT status, current_period_end FROM subscriptions WHERE user_id=?').bind(user.id).first<{ status: string; current_period_end: number | null }>();
  // Polar keeps status 'active' (with cancel_at_period_end) until it revokes at the
  // period end → status becomes 'canceled'. 'trialing'/'on_trial' also grant access.
  const ENTITLED = new Set(['active', 'trialing', 'on_trial']);
  if (sub && ENTITLED.has(sub.status) && (sub.current_period_end == null || sub.current_period_end > Date.now())) return true;
  try {
    const grant = await env.DB.prepare('SELECT 1 FROM grants WHERE user_id=? AND (expires_at IS NULL OR expires_at > ?) LIMIT 1').bind(user.id, Date.now()).first();
    return !!grant;
  } catch {
    // `grants` table not migrated yet → treat as no grant (never break auth).
    return false;
  }
}

async function handleMe(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ user: null });
  const sid = parseCookies(request.headers.get('cookie'))[SID_COOKIE];
  if (!sid) return json({ user: null });
  const user = await sessionUser(env.DB, sid);
  if (!user) return json({ user: null });
  // Entitlement = admin allowlist OR a live Polar subscription OR an active
  // coupon grant. Admins are always Pro (no subscription needed).
  const admin = isAdminEmail(env, user.email);
  const active = admin || (await isEntitled(env, user));
  // `billing` lets the client hide the upgrade CTA until Polar is actually wired up
  // (token set); `admin` reveals the coupon-issuing panel.
  return json({ user: { id: user.id, email: user.email, provider: user.provider }, plan: active ? 'pro' : 'free', billing: Boolean(env.POLAR_ACCESS_TOKEN), admin });
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

// ─── Billing (Polar · Merchant of Record) ──────────────────────────────────────
// Sandbox by default. Checkout + customer portal use an Organization Access Token
// (POLAR_ACCESS_TOKEN); webhooks are verified with the Standard Webhooks signature
// (POLAR_WEBHOOK_SECRET). Reconciliation to our users is via `external_customer_id`
// (= our user.id), echoed back as `customer.external_id` on webhook payloads.

const POLAR_PRODUCT_ID_DEFAULT = '7c6f2b4a-718c-47b0-9dd5-bc1aef50dab5';

function polarBase(env: Env): string {
  return env.POLAR_SERVER === 'production' ? 'https://api.polar.sh/v1' : 'https://sandbox-api.polar.sh/v1';
}

/** Standard (non-url) base64 of bytes — Standard Webhooks signatures use it. */
function b64FromBytes(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Length-checked constant-time string compare. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a Standard Webhooks signature exactly as Polar sends it. The HMAC key is
 * the raw secret's UTF-8 bytes: Polar hands you `polar_whs_…`, the standardwebhooks
 * lib base64-decodes its input, so the documented usage base64-ENCODES that raw
 * string first — net effect, the key bytes are the raw secret string's UTF-8 bytes.
 * Signed content is `${id}.${timestamp}.${body}`; the header is a space-separated
 * list of `v1,<base64sig>` entries (any match passes).
 */
async function verifyPolarWebhook(secret: string, headers: Headers, body: string): Promise<boolean> {
  const id = headers.get('webhook-id');
  const ts = headers.get('webhook-timestamp');
  const sig = headers.get('webhook-signature');
  if (!id || !ts || !sig) return false;
  // Replay guard: reject timestamps more than 5 minutes from now.
  const tsMs = Number(ts) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  const expected = b64FromBytes(new Uint8Array(mac));
  return sig.split(' ').some((part) => {
    const comma = part.indexOf(',');
    return safeEqual(comma >= 0 ? part.slice(comma + 1) : part, expected);
  });
}

/** POST /api/checkout — create a Polar checkout session, return its hosted URL. */
async function handleCheckout(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!env.POLAR_ACCESS_TOKEN) return json({ error: 'billing_unconfigured' }, 503);
  const origin = new URL(request.url).origin;
  const body: Record<string, unknown> = {
    products: [env.POLAR_PRODUCT_ID || POLAR_PRODUCT_ID_DEFAULT],
    success_url: `${origin}/?checkout=success`,
    external_customer_id: user.id,
    metadata: { user_id: user.id },
  };
  if (user.email) body.customer_email = user.email;
  const res = await fetch(`${polarBase(env)}/checkouts/`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return json({ error: 'checkout_failed', status: res.status }, 502);
  const data = (await res.json()) as { url?: string };
  if (!data.url) return json({ error: 'checkout_no_url' }, 502);
  return json({ url: data.url });
}

/** POST /api/billing/portal — mint a customer session, return its portal URL. */
async function handlePortal(request: Request, env: Env): Promise<Response> {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!env.POLAR_ACCESS_TOKEN) return json({ error: 'billing_unconfigured' }, 503);
  const res = await fetch(`${polarBase(env)}/customer-sessions/`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ external_customer_id: user.id }),
  });
  // 404 = this user has no Polar customer yet (never purchased) → nothing to manage.
  if (res.status === 404) return json({ error: 'no_customer' }, 404);
  if (!res.ok) return json({ error: 'portal_failed', status: res.status }, 502);
  const data = (await res.json()) as { customer_portal_url?: string };
  if (!data.customer_portal_url) return json({ error: 'portal_no_url' }, 502);
  return json({ url: data.customer_portal_url });
}

/** GET /api/billing/product — public price info for the Pro product (for the
 *  paywall UI), read live from Polar so the displayed price never drifts. */
async function handleProduct(request: Request, env: Env): Promise<Response> {
  if (!env.POLAR_ACCESS_TOKEN) return json({ error: 'billing_unconfigured' }, 503);
  const productId = env.POLAR_PRODUCT_ID || POLAR_PRODUCT_ID_DEFAULT;
  const res = await fetch(`${polarBase(env)}/products/${productId}`, {
    headers: { authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`, accept: 'application/json' },
  });
  if (!res.ok) return json({ error: 'product_failed', status: res.status }, 502);
  const p = (await res.json()) as {
    name?: string;
    recurring_interval?: string | null;
    prices?: Array<{ amount_type?: string; price_amount?: number; amount?: number; price_currency?: string; recurring_interval?: string | null }>;
  };
  // Amounts are in the currency's minor unit (cents). Skip free/non-fixed tiers.
  const prices = (p.prices ?? [])
    .filter((pr) => pr.amount_type !== 'free' && pr.amount_type !== 'custom')
    .map((pr) => ({
      amount: typeof pr.price_amount === 'number' ? pr.price_amount : typeof pr.amount === 'number' ? pr.amount : null,
      currency: (pr.price_currency ?? 'usd').toLowerCase(),
      interval: pr.recurring_interval ?? p.recurring_interval ?? null,
    }))
    .filter((pr) => pr.amount != null);
  return json({ name: p.name ?? null, prices });
}

interface PolarSubscription {
  id?: string;
  status?: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  customer?: { id?: string; external_id?: string | null };
  customer_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * No auto-renewal model: a free trial must EXPIRE (not convert to a charge) unless
 * the customer actively continues. Setting `cancel_at_period_end` on a trialing
 * subscription schedules it to end at the trial's end with no charge — Polar still
 * emails a heads-up ~3 days before, and the customer can continue (uncancel) or
 * re-subscribe from the portal. Best-effort: needs the `subscriptions:write` scope
 * on the token; on failure the subscription simply keeps Polar's default behaviour.
 */
async function scheduleTrialEnd(env: Env, sub: PolarSubscription): Promise<void> {
  if (!env.POLAR_ACCESS_TOKEN || !sub.id) return;
  try {
    const res = await fetch(`${polarBase(env)}/subscriptions/${sub.id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${env.POLAR_ACCESS_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ cancel_at_period_end: true }),
    });
    if (!res.ok) console.error('[polar] scheduleTrialEnd failed', res.status, sub.id);
  } catch (e) {
    console.error('[polar] scheduleTrialEnd error', e instanceof Error ? e.message : e);
  }
}

/** Write the latest subscription state for the mapped user (idempotent upsert). */
async function upsertSubscription(db: D1Database, sub: PolarSubscription): Promise<void> {
  const metaUser = typeof sub.metadata?.user_id === 'string' ? sub.metadata.user_id : null;
  const userId = sub.customer?.external_id || metaUser;
  if (!userId) return; // no way to map this to one of our users — ignore
  const status = sub.status ?? 'unknown';
  const periodEnd = sub.current_period_end ? Date.parse(sub.current_period_end) : null;
  await db
    .prepare(
      `INSERT INTO subscriptions (user_id, status, current_period_end, polar_subscription_id, polar_customer_id, updated_at)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET
         status=excluded.status,
         current_period_end=excluded.current_period_end,
         polar_subscription_id=excluded.polar_subscription_id,
         polar_customer_id=excluded.polar_customer_id,
         updated_at=excluded.updated_at`,
    )
    .bind(userId, status, Number.isFinite(periodEnd as number) ? periodEnd : null, sub.id ?? null, sub.customer?.id ?? sub.customer_id ?? null, Date.now())
    .run();
}

/** POST /api/webhooks/polar — verify signature, then reconcile subscription state. */
async function handleWebhook(request: Request, env: Env, ctx?: Waiter): Promise<Response> {
  if (!env.POLAR_WEBHOOK_SECRET || !env.DB) return json({ error: 'unconfigured' }, 503);
  const body = await request.text(); // raw body is required for signature verification
  if (!(await verifyPolarWebhook(env.POLAR_WEBHOOK_SECRET, request.headers, body))) {
    return json({ error: 'invalid_signature' }, 403);
  }
  let event: { type?: string; data?: PolarSubscription };
  try {
    event = JSON.parse(body) as typeof event;
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  // Every subscription.* event carries the full subscription object; upserting on
  // each keeps entitlement current (created/active/updated/canceled/revoked/…).
  if (event.type?.startsWith('subscription.') && event.data) {
    await upsertSubscription(env.DB, event.data);
    // Ops: revenue-state changes (skip the noisy `.updated`).
    const t = event.type;
    if (t === 'subscription.created' || t === 'subscription.active' || t === 'subscription.canceled' || t === 'subscription.revoked') {
      ctx?.waitUntil(notifyAdmins(env, '💰 구독 이벤트', `${t.replace('subscription.', '')} · ${event.data.status ?? ''}`));
    }
    // No auto-renewal: schedule trialing subs to end at trial's end (no charge)
    // unless already scheduled. Idempotent — once cancel_at_period_end is set, skip.
    if (event.data.status === 'trialing' && !event.data.cancel_at_period_end) {
      await scheduleTrialEnd(env, event.data);
    }
  }
  return json({ received: true });
}

// ─── Coupons (self-serve Pro codes) ──────────────────────────────────────────

const DAY_MS = 86_400_000;

/** Redeem a coupon code → grant the signed-in user Pro (permanent or N days). */
async function handleCouponRedeem(request: Request, env: Env, ctx?: Waiter): Promise<Response> {
  if (!env.DB) return json({ error: 'unconfigured' }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: { code?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const code = String(body.code ?? '').trim().toUpperCase();
  if (!code || code.length > 64) return json({ error: 'invalid_code' }, 400);

  const now = Date.now();
  const coupon = await env.DB.prepare('SELECT grant_days, expires_at FROM coupons WHERE code=?').bind(code).first<{ grant_days: number | null; expires_at: number | null }>();
  if (!coupon) return json({ error: 'invalid_code' }, 404);
  if (coupon.expires_at != null && coupon.expires_at <= now) return json({ error: 'code_expired' }, 400);

  const dup = await env.DB.prepare('SELECT 1 FROM grants WHERE user_id=? AND code=?').bind(user.id, code).first();
  if (dup) return json({ error: 'already_redeemed' }, 409);

  // Atomically claim a use — guards max_uses / expiry against concurrent redeems.
  const claim = await env.DB.prepare(
    'UPDATE coupons SET used_count=used_count+1 WHERE code=? AND (max_uses IS NULL OR used_count < max_uses) AND (expires_at IS NULL OR expires_at > ?)',
  ).bind(code, now).run();
  if (!claim.meta || claim.meta.changes === 0) return json({ error: 'code_exhausted' }, 409);

  const expiresAt = coupon.grant_days == null || coupon.grant_days <= 0 ? null : now + coupon.grant_days * DAY_MS;
  await env.DB.prepare('INSERT INTO grants (user_id, code, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(user.id, code, expiresAt, now).run();
  ctx?.waitUntil(notifyAdmins(env, '🎟️ 쿠폰 사용', `${code} · ${user.email ?? user.id}`));
  return json({ ok: true, plan: 'pro', expiresAt });
}

/** Unambiguous code alphabet (no 0/O/1/I). */
function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s;
}

/** Admin-only coupon management: GET lists codes, POST creates one. */
async function handleAdminCoupons(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: 'unconfigured' }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!isAdminEmail(env, user.email)) return json({ error: 'forbidden' }, 403);

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT code, grant_days, max_uses, used_count, note, created_at, expires_at FROM coupons ORDER BY created_at DESC LIMIT 200').all();
    return json({ coupons: results ?? [] });
  }

  let body: { code?: unknown; grantDays?: unknown; maxUses?: unknown; note?: unknown; codeExpiresAt?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  let code = String(body.code ?? '').trim().toUpperCase();
  if (!code) code = randomCode();
  if (!/^[A-Z0-9-]{3,64}$/.test(code)) return json({ error: 'invalid_code' }, 400);
  // grant_days: null/0/absent → permanent; positive int → that many days.
  const gd = Math.floor(Number(body.grantDays));
  const grantDays = Number.isFinite(gd) && gd > 0 ? gd : null;
  const mu = Math.floor(Number(body.maxUses));
  const maxUses = Number.isFinite(mu) && mu > 0 ? mu : null;
  const note = body.note == null ? null : String(body.note).slice(0, 200);
  const ce = Number(body.codeExpiresAt);
  const codeExpiresAt = Number.isFinite(ce) && ce > 0 ? ce : null;

  try {
    await env.DB.prepare('INSERT INTO coupons (code, grant_days, max_uses, used_count, note, created_at, expires_at) VALUES (?, ?, ?, 0, ?, ?, ?)')
      .bind(code, grantDays, maxUses, note, Date.now(), codeExpiresAt).run();
  } catch {
    return json({ error: 'code_exists' }, 409);
  }
  return json({ ok: true, code, grantDays, maxUses, note });
}

// ─── Admin ops notifications ─────────────────────────────────────────────────
// Reuses the Web Push infra: events (signup / subscription / coupon) and the
// daily digest go to every push-subscribed device of ADMIN_EMAILS accounts.
// Only METADATA is ever reported — sync blobs stay opaque (E2EE-compatible).

/** ExecutionContext-shaped: lets handlers fire best-effort work post-response. */
type Waiter = { waitUntil(p: Promise<unknown>): void };

async function notifyAdmins(env: Env, title: string, body: string): Promise<void> {
  try {
    if (!env.DB || !env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return;
    const emails = (env.ADMIN_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
    if (!emails.length) return;
    const q = emails.map(() => '?').join(',');
    const admins = await env.DB.prepare(`SELECT id FROM users WHERE lower(email) IN (${q})`).bind(...emails).all<{ id: string }>();
    const vapid = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || 'mailto:singlena@gmail.com' };
    for (const a of admins.results ?? []) {
      const subs = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id=?').bind(a.id).all<{ endpoint: string; p256dh: string; auth: string }>();
      for (const s of subs.results ?? []) {
        try {
          const st = await sendWebPush(s, JSON.stringify({ title, body, tag: 'ops' }), vapid);
          if (st === 404 || st === 410) await env.DB.prepare('DELETE FROM push_subs WHERE endpoint=?').bind(s.endpoint).run();
        } catch {
          // per-device best effort
        }
      }
    }
  } catch {
    // ops notifications must never break user-facing flows
  }
}

/** Admin-only delivery check: sends a test ops push to the admin's devices. */
async function handleNotifyTest(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: 'unconfigured' }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!isAdminEmail(env, user.email)) return json({ error: 'forbidden' }, 403);
  await notifyAdmins(env, '🔔 운영 알림 테스트', '이 알림이 보이면 정상 작동 중입니다.');
  return json({ ok: true });
}

/** Pro self-test: send a real closed-app push to the CALLER's own devices so
 *  they can verify delivery (background the app, then tap). Returns how many
 *  subscriptions this account has and how many pushes the service accepted. */
async function handlePushTest(request: Request, env: Env): Promise<Response> {
  if (!env.DB || !env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return json({ error: 'unconfigured' }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await isEntitled(env, user))) return json({ error: 'forbidden' }, 403);
  const vapid = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || 'mailto:singlena@gmail.com' };
  const subs = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id=?').bind(user.id).all<{ endpoint: string; p256dh: string; auth: string }>();
  const rows = subs.results ?? [];
  const payload = JSON.stringify({ title: '🔔 24Houring', body: '닫힌 앱 알림 테스트 — 이 알림이 보이면 정상입니다', tag: 'slice-start' });
  let sent = 0;
  for (const s of rows) {
    try {
      const st = await sendWebPush(s, payload, vapid);
      if (st === 404 || st === 410) await env.DB.prepare('DELETE FROM push_subs WHERE endpoint=?').bind(s.endpoint).run();
      else if (st >= 200 && st < 300) sent++;
    } catch {
      // per-device best effort
    }
  }
  return json({ ok: true, subs: rows.length, sent });
}

/**
 * Admin-only ANONYMOUS aggregate stats — COUNTS ONLY. Timetable/diary CONTENT
 * is never stored server-side (the sync blob is opaque / E2EE), so nothing here
 * can reveal what anyone planned or wrote — only how many signed up, logged in,
 * or synced. Gated to the ADMIN_EMAILS allowlist.
 */
async function handleAdminStats(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: 'unconfigured' }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!isAdminEmail(env, user.email)) return json({ error: 'forbidden' }, 403);

  const num = async (sql: string, ...b: unknown[]): Promise<number> => {
    const r = await env.DB!.prepare(sql).bind(...b).first<{ n: number }>();
    return r?.n ?? 0;
  };

  const now = Date.now();
  const DAY = 86_400_000;
  const since30 = now - 30 * DAY;
  const since7 = now - 7 * DAY;

  const [users, syncUsers, pushDevices, pushUsers, grantsN, proSubs, active7d] = await Promise.all([
    num('SELECT COUNT(*) AS n FROM users'),
    num('SELECT COUNT(*) AS n FROM sync_data'),
    num('SELECT COUNT(*) AS n FROM push_subs'),
    num('SELECT COUNT(DISTINCT user_id) AS n FROM push_subs'),
    num('SELECT COUNT(*) AS n FROM grants'),
    num("SELECT COUNT(*) AS n FROM subscriptions WHERE status IN ('active','on_trial')"),
    num('SELECT COUNT(DISTINCT user_id) AS n FROM sessions WHERE created_at >= ?', since7),
  ]);

  // Daily signups + logins over the last 30 days, bucketed by KST calendar day.
  const dayExpr = (col: string) => `strftime('%Y-%m-%d', ${col}/1000, 'unixepoch', '+9 hours')`;
  const rows = async (table: string, col: string) =>
    (await env.DB!.prepare(`SELECT ${dayExpr(col)} AS d, COUNT(*) AS n FROM ${table} WHERE ${col} >= ? GROUP BY d`)
      .bind(since30).all<{ d: string; n: number }>()).results ?? [];
  const [signupRows, loginRows] = await Promise.all([rows('users', 'created_at'), rows('sessions', 'created_at')]);
  const sMap = new Map(signupRows.map((r) => [r.d, r.n]));
  const lMap = new Map(loginRows.map((r) => [r.d, r.n]));
  const kstDay = (ms: number) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10);
  const daily: { day: string; signups: number; logins: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = kstDay(now - i * DAY);
    daily.push({ day: d, signups: sMap.get(d) ?? 0, logins: lMap.get(d) ?? 0 });
  }

  return json({ totals: { users, syncUsers, pushDevices, pushUsers, grants: grantsN, proSubs }, active7d, daily, generatedAt: now });
}

// ─── Web Push (Pro closed-tab slice alarms) ──────────────────────────────────
// The client uploads TODAY-agnostic notification strings per boundary
// ({t:'HH:MM', title, body}) plus its UTC offset; the minute cron matches each
// user's local HH:MM and sends an encrypted push to every registered device.
// Crypto lives in src/lib/webpush.ts (RFC 8291/8292, vector-tested).

const MAX_BOUNDARIES = 64;

async function pushUser(request: Request, env: Env): Promise<{ id: string; email: string | null } | Response> {
  if (!env.DB) return json({ error: 'unconfigured' }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!(await isEntitled(env, user))) return json({ error: 'pro_required' }, 403);
  return user;
}

async function handlePushSubscribe(request: Request, env: Env): Promise<Response> {
  const user = await pushUser(request, env);
  if (user instanceof Response) return user;
  let body: { endpoint?: unknown; p256dh?: unknown; auth?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const endpoint = String(body.endpoint ?? '');
  const p256dh = String(body.p256dh ?? '');
  const auth = String(body.auth ?? '');
  if (!endpoint.startsWith('https://') || endpoint.length > 1024 || !p256dh || p256dh.length > 256 || !auth || auth.length > 64) {
    return json({ error: 'bad_subscription' }, 400);
  }
  await env.DB!.prepare(
    'INSERT INTO push_subs (endpoint, user_id, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, p256dh=excluded.p256dh, auth=excluded.auth',
  ).bind(endpoint, user.id, p256dh, auth, Date.now()).run();
  return json({ ok: true });
}

async function handlePushUnsubscribe(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: 'unconfigured' }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  let body: { endpoint?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  await env.DB.prepare('DELETE FROM push_subs WHERE endpoint=? AND user_id=?').bind(String(body.endpoint ?? ''), user.id).run();
  return json({ ok: true });
}

async function handlePushPlanPut(request: Request, env: Env): Promise<Response> {
  const user = await pushUser(request, env);
  if (user instanceof Response) return user;
  let body: { boundaries?: unknown; tzOffset?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const tz = Math.trunc(Number(body.tzOffset));
  if (!Number.isFinite(tz) || tz < -900 || tz > 900) return json({ error: 'bad_tz' }, 400);
  if (!Array.isArray(body.boundaries) || body.boundaries.length > MAX_BOUNDARIES) return json({ error: 'bad_boundaries' }, 400);
  const boundaries = (body.boundaries as Array<Record<string, unknown>>).flatMap((b) => {
    const t = String(b?.t ?? '');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return [];
    return [{ t, title: String(b?.title ?? '').slice(0, 120), body: String(b?.body ?? '').slice(0, 80) }];
  });
  await env.DB!.prepare(
    'INSERT INTO push_plans (user_id, boundaries, tz_offset, last_fired, updated_at) VALUES (?, ?, ?, NULL, ?) ON CONFLICT(user_id) DO UPDATE SET boundaries=excluded.boundaries, tz_offset=excluded.tz_offset, updated_at=excluded.updated_at',
  ).bind(user.id, JSON.stringify(boundaries), tz, Date.now()).run();
  return json({ ok: true, count: boundaries.length });
}

async function handlePushPlanDelete(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: 'unconfigured' }, 503);
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'unauthorized' }, 401);
  await env.DB.prepare('DELETE FROM push_plans WHERE user_id=?').bind(user.id).run();
  return json({ ok: true });
}

interface PushPlanRow { user_id: string; boundaries: string; tz_offset: number; last_fired: string | null }

/** Run `worker` over `items` with at most `limit` in flight at once. */
async function inPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

/** Minute cron: fire due boundaries (current minute, or the previous one when
 *  the trigger jittered past it) for entitled users, at most once each. */
async function runPushCron(env: Env): Promise<void> {
  if (!env.DB || !env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return;
  const nowMs = Date.now();
  // Heartbeat: every run stamps ops_state so a silent cron outage (like the
  // weeks it was rejected by the account cron-limit) is detectable via /api/health.
  try {
    await env.DB.prepare("INSERT INTO ops_state (key, value) VALUES ('last_cron_run', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(String(nowMs)).run();
  } catch {
    // heartbeat is best-effort — never let it block sending alarms
  }
  const { results } = await env.DB.prepare('SELECT user_id, boundaries, tz_offset, last_fired FROM push_plans').all<PushPlanRow>();
  const vapid = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || 'mailto:singlena@gmail.com' };
  // Collect every due (device, payload) first, then fan them out with bounded
  // concurrency — so a busy minute (many users due at, say, 09:00) doesn't
  // serialise into a long chain. last_fired is still marked per-plan BEFORE any
  // send below, so at-most-once holds regardless of send order/failure.
  const sends: Array<{ sub: { endpoint: string; p256dh: string; auth: string }; payload: string }> = [];
  for (const plan of results ?? []) {
    try {
      let boundaries: Array<{ t: string; title?: string; body?: string }> = [];
      try {
        boundaries = JSON.parse(plan.boundaries) as typeof boundaries;
      } catch {
        continue;
      }
      // Candidate minutes in the USER's local clock, newest first.
      let due: { key: string; b: { t: string; title?: string; body?: string } } | null = null;
      for (const delta of [0, 60_000]) {
        const local = new Date(nowMs - delta + plan.tz_offset * 60_000);
        const t = `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
        const b = boundaries.find((x) => x && x.t === t);
        if (b) {
          due = { key: `${local.toISOString().slice(0, 10)}|${t}`, b };
          break;
        }
      }
      if (!due || plan.last_fired === due.key) continue;
      // Mark BEFORE sending — at-most-once beats duplicate alarms on retry.
      await env.DB.prepare('UPDATE push_plans SET last_fired=? WHERE user_id=?').bind(due.key, plan.user_id).run();
      const userRow = await env.DB.prepare('SELECT id, email FROM users WHERE id=?').bind(plan.user_id).first<{ id: string; email: string | null }>();
      if (!userRow || !(await isEntitled(env, userRow))) continue;
      const subs = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id=?').bind(plan.user_id).all<{ endpoint: string; p256dh: string; auth: string }>();
      const payload = JSON.stringify({ title: due.b.title || '24Houring', body: due.b.body || '' });
      for (const s of subs.results ?? []) sends.push({ sub: s, payload });
    } catch {
      // per-plan best effort — one bad row must not stall the cron
    }
  }

  // Fan out the collected sends with bounded concurrency; prune dead subs after.
  if (sends.length) {
    const dead: string[] = [];
    await inPool(sends, 15, async ({ sub, payload }) => {
      try {
        const status = await sendWebPush(sub, payload, vapid);
        if (status === 404 || status === 410) dead.push(sub.endpoint);
      } catch {
        // per-device best effort
      }
    });
    if (dead.length) {
      try {
        await env.DB.prepare(`DELETE FROM push_subs WHERE endpoint IN (${dead.map(() => '?').join(',')})`).bind(...dead).run();
      } catch {
        // pruning is best-effort
      }
    }
  }

  // ── Daily ops digest for admins — 21:00 KST, once per local day ────────────
  try {
    const kst = new Date(nowMs + 540 * 60_000);
    const hm = `${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`;
    if (hm === '21:00' || hm === '21:01') {
      const day = kst.toISOString().slice(0, 10);
      const prev = await env.DB.prepare("SELECT value FROM ops_state WHERE key='last_digest'").first<{ value: string }>();
      if (prev?.value !== day) {
        // Mark BEFORE sending (at-most-once, same rule as the alarm cron).
        await env.DB.prepare("INSERT INTO ops_state (key, value) VALUES ('last_digest', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(day).run();
        const midnight = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 540 * 60_000;
        const count = async (sql: string) => (await env.DB!.prepare(sql).bind(midnight).first<{ n: number }>())?.n ?? 0;
        const signups = await count('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?');
        const logins = await count('SELECT COUNT(*) AS n FROM sessions WHERE created_at >= ?');
        const syncs = await count('SELECT COUNT(*) AS n FROM sync_data WHERE updated_at >= ?');
        await notifyAdmins(env, '📊 오늘의 24Houring', `가입 ${signups} · 로그인 ${logins} · 동기화 ${syncs}`);
      }
    }
  } catch {
    // digest is best effort
  }
}

// ─── News (keyword headlines, no AI tokens) ──────────────────────────────────
/** Country code → GDELT `sourcecountry` FIPS 10-4 code. We use GDELT's free Doc
 *  API (built for programmatic access, so it works from datacenter/edge egress —
 *  unlike Google News RSS, which 503s Cloudflare IPs). The frontend sends a
 *  country code + keyword; we only ever build the fixed GDELT URL from a
 *  whitelisted country code + the encoded keyword (no SSRF surface). */
const NEWS_COUNTRY_FIPS: Record<string, string> = {
  KR: 'KS', US: 'US', GB: 'UK', JP: 'JA', CN: 'CH', TW: 'TW', FR: 'FR', DE: 'GM',
  ES: 'SP', IT: 'IT', IN: 'IN', BR: 'BR', RU: 'RS', CA: 'CA', AU: 'AS',
};

interface NewsItem { title: string; link: string; source: string; pubDate: string }

interface GdeltArticle { title?: string; url?: string; domain?: string; seendate?: string }

/** Map GDELT's ArtList JSON → up to 10 unique headline items (newest first). */
function parseGdelt(body: string): NewsItem[] {
  let data: { articles?: GdeltArticle[] };
  try { data = JSON.parse(body); } catch { return []; } // rate-limit / error → plain text
  const arts = Array.isArray(data.articles) ? data.articles : [];
  const items: NewsItem[] = [];
  const seen = new Set<string>();
  for (const a of arts) {
    const title = (a.title || '').trim();
    const link = a.url || '';
    if (!title || !link || seen.has(title)) continue;
    seen.add(title);
    items.push({ title, link, source: a.domain || '', pubDate: a.seendate || '' });
    if (items.length >= 10) break;
  }
  return items;
}

/** GET /api/news?q=<keyword>&country=<code> → up to 10 headline titles+links
 *  from GDELT. No API key, no AI tokens. Edge-cached ~2h so the same keyword
 *  doesn't refetch on every open while staying fresh through the day. */
async function handleNews(request: Request, env: Env, ctx?: Waiter): Promise<Response> {
  void env;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
  const country = (url.searchParams.get('country') || 'KR').toUpperCase();
  const fips = NEWS_COUNTRY_FIPS[country] ?? NEWS_COUNTRY_FIPS.KR;
  if (!q) return json({ error: 'missing_query' }, 400);

  // Edge cache keyed by normalized country+query.
  const cacheKey = new Request(`https://news.cache/${country}/${encodeURIComponent(q.toLowerCase())}`);
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  // GDELT Doc API: keyword AND a country filter, newest first, JSON.
  const query = `${q} sourcecountry:${fips}`;
  const feed = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=10&sort=DateDesc&format=json`;
  // GDELT rate-limits to ~1 request / 5s (returns a plain-text notice) — retry a
  // few times with a short backoff before giving up.
  let items: NewsItem[] = [];
  let upstreamStatus = 0;
  let raw = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 400 * attempt));
    try {
      const res = await fetch(feed, { headers: { 'user-agent': '24Houring/1.0 (news widget)', 'accept': 'application/json' } });
      upstreamStatus = res.status;
      if (res.ok) { raw = await res.text(); items = parseGdelt(raw); if (items.length) break; }
    } catch { /* retry */ }
  }

  // Temporary diagnostics (?debug=1): inspect what the edge fetch received.
  if (url.searchParams.get('debug') === '1') {
    return json({ q, country, fips, feed, upstreamStatus, itemCount: items.length, snippet: raw.slice(0, 500) }, 200, { 'cache-control': 'no-store' });
  }

  // Only cache a good (non-empty) result — never poison the cache with an empty
  // list from a throttled fetch, so the next open can retry.
  if (items.length) {
    const out = json({ q, country, items, fetchedAt: Date.now() }, 200, { 'cache-control': 'public, max-age=7200' });
    const store = out.clone();
    if (ctx?.waitUntil) ctx.waitUntil(cache.put(cacheKey, store)); else await cache.put(cacheKey, store);
    return out;
  }
  return json({ q, country, items: [], fetchedAt: Date.now() }, 200, { 'cache-control': 'no-store' });
}

// ─── Router ──────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx?: Waiter): Promise<Response> {
    const url = new URL(request.url);
    const p = url.pathname;
    const m = request.method;

    if (p.startsWith('/api/')) {
      if (p === '/api/health' && m === 'GET') {
        // Cron liveness: age of the last scheduled run (null if never / DB down).
        // cronAgeSec > ~120 means the minute cron has stopped firing.
        let cronLastRun: number | null = null;
        try {
          const r = await env.DB?.prepare("SELECT value FROM ops_state WHERE key='last_cron_run'").first<{ value: string }>();
          cronLastRun = r ? Number(r.value) : null;
        } catch {
          // best-effort — health must never fail on a DB hiccup
        }
        return json({ ok: true, service: '24houring-api', db: Boolean(env.DB), auth: Boolean(env.GOOGLE_CLIENT_ID), billing: Boolean(env.POLAR_ACCESS_TOKEN), push: Boolean(env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY), cronLastRun, cronAgeSec: cronLastRun ? Math.round((Date.now() - cronLastRun) / 1000) : null, ts: Date.now() });
      }
      if (p === '/api/auth/google/start' && m === 'GET') return handleStart(request, env);
      if (p === '/api/auth/google/callback' && m === 'GET') return handleCallback(request, env, ctx);
      if (p === '/api/me' && m === 'GET') return handleMe(request, env);
      if (p === '/api/logout' && m === 'POST') return handleLogout(request, env);
      if (p === '/api/sync' && m === 'GET') return handleSyncGet(request, env);
      if (p === '/api/sync' && m === 'PUT') return handleSyncPut(request, env);
      if (p === '/api/billing/product' && m === 'GET') return handleProduct(request, env);
      if (p === '/api/checkout' && m === 'POST') return handleCheckout(request, env);
      if (p === '/api/billing/portal' && m === 'POST') return handlePortal(request, env);
      if (p === '/api/webhooks/polar' && m === 'POST') return handleWebhook(request, env, ctx);
      if (p === '/api/coupon/redeem' && m === 'POST') return handleCouponRedeem(request, env, ctx);
      if (p === '/api/admin/notify-test' && m === 'POST') return handleNotifyTest(request, env);
      if (p === '/api/admin/stats' && m === 'GET') return handleAdminStats(request, env);
      if (p === '/api/admin/coupons' && (m === 'GET' || m === 'POST')) return handleAdminCoupons(request, env);
      if (p === '/api/push/subscribe' && m === 'POST') return handlePushSubscribe(request, env);
      if (p === '/api/push/subscribe' && m === 'DELETE') return handlePushUnsubscribe(request, env);
      if (p === '/api/push/plan' && m === 'PUT') return handlePushPlanPut(request, env);
      if (p === '/api/push/plan' && m === 'DELETE') return handlePushPlanDelete(request, env);
      if (p === '/api/push/test' && m === 'POST') return handlePushTest(request, env);
      if (p === '/api/news' && m === 'GET') return handleNews(request, env, ctx);
      return json({ error: 'not_found' }, 404);
    }

    // Non-API request → serve the SPA (unchanged behaviour).
    return env.ASSETS.fetch(request);
  },

  /** Minute cron (wrangler.jsonc triggers.crons) → due push alarms. */
  async scheduled(_controller: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
    ctx.waitUntil(runPushCron(env));
  },
};
