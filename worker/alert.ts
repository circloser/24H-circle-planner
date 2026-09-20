/**
 * Operator alerts that survive a dead database.
 *
 * The admin push notifications (notifyAdmins) read the devices out of D1, so
 * they say nothing in exactly the outage that matters most — the one where D1
 * is the thing that is down (see the 2026-09-19 incident, where sync and
 * sign-in were broken for hours before anyone noticed).
 *
 * Two ways out, both optional and both best-effort:
 *
 *  1. ALERT_WEBHOOK — a Slack, Discord or any other URL that takes JSON.
 *  2. The admin's own phone. The devices are kept in a copy that does NOT live
 *     in D1: the isolate's memory, backed by the Workers Cache API, refreshed
 *     from D1 whenever it is healthy. A cached copy can be evicted, so this is
 *     a good chance of a notification, not a promise of one. For a promise,
 *     point an outside monitor at /api/health, which answers 503 when the
 *     database will not talk (see worker/index.ts).
 *
 * Alerts repeat at most every ALERT_EVERY_MS per kind, so a database that is
 * down all afternoon is one message, not three hundred. The "back again" line
 * is sent as soon as the same kind recovers.
 */

import { sendWebPush } from '../src/lib/webpush';

/** How often the same kind of trouble may speak up. */
export const ALERT_EVERY_MS = 30 * 60_000;

export interface AlertState {
  /** kind → when it was last reported. */
  sent: Map<string, number>;
  /** Kinds currently in trouble (for the recovery line). */
  bad: Set<string>;
}

export const newAlertState = (): AlertState => ({ sent: new Map(), bad: new Set() });

/** Should this trouble be reported now? Marks it as reported when it should. */
export function shouldAlert(state: AlertState, kind: string, now: number, everyMs = ALERT_EVERY_MS): boolean {
  const last = state.sent.get(kind);
  state.bad.add(kind);
  // Never reported before → say it now, whatever the clock reads.
  if (last !== undefined && now - last < everyMs) return false;
  state.sent.set(kind, now);
  return true;
}

/** Should a "back again" line be sent — i.e. was this kind in trouble? */
export function shouldClear(state: AlertState, kind: string): boolean {
  if (!state.bad.has(kind)) return false;
  state.bad.delete(kind);
  state.sent.delete(kind);
  return true;
}

/** The shape every common webhook understands: Slack reads `text`, Discord
 *  `content`; anything else gets both. */
export const alertBody = (text: string): string => JSON.stringify({ text, content: text });

export async function postAlert(webhook: string | undefined, text: string): Promise<boolean> {
  if (!webhook) return false;
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: alertBody(text),
    });
    return res.ok;
  } catch {
    return false; // an alert that cannot be sent must never break the caller
  }
}

// ─── The admin's devices, kept out of D1 ─────────────────────────────────────

export interface OpsDevice { endpoint: string; p256dh: string; auth: string }

/** Only push subscriptions with all three parts are worth keeping. */
export const cleanDevices = (rows: readonly Partial<OpsDevice>[]): OpsDevice[] => {
  const seen = new Set<string>();
  const out: OpsDevice[] = [];
  for (const r of rows) {
    if (!r || !r.endpoint || !r.p256dh || !r.auth || seen.has(r.endpoint)) continue;
    seen.add(r.endpoint);
    out.push({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth });
  }
  return out;
};

/** A key the Cache API accepts: an absolute URL that is never requested. */
const DEVICE_CACHE_URL = 'https://ops.24houring.invalid/admin-devices';
/** How long the cached copy stays usable. A push subscription lasts months. */
export const DEVICE_CACHE_S = 30 * 86_400;

let devices: OpsDevice[] = [];

/** The Workers cache, or null outside a Worker (tests, the build). */
function opsCache(): Cache | null {
  try {
    const store = (globalThis as { caches?: { default?: Cache } }).caches;
    return store?.default ?? null;
  } catch {
    return null;
  }
}

/**
 * Keep the admin's devices where a dead D1 cannot hide them. Called after any
 * healthy read of push_subs, so the copy refreshes itself in normal use.
 */
export async function keepDevices(rows: readonly Partial<OpsDevice>[]): Promise<void> {
  const list = cleanDevices(rows);
  if (!list.length) return;
  devices = list;
  try {
    await opsCache()?.put(DEVICE_CACHE_URL, new Response(JSON.stringify(list), {
      headers: { 'content-type': 'application/json', 'cache-control': `max-age=${DEVICE_CACHE_S}` },
    }));
  } catch {
    // memory alone still works while this isolate lives
  }
}

/** The devices to alert: this isolate's copy, else the colo's cached one. */
export async function opsDevices(): Promise<OpsDevice[]> {
  if (devices.length) return devices;
  try {
    const hit = await opsCache()?.match(DEVICE_CACHE_URL);
    if (!hit) return [];
    const list = cleanDevices((await hit.json()) as Partial<OpsDevice>[]);
    devices = list;
    return list;
  } catch {
    return [];
  }
}

/** Forget the copy (tests, and a device the push service has rejected). */
export function forgetDevices(): void {
  devices = [];
}

export interface PushEnv {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

/** Push a line to the admin's devices WITHOUT touching the database. */
export async function pushOps(env: PushEnv, title: string, body: string): Promise<boolean> {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return false;
  const list = await opsDevices();
  if (!list.length) return false;
  const vapid = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || 'mailto:singlena@gmail.com' };
  const payload = JSON.stringify({ title, body, tag: 'ops' });
  let sent = false;
  for (const d of list) {
    try {
      const st = await sendWebPush(d, payload, vapid);
      if (st >= 200 && st < 300) sent = true;
      // A gone subscription would be dropped from D1 by notifyAdmins; here the
      // database is the thing that is down, so only the copy is trimmed.
      else if (st === 404 || st === 410) devices = devices.filter((x) => x.endpoint !== d.endpoint);
    } catch {
      // per-device best effort
    }
  }
  return sent;
}

/** Module-global state: one isolate reports at most once per window. A new
 *  isolate may repeat a line — better twice than never. */
const state = newAlertState();

export type AlertEnv = PushEnv & { ALERT_WEBHOOK?: string };

/** Report trouble (throttled per kind), by webhook and to the admin's phone. */
export async function alertOps(env: AlertEnv, kind: string, text: string, now = Date.now()): Promise<boolean> {
  console.error(`[ops] ${kind}: ${text}`);
  if (!shouldAlert(state, kind, now)) return false;
  const [hook, push] = await Promise.all([
    postAlert(env.ALERT_WEBHOOK, `🚨 24Houring — ${text}`),
    pushOps(env, '🚨 24Houring', text),
  ]);
  return hook || push;
}

/** Report that a kind of trouble is over (only if it was reported). */
export async function clearOps(env: AlertEnv, kind: string, text: string): Promise<boolean> {
  if (!shouldClear(state, kind)) return false;
  console.log(`[ops] ${kind}: recovered`);
  const [hook, push] = await Promise.all([
    postAlert(env.ALERT_WEBHOOK, `✅ 24Houring — ${text}`),
    pushOps(env, '✅ 24Houring', text),
  ]);
  return hook || push;
}
