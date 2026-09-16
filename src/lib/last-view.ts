import type { ChartView } from './chart-view';

/**
 * The timetable view the calendar comes back to. It lives here rather than in
 * preferences so it never syncs between devices and can never be 'calendar' —
 * the calendar button and the view button both need the same answer.
 */
let last: ChartView = 'full';

export function rememberTimetableView(view: ChartView): void {
  if (view !== 'calendar') last = view;
}

export function timetableView(): ChartView {
  return last;
}
