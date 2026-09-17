/**
 * Android home-screen widget publishing (web half).
 *
 * The native widget cannot read this app's storage, so the app pushes a
 * transparent PNG of the ring to a server slot addressed by a secret token that
 * only this phone knows (`24h-circle-planner.widget-token`, device-local — it
 * is deliberately NOT part of cloud sync, because the widget belongs to one
 * phone). The widget polls the slot with ETag revalidation and draws the live
 * current-time hand on top using `meta` (ring geometry in image pixels + the
 * view window), so the image can stay a static render while the hand moves.
 *
 * Flow: WidgetConnectDialog creates the token, publishes once, and hands the
 * token to the Android side via houring24://widget?token=…; afterwards
 * useWidgetPublisher republishes (debounced) whenever the timetable, the ring
 * preferences or the chart view change, so the widget follows edits on its own.
 */
import { RING, type RingGeom } from '@/lib/svg-geometry';
import type { ViewSpec } from '@/lib/chart-view';

export const WIDGET_TOKEN_KEY = '24h-circle-planner.widget-token';
/** Fired (window) when the token is created or cleared, so the publisher hook
 *  starts/stops without a reload. */
export const WIDGET_TOKEN_EVENT = '24h:widget-token';

/** Rendered image side (px). */
export const WIDGET_PNG_SIZE = 1080;
/** How far past the rim the drawing reaches, in SVG units: the cardinal hour
 *  numbers sit at outerR + 32 with a 30px face and a 5px outline (measured
 *  ≈54 on the real render; 56 leaves a hair of room for anti-aliasing). */
const LABEL_REACH = 56;
/** The chart's own viewBox is -36..1036 — never crop wider than that. */
const VIEW_HALF_MAX = 536;

/**
 * The square of the chart the widget image shows: the ring and its hour
 * numbers, and nothing more. A smaller ring is simply drawn larger, so the
 * ring always fills the widget instead of floating in an empty margin. The
 * image and the geometry sent with it must use the SAME crop, or the natively
 * drawn hand drifts off the ring.
 */
export interface WidgetView {
  x: number;
  y: number;
  size: number;
}

export function widgetView(ring: RingGeom = RING): WidgetView {
  const half = Math.min(VIEW_HALF_MAX, ring.outerR + LABEL_REACH);
  return { x: ring.cx - half, y: ring.cy - half, size: half * 2 };
}

export const viewBoxOf = (v: WidgetView): string => `${v.x} ${v.y} ${v.size} ${v.size}`;

/** SVG user unit (x axis) → pixel in the widget image. */
export const svgToPx = (u: number, view: WidgetView = widgetView()): number =>
  ((u - view.x) / view.size) * WIDGET_PNG_SIZE;

const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TOKEN_LEN = 22; // 62^22 ≈ 2^131

export function newWidgetToken(): string {
  const bytes = new Uint8Array(TOKEN_LEN);
  crypto.getRandomValues(bytes);
  let t = '';
  for (const b of bytes) t += TOKEN_ALPHABET[b % TOKEN_ALPHABET.length];
  return t;
}

export function readWidgetToken(): string | null {
  try {
    const t = localStorage.getItem(WIDGET_TOKEN_KEY);
    return t && /^[A-Za-z0-9]{16,32}$/.test(t) ? t : null;
  } catch {
    return null;
  }
}

/** The phone's token, creating one on first use. */
export function ensureWidgetToken(): string {
  const existing = readWidgetToken();
  if (existing) return existing;
  const t = newWidgetToken();
  try {
    localStorage.setItem(WIDGET_TOKEN_KEY, t);
  } catch {
    /* storage unavailable — the token just won't survive a reload */
  }
  window.dispatchEvent(new Event(WIDGET_TOKEN_EVENT));
  return t;
}

/**
 * Auto-link: the Android widget mints a slot token the moment it is placed and
 * the app's launcher passes it in the launch URL (`?w=<token>`) until the
 * widget has seen an image in that slot. Adopt it here — replacing any older
 * token this phone had (its slot is dropped, best effort) — and scrub the
 * parameter from the address so it is never bookmarked, shared or replayed.
 * Returns the adopted token, or null when the URL carried none. Only honoured
 * inside the Play Store app: on the open web the parameter is just stripped.
 */
export function adoptWidgetTokenFromUrl(
  loc: { search: string; pathname: string; hash: string } = window.location,
  inTwa = true,
): string | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(loc.search);
  } catch {
    return null;
  }
  const w = params.get('w');
  if (w === null) return null;
  params.delete('w');
  const rest = params.toString();
  try {
    history.replaceState(history.state, '', `${loc.pathname}${rest ? `?${rest}` : ''}${loc.hash}`);
  } catch {
    /* history unavailable */
  }
  if (!inTwa || !/^[A-Za-z0-9]{16,32}$/.test(w)) return null;
  const previous = readWidgetToken();
  if (previous === w) return w;
  if (previous) void deleteWidgetSlot(previous);
  try {
    localStorage.setItem(WIDGET_TOKEN_KEY, w);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(WIDGET_TOKEN_EVENT));
  return w;
}

export function clearWidgetToken(): void {
  try {
    localStorage.removeItem(WIDGET_TOKEN_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(WIDGET_TOKEN_EVENT));
}

/**
 * What the native side needs to draw the now-hand onto the image: ring centre
 * and radii in IMAGE PIXELS, the view window (so 12h day/night views map the
 * hand correctly and hide it when "now" is outside the window), the hand
 * colour, and whether the theme is dark (for the clock text + hand halo).
 */
export interface WidgetMeta {
  v: 1;
  cx: number;
  cy: number;
  innerR: number;
  outerR: number;
  startMin: number;
  spanMin: number;
  startAngleDeg: number;
  hand: string;
  dark: boolean;
  /** App UI language (BCP-47 primary tag) — the widget formats the hub date in
   *  it, not in the phone's system locale. */
  lang: string;
}

export function widgetMeta(spec: ViewSpec, handColor: string, dark: boolean, lang: string, ring: RingGeom = RING): WidgetMeta {
  const view = widgetView(ring);
  const scale = WIDGET_PNG_SIZE / view.size;
  return {
    v: 1,
    cx: round((ring.cx - view.x) * scale),
    cy: round((ring.cy - view.y) * scale),
    innerR: round(ring.innerR * scale),
    outerR: round(ring.outerR * scale),
    startMin: spec.startMin,
    spanMin: spec.spanMin,
    startAngleDeg: spec.startAngleDeg,
    hand: handColor,
    dark,
    lang: /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(lang) ? lang : 'en',
  };
}

const round = (n: number): number => Math.round(n * 100) / 100;

export function isDarkTheme(): boolean {
  try {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

/** Render the current ring and upload it to the phone's slot. */
export async function publishWidget(svg: SVGSVGElement, token: string, meta: WidgetMeta): Promise<boolean> {
  try {
    const { buildWidgetPngBase64 } = await import('@/lib/export/ogImage');
    // Cropped exactly as `meta` was computed (both read the live ring).
    const png = await buildWidgetPngBase64(svg, viewBoxOf(widgetView()));
    if (!png) return false;
    const res = await fetch(`/api/widget/${token}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ png, meta }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Drop the server copy. The local token is cleared separately so a failed
 *  delete (offline) can be retried from the dialog. */
export async function deleteWidgetSlot(token: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/widget/${token}`, { method: 'DELETE' });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
