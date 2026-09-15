import { toStored, type Pos } from '@/components/ClockTools/clock-utils';

/** Post-its are a fixed 200×200. */
const SIZE = 200;
/** Space between a note and the one added beside it. */
const GAP = 12;
/** Minimum distance from the window edges. */
const EDGE = 8;
/** Keeps new notes below the app header. */
const HEADER_FLOOR = 72;

export interface Rect { left: number; top: number; right: number; bottom: number }

export interface SpotView {
  width: number;
  height: number;
  /** Lowest `y` a note may start at (under the header). */
  top: number;
  /** The chart's on-screen rect, or null when none is showing. A note over the
   *  chart sits behind it and can't be grabbed, so spots there are skipped. */
  chart: Rect | null;
}

const overlaps = (r: Rect, x: number, y: number) =>
  x < r.right && x + SIZE > r.left && y < r.bottom && y + SIZE > r.top;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Neighbouring slots, nearest first: the four sides, the diagonals, then two
 *  steps out along each side. */
const SLOTS: readonly [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [2, 0], [-2, 0], [0, 2], [0, -2],
];

/**
 * Where a note added from `from` goes, in viewport pixels (top-left corners):
 * the nearest neighbouring slot that is fully on screen, clear of the chart and
 * clear of every note in `others`. When all of them are taken, it cascades
 * slightly over the source note, still kept on screen.
 */
export function nextMemoSpot(from: Pos, others: readonly Pos[], view: SpotView): Pos {
  const step = SIZE + GAP;
  const chart = view.chart && {
    left: view.chart.left - GAP, top: view.chart.top - GAP, right: view.chart.right + GAP, bottom: view.chart.bottom + GAP,
  };
  const onScreen = (x: number, y: number) =>
    x >= EDGE && y >= view.top && x + SIZE <= view.width - EDGE && y + SIZE <= view.height - EDGE;
  const free = (x: number, y: number) =>
    !(chart && overlaps(chart, x, y)) &&
    !others.some((o) => overlaps({ left: o.x, top: o.y, right: o.x + SIZE, bottom: o.y + SIZE }, x, y));

  for (const [dx, dy] of SLOTS) {
    const x = from.x + dx * step;
    const y = from.y + dy * step;
    if (onScreen(x, y) && free(x, y)) return { x, y };
  }
  return {
    x: clamp(from.x + 24, EDGE, view.width - SIZE - EDGE),
    y: clamp(from.y + 24, view.top, view.height - SIZE - EDGE),
  };
}

/** The circular chart's rect while it is actually on screen; null for the table
 *  and record views and when a hidden layout parks the chart offscreen. */
export function visibleChartRect(): Rect | null {
  const r = document.querySelector('svg[data-circle-timeline]')?.getBoundingClientRect();
  if (!r || r.width === 0 || r.height === 0) return null;
  if (r.right <= 0 || r.left >= window.innerWidth || r.bottom <= 0 || r.top >= window.innerHeight) return null;
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

/** The stored (centre-offset) position for a note added beside `memo`, given
 *  the other on-screen notes' stored positions. */
export function spotBeside(memo: Pos, others: readonly Pos[]): Pos {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const toView = (p: Pos) => ({ x: w / 2 + p.x, y: h / 2 + p.y });
  const spot = nextMemoSpot(toView(memo), others.map(toView), { width: w, height: h, top: HEADER_FLOOR, chart: visibleChartRect() });
  return toStored(spot.x, spot.y);
}
