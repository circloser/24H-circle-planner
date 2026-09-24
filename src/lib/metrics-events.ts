/**
 * First-party usage counts — the shared vocabulary of the client (track.ts) and
 * the Worker (worker/metrics.ts).
 *
 * What is recorded is only "on this day, this event happened once more": no
 * user, device, IP, cookie or content. An event may carry ONE short tag (the
 * value of its first parameter, e.g. `upgrade_open:decor`), and only when the
 * tag is on METRIC_TAGS, so free text can never end up in the table.
 */
export const METRIC_EVENTS = [
  // Which page of the app is being looked at, and which feature was used.
  // Together these two answer "what do people actually do here" without
  // anything being counted twice: one is a place, the other is an action.
  'view_open', 'feature_use',
  // Sessions and the core planner.
  'app_open', 'schedule_edit', 'meaningful_schedule_edit', 'schedule_import', 'preset_load', 'onboard_persona',
  'export', 'share', 'palette_apply', 'palette_add', 'day_complete', 'pip_open',
  // Sign-in, Pro and billing.
  'login_start', 'upgrade_open', 'price_loaded', 'checkout_start', 'coupon_redeem',
  // Activation.
  'home_open', 'installed', 'notif_permission', 'alarm_enable', 'aha_nudge_shown', 'aha_nudge_action',
  'widget_connect', 'widget_unlink',
  // Calendar and decorating.
  'calendar_open', 'cal_plan_add', 'ical_connect', 'decor_tool', 'decor_place', 'paper_set', 'cal_image',
  // Life (the whole-life timeline).
  'life_open', 'life_start', 'life_add', 'life_image', 'life_backup', 'life_share',
  // 자서전 — the one thing in the app that is bought outright.
  'memoir_buy', 'memoir_paid', 'memoir_write', 'saju_open', 'saju_read', 'saju_share',
  // Relation (the people around you).
  'relation_open', 'relation_add', 'relation_import', 'relation_link', 'relation_contact',
  'relation_image', 'relation_backup', 'relation_history', 'relation_fact', 'relation_meet',
  // Place (the countries and spots you have been to).
  'place_open', 'place_country', 'place_city', 'place_pin', 'place_home',
  'place_locate', 'place_image', 'place_backup', 'place_shortcut',
] as const;

export type MetricEvent = (typeof METRIC_EVENTS)[number];

/** Most names one request may carry. */
export const MAX_METRICS_PER_POST = 20;

/** Tags that may ride along. A closed list: anyone can post counts, so the
 *  table must stay bounded by (events × tags) rows a day whatever is sent. */
export const METRIC_TAGS = [
  // The pages of the app (view_open). 'life', 'relation' and 'place' are
  // below, where they already were.
  'chart', 'table', 'record', 'calendar',
  // The features worth knowing about (feature_use). Each is one thing a
  // person chose to do, never what they wrote while doing it.
  'settings', 'magician', 'tutorial', 'search', 'city_search', 'heat', 'filter', 'globe',
  'life_line', 'life_zoom', 'relation_group', 'relation_place', 'widget', 'album', 'pet', 'news', 'goals',
  // Where the Pro offer was opened.
  'decor', 'ical', 'ads', 'stats', 'diary', 'watermark', 'slots', 'push', 'life', 'relation', 'place', 'other', 'direct',
  // Calendar plans and decorating.
  'span', 'allday', 'timed', 'sticker', 'tape', 'photo', 'none', 'grid', 'lined', 'dot', 'kraft',
  // Outcomes and kinds used by older events.
  'shared', 'downloaded', 'cancelled', 'json', 'pdf', 'png', 'image', 'link', 'slice', 'chime',
  'granted', 'denied', 'default', 'ios', 'mobile', 'desktop', 'alarm', 'phone', 'share_link', 'user',
] as const;

const KNOWN = new Set<string>(METRIC_EVENTS);
const TAGS = new Set<string>(METRIC_TAGS);

/** The stored name for an event — `event` or `event:tag` — or null when the
 *  event is not on the list. */
export function metricName(event: unknown, params?: unknown): string | null {
  if (typeof event !== 'string' || !KNOWN.has(event)) return null;
  const first = params && typeof params === 'object' ? Object.values(params as Record<string, unknown>)[0] : undefined;
  return typeof first === 'string' && TAGS.has(first) ? `${event}:${first}` : event;
}

/** A stored name, checked again on the server (the client is not trusted). */
export function isMetricName(name: unknown): name is string {
  if (typeof name !== 'string' || name.length > 64) return false;
  const [event, tag, extra] = name.split(':');
  return KNOWN.has(event) && extra === undefined && (tag === undefined || TAGS.has(tag));
}
