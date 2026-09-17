/**
 * GA4 event tracking — thin, safe wrapper over the gtag loaded in index.html.
 *
 * gtag only exists on the deployed http(s) site (index.html skips local dev and
 * the offline single-file build), so `track` must be a silent no-op everywhere
 * else — never throw, never block the action being measured.
 *
 * Event vocabulary (keep this list the source of truth; params are flat strings):
 *  - login_start                        — Google sign-in begun
 *  - upgrade_open                       — paywall/upgrade dialog shown
 *  - checkout_start                     — Polar checkout begun
 *  - coupon_redeem                      — coupon code applied successfully
 *  - export           {format}          — png | pdf | json | …
 *  - share            {method}          — image | link
 *  - preset_load      {preset}          — built-in persona id or 'user'
 *  - schedule_import  {name}            — #p= link accepted (incl. template CTAs)
 *
 * Activation funnel (view → edit → alarm → return; GA4 gives page_view/first_visit):
 *  - schedule_edit                      — first undoable edit this session (made it theirs)
 *  - home_open        {os}              — add-to-home guide shown (ios | other)
 *  - installed                          — PWA install prompt accepted
 *  - notif_permission {result}          — granted | denied | default
 *  - alarm_enable     {type}            — slice | push | chime  ← the aha moment
 *  - aha_nudge_shown  {device}          — post-first-edit activation nudge shown
 *  - aha_nudge_action {action}          — alarm | phone (nudge CTA tapped)
 */

import { MAX_METRICS_PER_POST, metricName } from './metrics-events';

type Gtag = (command: 'event', eventName: string, params?: Record<string, string | number | boolean>) => void;
type Params = Record<string, string | number | boolean>;

// ─── First-party counts ──────────────────────────────────────────────────────
// Events on the METRIC_EVENTS list are also counted by our own Worker: only the
// event name (and a one-word tag) per day — no user, device or content. They
// are batched and sent with sendBeacon, so counting never slows anything down.

const ENDPOINT = '/api/metrics';
const FLUSH_MS = 4000;
const queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let hooked = false;

/** Only the deployed site counts: not local builds, previews or file:// —
 *  unless a test turns it on explicitly. */
function counting(): boolean {
  try {
    if (!/^https?:$/.test(location.protocol)) return false;
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return localStorage.getItem('24h-metrics-debug') === '1';
    return true;
  } catch {
    return false;
  }
}

export function flushMetrics(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  while (queue.length) {
    const body = JSON.stringify({ e: queue.splice(0, MAX_METRICS_PER_POST) });
    try {
      const sent = typeof navigator.sendBeacon === 'function'
        && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      if (!sent) void fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {});
    } catch {
      // counting must never break the app
    }
  }
}

function count(event: string, params?: Params): void {
  const name = metricName(event, params);
  if (!name || !counting()) return;
  queue.push(name);
  if (!hooked) {
    hooked = true;
    // A closing tab still delivers what it counted.
    addEventListener('pagehide', flushMetrics);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushMetrics(); });
  }
  if (queue.length >= MAX_METRICS_PER_POST) flushMetrics();
  else timer ??= setTimeout(flushMetrics, FLUSH_MS);
}

export function track(event: string, params?: Params): void {
  try {
    const g = (window as unknown as { gtag?: Gtag }).gtag;
    if (typeof g === 'function') g('event', event, params);
    count(event, params);
  } catch {
    // analytics must never break the app
  }
}

const once = new Set<string>();
/** Count an event at most once per page load (e.g. "opened the calendar"),
 *  so the numbers read as sessions rather than clicks. */
export function trackOnce(event: string, params?: Params): void {
  const key = `${event}:${JSON.stringify(params ?? {})}`;
  if (once.has(key)) return;
  once.add(key);
  track(event, params);
}
