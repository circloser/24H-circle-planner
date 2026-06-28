/**
 * Chart view windows. The schedule data is always a full 24h; a view just remaps
 * which time window fills the circle and at what angle:
 *  - 'full' : 00:00 → 24:00, 00:00 at top (the original 24h clock).
 *  - 'day'  : 06:00 → 18:00, the 06/18 seam at the BOTTOM, noon at top.
 *  - 'night': 18:00 → 06:00, the 18/06 seam at the BOTTOM, midnight at top.
 * Editing stays linked because angle↔time uses the same spec in both directions.
 */
export type ChartView = 'full' | 'day' | 'night' | 'table';

export const CHART_VIEWS: ChartView[] = ['full', 'day', 'night', 'table'];

export interface ViewSpec {
  view: ChartView;
  startMin: number; // window start, minutes of day
  spanMin: number; // 1440 (full) or 720 (12h)
  startAngleDeg: number; // angle of the window start: -90 (top) for full, 90 (bottom) for 12h
}

export function viewSpec(view: ChartView): ViewSpec {
  if (view === 'day') return { view, startMin: 360, spanMin: 720, startAngleDeg: 90 };
  if (view === 'night') return { view, startMin: 1080, spanMin: 720, startAngleDeg: 90 };
  return { view: 'full', startMin: 0, spanMin: 1440, startAngleDeg: -90 };
}

export const FULL_SPEC: ViewSpec = viewSpec('full');

/** Forward distance (minutes) of `min` from the window start, 0..1439. */
function relMin(min: number, spec: ViewSpec): number {
  return (((min - spec.startMin) % 1440) + 1440) % 1440;
}

/** Chart angle (deg) for a minute-of-day under the given view. For FULL this is
 *  exactly the legacy hhmmToAngle mapping. */
export function angleForMin(min: number, spec: ViewSpec): number {
  return spec.startAngleDeg + (relMin(min, spec) / spec.spanMin) * 360;
}

/** Inverse of angleForMin: chart angle (deg) → minute-of-day (0..1439). */
export function minForAngle(deg: number, spec: ViewSpec): number {
  let f = (deg - spec.startAngleDeg) / 360;
  f = ((f % 1) + 1) % 1; // wrap to [0,1)
  return Math.round((spec.startMin + f * spec.spanMin)) % 1440;
}

/** True if the minute lies within this view's window. */
export function isInWindow(min: number, spec: ViewSpec): boolean {
  if (spec.view === 'full') return true;
  return relMin(min, spec) < spec.spanMin;
}

/**
 * The visible parts of a slice [startMin, +widthMin) within the window, as
 * absolute-minute ranges. A slice can produce 0, 1, or (rarely) 2 segments — 2
 * when it covers both ends of the window. For FULL it's always the whole slice.
 */
export function visibleSegments(
  startMin: number,
  widthMin: number,
  spec: ViewSpec,
): Array<{ startMin: number; endMin: number; widthMin: number }> {
  if (spec.view === 'full') {
    return [{ startMin, endMin: (startMin + widthMin) % 1440, widthMin }];
  }
  const span = spec.spanMin;
  const rs = relMin(startMin, spec);
  const pieces: Array<[number, number]> = [];
  const clip = (a: number, b: number) => {
    const lo = Math.max(a, 0);
    const hi = Math.min(b, span);
    if (hi - lo > 0.001) pieces.push([lo, hi]);
  };
  if (rs + widthMin <= 1440) {
    clip(rs, rs + widthMin);
  } else {
    clip(rs, 1440);
    clip(0, rs + widthMin - 1440);
  }
  return pieces.map(([a, b]) => ({
    startMin: (spec.startMin + a) % 1440,
    endMin: (spec.startMin + b) % 1440,
    widthMin: b - a,
  }));
}
