import { useEffect, useRef, type RefObject } from 'react';
import { isPlayStoreApp } from '@/lib/twa';
import { useChartView, useNowLineStyle, usePreferences } from '@/hooks/usePreferences';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { viewSpec } from '@/lib/chart-view';
import {
  WIDGET_TOKEN_EVENT,
  adoptWidgetTokenFromUrl,
  isDarkTheme,
  publishWidget,
  readWidgetToken,
  widgetMeta,
} from '@/lib/widget/publish';

/** Quiet period after the last change before the widget image is re-rendered
 *  and uploaded — long enough to swallow a burst of drag edits, short enough
 *  that the image is on the server before the user reaches the home screen. */
const DEBOUNCE_MS = 2500;

/**
 * Keeps the phone's home-screen widget in step with the app (Play Store TWA
 * only). Once the widget is linked (a token exists), every change to the
 * timetable, the ring/theme preferences or the chart view republishes the
 * transparent ring image — debounced — and a backgrounding of the app flushes
 * a pending publish immediately, so what the widget fetches when the user
 * lands on the home screen is already the latest state.
 *
 * Diary browsing is skipped: the chart then shows a past day, and the widget
 * should keep showing the live timetable.
 */
export function useWidgetPublisher(svgRef: RefObject<SVGSVGElement | null>): void {
  const present = useStoreSelector((s) => s.history.present);
  const diaryDate = useStoreSelector((s) => s.diaryDate);
  const { prefs } = usePreferences();
  const view = useChartView();
  const nowLine = useNowLineStyle();

  const timerRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  const againRef = useRef(false);
  // Latest inputs, read at publish time (the effect below only schedules).
  const latestRef = useRef({ view, handColor: nowLine.color });
  latestRef.current = { view, handColor: nowLine.color };

  useEffect(() => {
    if (!isPlayStoreApp()) return;

    const publish = async () => {
      const token = readWidgetToken();
      const svg = svgRef.current;
      if (!token || !svg) {
        dirtyRef.current = false;
        return;
      }
      if (inFlightRef.current) {
        againRef.current = true; // coalesce: one more run after this one
        return;
      }
      inFlightRef.current = true;
      dirtyRef.current = false;
      try {
        const { view: v, handColor } = latestRef.current;
        await publishWidget(svg, token, widgetMeta(viewSpec(v), handColor, isDarkTheme()));
      } finally {
        inFlightRef.current = false;
        if (againRef.current) {
          againRef.current = false;
          void publish();
        }
      }
    };

    const schedule = () => {
      if (!readWidgetToken() || diaryDate) return;
      dirtyRef.current = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void publish();
      }, DEBOUNCE_MS);
    };

    // Leaving the app (home button / task switch) → flush now, so the widget's
    // fetch on arrival at the home screen already sees this edit.
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden' || !dirtyRef.current) return;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void publish();
    };
    // Token created (dialog) or cleared → publish once / stop.
    const onToken = () => {
      if (readWidgetToken()) schedule();
    };

    // Auto-link: a freshly placed widget hands its token over in the launch
    // URL (?w=…). Adopt it (and strip it) before the first publish decision.
    adoptWidgetTokenFromUrl(window.location, true);
    schedule();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener(WIDGET_TOKEN_EVENT, onToken);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(WIDGET_TOKEN_EVENT, onToken);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // `present`/`prefs`/`view`/`nowLine.color` are the change signals; their
    // values are read from latestRef / the DOM at publish time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present, prefs, view, nowLine.color, diaryDate, svgRef]);
}
