/**
 * Where a view starts when you open it.
 *
 * Switching views used to keep whatever scroll position the last one was left
 * at, so the calendar opened halfway down its second month and the life line
 * opened somewhere in the 1990s. A view should open at its own present moment:
 * the calendar and the timetable at the top, the life line with today in the
 * middle of the screen.
 *
 * Only crossing between the timetable and a page (calendar, life) counts as
 * opening something. Switching the timetable's own window — day to night, the
 * table to the ring — leaves the page where it was, because that is one view
 * changing rather than another one opening.
 */
import { isPageView, type ChartView } from './chart-view';

/** The element a view wants in the middle of the screen, if it has one. */
const ANCHOR: Partial<Record<ChartView, string>> = {
  life: '[data-life-today]',
};

export const viewAnchor = (view: ChartView): string | null => ANCHOR[view] ?? null;

/** Did the view just OPEN, rather than merely change shape? */
export function opensView(prev: ChartView | undefined, next: ChartView | undefined): boolean {
  if (!next || prev === next) return false;
  return isPageView(prev) || isPageView(next);
}

/** How many frames to wait for a view's anchor to be laid out before giving up. */
export const ANCHOR_TRIES = 12;

/**
 * Put `view` where it should start. The anchor may not be in the document for
 * a frame or two (the view is still rendering), so it is looked for a few
 * times before falling back to the top of the page.
 */
export function openViewAt(view: ChartView, tries = ANCHOR_TRIES): void {
  const selector = viewAnchor(view);
  const top = () => window.scrollTo({ top: 0, behavior: 'auto' });
  if (!selector) return top();
  const look = (left: number) => {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el.scrollIntoView({ block: 'center', behavior: 'auto' });
    if (left > 0) requestAnimationFrame(() => look(left - 1));
    else top();
  };
  look(tries);
}
