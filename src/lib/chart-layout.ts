/**
 * Where the main timetable view sits on the desktop canvas — the circle, the
 * table and the record view alike.
 *
 * - `center` — the classic look (default).
 * - `left` / `right` — the view hugs that edge, freeing the other side for
 *   widgets (clocks, calendar, weather, news, post-its).
 * - `hidden` — a clean canvas. The view stays MOUNTED offscreen: export, share
 *   and the phone widget read the live chart svg, and the record view keeps its
 *   ticking clock and a half-typed entry.
 *
 * Phones always stack the view centred, so every rule here funnels through
 * `effectiveChartLayout`.
 */
import type { ChartView } from './chart-view';

export type ChartLayout = 'center' | 'left' | 'right' | 'hidden';

export const CHART_LAYOUTS: readonly ChartLayout[] = ['center', 'left', 'right', 'hidden'];

export function isChartLayout(v: unknown): v is ChartLayout {
  return typeof v === 'string' && (CHART_LAYOUTS as readonly string[]).includes(v);
}

/** Gap between the view and the screen edge it hugs in the side layouts (px). */
export const CHART_SIDE_GAP = 40;

/** Width of the main column for a view. `room` is the space it may fill:
 *  `100%` inside the column, or the window minus both side gaps for a fixed
 *  overlay that has to line up with it. The circle is also capped by the
 *  viewport height minus the app chrome (≈250px) so the planner fits one screen,
 *  with 320px as a floor for very short windows; the table and record views
 *  scroll, so only their own maximum widths apply. */
export function viewWidth(view: ChartView, room = '100%'): string {
  if (view === 'table') return `min(560px, ${room})`;
  if (view === 'record') return `min(720px, ${room})`;
  return `min(720px, ${room}, max(320px, calc(100dvh - 250px)))`;
}

/** Desktop width of the circle (24h, day and night views). */
export const CHART_WIDTH = viewWidth('full');

/** The hidden layout parks the view far offscreen at full size. Not
 *  display:none: the export, share and phone-widget renderers read the live svg
 *  and need it laid out. */
export const HIDDEN_CHART_STYLE = { position: 'fixed', left: -20000, top: 0, width: 720 } as const;

export interface ChartLayoutContext {
  isMobile: boolean;
  /** The tutorial points at slices and the rim, so it needs the chart shown. */
  tutorialOpen: boolean;
}

/** The layout actually rendered, after the phone and tutorial rules. */
export function effectiveChartLayout(layout: unknown, ctx: ChartLayoutContext): ChartLayout {
  if (ctx.isMobile) return 'center';
  const chosen = isChartLayout(layout) ? layout : 'center';
  return chosen === 'hidden' && ctx.tutorialOpen ? 'center' : chosen;
}

/** CSS `left` for a fixed element that should sit centred over the current view
 *  (the desktop day strip and its bottom pill). `100vw` counts a scrollbar the
 *  column doesn't, so in the right layout it can be a few px off while one
 *  shows. */
export function chartCentreLeft(layout: ChartLayout, view: ChartView = 'full'): string {
  const width = viewWidth(view, `calc(100vw - ${2 * CHART_SIDE_GAP}px)`);
  if (layout === 'left') return `calc(${CHART_SIDE_GAP}px + ${width} / 2)`;
  if (layout === 'right') return `calc(100vw - ${CHART_SIDE_GAP}px - ${width} / 2)`;
  return '50%';
}

const PREFS_KEY = '24h-circle-planner.prefs';

/** The saved layout, for code outside React (a widget's first spawn spot). */
export function readStoredChartLayout(): ChartLayout {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const v: unknown = raw ? JSON.parse(raw)?.prefs?.chartLayout : undefined;
    return isChartLayout(v) ? v : 'center';
  } catch {
    return 'center';
  }
}
