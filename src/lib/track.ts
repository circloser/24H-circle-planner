/**
 * Event tracking — one call feeds both Google Analytics (ga.ts: live site only,
 * region- and choice-gated) and our own anonymous counts (below). It must never
 * throw or block the action being measured.
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
 *
 * Where people go and what they do (trackView / trackFeature below):
 *  - view_open        {view}            — a page of the app was opened
 *  - feature_use      {feature}         — one thing somebody chose to do
 */

import { MAX_METRICS_PER_POST, metricName } from './metrics-events';
import { gaEvent, gaView } from './ga';

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
    gaEvent(event, params);
    count(event, params);
  } catch {
    // analytics must never break the app
  }
}

/**
 * The pages of the app. They are views inside one document rather than
 * addresses of their own, so both GA and our own counts are told which one is
 * being read as it opens — otherwise a session on the life line and a session
 * on the timetable are the same single page_view.
 */
export const TRACKED_VIEWS = ['chart', 'table', 'record', 'calendar', 'life', 'relation', 'place'] as const;
export type TrackedView = (typeof TRACKED_VIEWS)[number];

export function trackView(view: TrackedView): void {
  track('view_open', { view });
  try {
    gaView(view);
  } catch {
    // analytics must never break the app
  }
}

/**
 * The features worth knowing the use of: one thing a person chose to do.
 *
 * A closed list on purpose. Only the name of the thing is counted — never what
 * was typed into it, searched for, or written down.
 */
export const TRACKED_FEATURES = [
  'settings', 'magician', 'tutorial', 'search', 'city_search', 'heat', 'filter', 'globe',
  'life_line', 'life_zoom', 'relation_group', 'relation_place', 'widget', 'album', 'pet', 'news', 'goals',
] as const;
export type TrackedFeature = (typeof TRACKED_FEATURES)[number];

export const trackFeature = (feature: TrackedFeature): void => track('feature_use', { feature });

const once = new Set<string>();
/** Count an event at most once per page load (e.g. "opened the calendar"),
 *  so the numbers read as sessions rather than clicks. */
export function trackOnce(event: string, params?: Params): void {
  const key = `${event}:${JSON.stringify(params ?? {})}`;
  if (once.has(key)) return;
  once.add(key);
  track(event, params);
}
