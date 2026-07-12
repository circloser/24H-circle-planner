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
  /** Polar billing (Merchant of Record). Token + webhook secret are Worker secrets;
   *  server + product id are non-secret vars (wrangler.jsonc). */
  POLAR_ACCESS_TOKEN?: string; // Organization Access Token (polar_oat_…)
  POLAR_WEBHOOK_SECRET?: string; // Standard Webhooks secret (polar_whs_…)
  POLAR_PRODUCT_ID?: string; // Pro product id
  POLAR_SERVER?: string; // 'sandbox' (default) | 'production'
  /** Comma-separated emails always entitled to Pro (no subscription). Non-secret var. */
  ADMIN_EMAILS?: string;
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
  // Entitlement = admin allowlist OR a live Polar subscription OR an active
  // coupon grant. Admins are always Pro (no subscription needed).
  const admin = isAdminEmail(env, user.email);
  let active = admin;
  if (!active) {
    const sub = await env.DB.prepare('SELECT status, current_period_end FROM subscriptions WHERE user_id=?').bind(user.id).first<{ status: string; current_period_end: number | null }>();
    // Polar keeps status 'active' (with cancel_at_period_end) until it revokes at the
    // period end → status becomes 'canceled'. 'trialing'/'on_trial' also grant access.
    const ENTITLED = new Set(['active', 'trialing', 'on_trial']);
    active = !!sub && ENTITLED.has(sub.status) && (sub.current_period_end == null || sub.current_period_end > Date.now());
  }
  if (!active) {
    try {
      const grant = await env.DB.prepare('SELECT 1 FROM grants WHERE user_id=? AND (expires_at IS NULL OR expires_at > ?) LIMIT 1').bind(user.id, Date.now()).first();
      active = !!grant;
    } catch {
      // `grants` table not migrated yet → treat as no grant (never break /api/me).
    }
  }
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
async function handleWebhook(request: Request, env: Env): Promise<Response> {
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
async function handleCouponRedeem(request: Request, env: Env): Promise<Response> {
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

// ─── Router ──────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const p = url.pathname;
    const m = request.method;

    if (p.startsWith('/api/')) {
      if (p === '/api/health' && m === 'GET') {
        return json({ ok: true, service: '24houring-api', db: Boolean(env.DB), auth: Boolean(env.GOOGLE_CLIENT_ID), billing: Boolean(env.POLAR_ACCESS_TOKEN), ts: Date.now() });
      }
      if (p === '/api/auth/google/start' && m === 'GET') return handleStart(request, env);
      if (p === '/api/auth/google/callback' && m === 'GET') return handleCallback(request, env);
      if (p === '/api/me' && m === 'GET') return handleMe(request, env);
      if (p === '/api/logout' && m === 'POST') return handleLogout(request, env);
      if (p === '/api/sync' && m === 'GET') return handleSyncGet(request, env);
      if (p === '/api/sync' && m === 'PUT') return handleSyncPut(request, env);
      if (p === '/api/billing/product' && m === 'GET') return handleProduct(request, env);
      if (p === '/api/checkout' && m === 'POST') return handleCheckout(request, env);
      if (p === '/api/billing/portal' && m === 'POST') return handlePortal(request, env);
      if (p === '/api/webhooks/polar' && m === 'POST') return handleWebhook(request, env);
      if (p === '/api/coupon/redeem' && m === 'POST') return handleCouponRedeem(request, env);
      if (p === '/api/admin/coupons' && (m === 'GET' || m === 'POST')) return handleAdminCoupons(request, env);
      return json({ error: 'not_found' }, 404);
    }

    // Non-API request → serve the SPA (unchanged behaviour).
    return env.ASSETS.fetch(request);
  },
};
