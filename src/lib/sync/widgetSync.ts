/**
 * Floating-widget sync keys + live-apply events.
 *
 * Widget positions are stored as OFFSETS FROM THE VIEWPORT CENTRE (see
 * clock-utils), which is the circular chart's anchor. Because storage, render
 * and the sync wire all share that one space, the wire needs NO transform: the
 * stored string ships verbatim, every device renders `calc(50vw + x)`, and a
 * push→pull→apply round-trip is byte-identical — the property that keeps widget
 * sync both drift-free and loop-free. (An earlier design transformed positions
 * at the sync boundary against the LIVE viewport centre while rendering against
 * a persisted origin; any window resize made the two disagree and every sync
 * cycle shifted the widgets a little. Do not reintroduce a wire transform.)
 */

const PREFIX = '24h-circle-planner.';

/** The floating clock-tools blob (clocks/calendar/weather/alarm/timer). */
export const CLOCKTOOLS_KEY = PREFIX + 'clocktools';
/** The goals-widget position ({x,y,c}). */
export const GOALSWIDGET_KEY = PREFIX + 'goalswidget';
/** The news windows list ({id,q,country,intervalH,pos}[] — its own namespace,
 *  predates the shared prefix). Stored pos is centre-relative; the wire ships
 *  it verbatim, and per-resolution pos-profiles stay LOCAL render overrides. */
export const NEWS_WINDOWS_KEY = '24h-news.windows';

/** Synced keys that are KEPT when absent from a cloud blob (an old blob must
 *  never wipe local widgets — that removal+respawn caused a login reload loop). */
export const WIDGET_KEYS: readonly string[] = [CLOCKTOOLS_KEY, GOALSWIDGET_KEY, NEWS_WINDOWS_KEY];

export function isWidgetKey(key: string): boolean {
  return key === CLOCKTOOLS_KEY || key === GOALSWIDGET_KEY || key === NEWS_WINDOWS_KEY;
}

/** Fired after a clock-tools value arrives from the cloud (re-read live, no reload). */
export const CLOCKTOOLS_SYNC_EVENT = '24h:clocktools-synced';
/** Fired after the goals-widget position arrives from the cloud. */
export const GOALS_WIDGET_SYNC_EVENT = '24h:goalswidget-synced';
/** Fired after the news windows list arrives from the cloud. */
export const NEWS_SYNC_EVENT = '24h:news-synced';
