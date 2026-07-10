/**
 * Center-relative position transform for the floating widgets on the SYNC wire.
 *
 * The clock tools and goals widget store ABSOLUTE viewport pixels locally
 * (top-left origin) — the drag engine and renderer stay in absolute space, so
 * this transform touches none of that. But absolute pixels don't translate
 * across screens: a clock at x=1800 on a 4K monitor lands off a laptop. So at
 * the sync boundary every position is re-expressed RELATIVE TO THE VIEWPORT
 * CENTRE — encode subtracts THIS device's centre, decode adds the RECEIVING
 * device's centre. A layout therefore keeps its distance-from-centre across
 * devices; a larger screen simply grows the surrounding margins symmetrically
 * (the requested behaviour).
 *
 * The centre is an INTEGER (Math.round(inner/2)), which makes encode/decode
 * exact inverses on one device: `decode(encode(p)) === p`. That involution is
 * what keeps widget sync LOOP-FREE — re-saving an applied remote value
 * reproduces byte-identical wire data, so the engine never sees a phantom
 * change (the failure that made a naive widget-key add loop on login).
 */

const PREFIX = '24h-circle-planner.';

/** The floating clock-tools blob (clocks/calendar/weather/alarm/timer). */
export const CLOCKTOOLS_KEY = PREFIX + 'clocktools';
/** The goals-widget position ({x,y}). */
export const GOALSWIDGET_KEY = PREFIX + 'goalswidget';

/** Synced keys whose positions are re-based to the viewport centre on the wire. */
export const WIDGET_KEYS: readonly string[] = [CLOCKTOOLS_KEY, GOALSWIDGET_KEY];

export function isWidgetKey(key: string): boolean {
  return key === CLOCKTOOLS_KEY || key === GOALSWIDGET_KEY;
}

/** Integer centre of the current viewport (SSR/test-safe defaults match the
 *  widget code's own fallbacks so a headless transform stays consistent). */
function viewportCentre(): { cx: number; cy: number } {
  const vw = typeof window !== 'undefined' && window.innerWidth ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 800;
  return { cx: Math.round(vw / 2), cy: Math.round(vh / 2) };
}

/** Recursively shift every position object — an EXACTLY `{x:number,y:number}`
 *  pair — by (dx,dy). The 2-key guard means only real positions move (a clock's
 *  `pos`, the goals `{x,y}`); a weather `{name,lat,lon}` or any other object is
 *  left untouched. No rounding, so the shift is an exact inverse of itself. */
function shiftPositions(value: unknown, dx: number, dy: number): unknown {
  if (Array.isArray(value)) return value.map((v) => shiftPositions(v, dx, dy));
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 2 && typeof o.x === 'number' && typeof o.y === 'number') {
      return { x: (o.x as number) + dx, y: (o.y as number) + dy };
    }
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = shiftPositions(o[k], dx, dy);
    return out;
  }
  return value;
}

function transform(raw: string, sign: 1 | -1): string {
  try {
    const { cx, cy } = viewportCentre();
    return JSON.stringify(shiftPositions(JSON.parse(raw), sign * cx, sign * cy));
  } catch {
    return raw; // corrupt / non-JSON value → pass through unchanged
  }
}

/** localStorage (absolute) → wire (centre-relative). */
export function encodeWidgetValue(raw: string): string {
  return transform(raw, -1);
}

/** wire (centre-relative) → localStorage (absolute, in THIS viewport). */
export function decodeWidgetValue(raw: string): string {
  return transform(raw, 1);
}

/** Fired after a clock-tools value arrives from the cloud (re-read live, no reload). */
export const CLOCKTOOLS_SYNC_EVENT = '24h:clocktools-synced';
/** Fired after the goals-widget position arrives from the cloud. */
export const GOALS_WIDGET_SYNC_EVENT = '24h:goalswidget-synced';
