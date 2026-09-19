import { isPageView, type ChartView } from './chart-view';

/**
 * The timetable view the calendar (or the life page) comes back to. It lives
 * here rather than in preferences so it never syncs between devices and is
 * never one of those pages — their buttons and the view button all need the
 * same answer.
 */
let last: ChartView = 'full';

export function rememberTimetableView(view: ChartView): void {
  if (!isPageView(view)) last = view;
}

export function timetableView(): ChartView {
  return last;
}
