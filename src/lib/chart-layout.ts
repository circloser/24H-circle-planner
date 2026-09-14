/**
 * Where the circular timetable sits on the desktop canvas.
 *
 * - `center` — the classic look (default).
 * - `left` / `right` — the chart hugs that edge, freeing the other side for
 *   widgets (clocks, calendar, weather, news, post-its).
 * - `hidden` — a clean canvas. The chart stays MOUNTED offscreen, so export,
 *   share and the phone widget (all of which read the live svg) keep working.
 *
 * Phones always stack the chart centred, and the table/record views ignore the
 * layout, so every rule here funnels through `effectiveChartLayout`.
 */
import type { ChartView } from './chart-view';

export type ChartLayout = 'center' | 'left' | 'right' | 'hidden';

export const CHART_LAYOUTS: readonly ChartLayout[] = ['center', 'left', 'right', 'hidden'];

export function isChartLayout(v: unknown): v is ChartLayout {
  return typeof v === 'string' && (CHART_LAYOUTS as readonly string[]).includes(v);
}

/** Gap between the chart and the screen edge it hugs in the side layouts (px). */
export const CHART_SIDE_GAP = 40;

/** Desktop chart width: 720px at most, never wider than its column, and capped
 *  by the viewport height minus the app chrome (≈250px) so the planner fits one
 *  screen; 320px keeps it usable on very short windows. */
export const CHART_WIDTH = 'min(720px, 100%, max(320px, calc(100dvh - 250px)))';

export interface ChartLayoutContext {
  isMobile: boolean;
  chartView: ChartView;
  /** The tutorial points at slices and the rim, so it needs the chart shown. */
  tutorialOpen: boolean;
}

/** The layout actually rendered, after the phone / view / tutorial rules. */
export function effectiveChartLayout(layout: unknown, ctx: ChartLayoutContext): ChartLayout {
  if (ctx.isMobile || ctx.chartView === 'table' || ctx.chartView === 'record') return 'center';
  const chosen = isChartLayout(layout) ? layout : 'center';
  return chosen === 'hidden' && ctx.tutorialOpen ? 'center' : chosen;
}

/** The hidden layout parks the chart far offscreen at full size. Not
 *  display:none: the export, share and phone-widget renderers read the live svg
 *  and need it laid out. */
export const HIDDEN_CHART_STYLE = { position: 'fixed', left: -20000, top: 0, width: 720 } as const;

/** CSS `left` for a fixed element that should sit centred over the chart (the
 *  desktop day strip and its bottom pill). `100vw` counts a scrollbar the
 *  chart's column doesn't, so it can be a few px off while one shows; the chart
 *  is sized to fit one screen, so normally none does. */
export function chartCentreLeft(layout: ChartLayout): string {
  const width = `min(720px, calc(100vw - ${2 * CHART_SIDE_GAP}px), max(320px, calc(100dvh - 250px)))`;
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
