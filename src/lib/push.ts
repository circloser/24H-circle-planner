import type { TimeSlice } from '@/types/time-slice';
import { bytesToB64url } from '@/lib/webpush';

/**
 * Client side of the Pro closed-tab alarms: manage this device's push
 * subscription and upload the user's notification plan (one entry per slice
 * boundary — pre-rendered title/body strings, so the server never needs to
 * read schedules and E2EE sync stays opaque).
 */

/** VAPID application server key (public — the private half is a Worker secret). */
export const VAPID_PUBLIC_KEY = 'BFUzJmVp8uJlFAKIZEEAFr3O1u-FLD7cbvHVXOuHtPNQ5zdZl0j_vgnDvwDNRWo8kmr0uWRv8E5EcHzmdwBy1ls';

function keyBytes(): Uint8Array {
  const s = VAPID_PUBLIC_KEY.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function pushSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window;
}

/** Subscribe this device (idempotent) and register it with the Worker. */
export async function enablePush(): Promise<boolean> {
  try {
    if (!pushSupported()) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes() as BufferSource }));
    const p256dh = sub.getKey('p256dh');
    const auth = sub.getKey('auth');
    if (!p256dh || !auth) return false;
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint, p256dh: bytesToB64url(p256dh), auth: bytesToB64url(auth) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Drop this device's subscription and (user-level) the notification plan. */
export async function disablePush(): Promise<void> {
  try {
    if (!pushSupported()) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    await fetch('/api/push/plan', { method: 'DELETE', credentials: 'include' }).catch(() => {});
  } catch {
    /* best effort */
  }
}

/** Pro self-test: ask the server to push to THIS account's subscribed devices
 *  right now, so closed-app delivery can be verified (background the app, tap).
 *  `subs` = how many devices are subscribed, `sent` = how many the push service
 *  accepted. */
export async function sendTestPush(): Promise<{ ok: boolean; subs: number; sent: number }> {
  try {
    const res = await fetch('/api/push/test', { method: 'POST', credentials: 'include' });
    if (!res.ok) return { ok: false, subs: 0, sent: 0 };
    const data = (await res.json()) as { ok?: boolean; subs?: number; sent?: number };
    return { ok: !!data.ok, subs: data.subs ?? 0, sent: data.sent ?? 0 };
  } catch {
    return { ok: false, subs: 0, sent: 0 };
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Recurring-chime boundary entries every `every` minutes (0 = none), aligned to
 *  midnight (60 = on the hour). Same {t,title,body} shape as slice boundaries, so
 *  the existing cron pushes them with no server change; body names the block the
 *  chime falls in. Skips a chime that coincides with a slice start (that already
 *  notifies). */
export function chimeBoundaries(
  slices: readonly TimeSlice[],
  every: number,
  untitled: string,
): Array<{ t: string; title: string; body: string }> {
  if (!every) return [];
  const starts = new Set(slices.map((s) => s.startTime));
  const covering = (min: number): TimeSlice | undefined =>
    slices.find((s) => {
      const start = Number(s.startTime.slice(0, 2)) * 60 + Number(s.startTime.slice(3));
      let end = Number(s.endTime.slice(0, 2)) * 60 + Number(s.endTime.slice(3));
      if (end <= start) end += 1440; // wrap past midnight
      const m = min < start ? min + 1440 : min;
      return m >= start && m < end;
    });
  const out: Array<{ t: string; title: string; body: string }> = [];
  for (let min = 0; min < 1440; min += every) {
    const t = `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
    if (starts.has(t)) continue; // slice-start already covers this minute
    const cur = covering(min);
    out.push({ t, title: `🔔 ${t}`, body: cur && cur.label ? cur.label : untitled });
  }
  return out;
}

/** Upload the boundary plan derived from the active schedule. Date-independent
 *  (start times repeat daily); the cron dedupes per local day. `chimeEvery` adds
 *  recurring time-chime entries to the same plan (Pro closed-app chimes). */
export async function uploadPushPlan(
  slices: readonly TimeSlice[],
  untitled: string,
  chimeEvery = 0,
): Promise<boolean> {
  try {
    const boundaries = [
      ...slices.map((s) => ({
        t: s.startTime,
        title: `${s.icon ? s.icon + ' ' : ''}${s.label || untitled}`,
        body: `${s.startTime}–${s.endTime}`,
      })),
      ...chimeBoundaries(slices, chimeEvery, untitled),
    ];
    const res = await fetch('/api/push/plan', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ boundaries, tzOffset: -new Date().getTimezoneOffset() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
