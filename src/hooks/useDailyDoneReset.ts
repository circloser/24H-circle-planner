import { useEffect, useRef } from 'react';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { useDayChange } from '@/hooks/useDayChange';

/** Per-device record of the day the live schedule's checks belong to. Local-only
 *  (NOT synced) — each device resets its own view once per local day. */
const DONE_DATE_KEY = '24h-circle-planner.done-date';

/**
 * Clears the LIVE schedule's per-block completion when the local day rolls over,
 * so each day starts as a fresh checklist. A loaded saved/diary day (diaryDate
 * set) keeps its checks. Stamps the last-reset date in localStorage so it fires
 * once per local day even across restarts / multi-day gaps.
 *
 * The check is DEFERRED a beat: the store + Days providers restore the real
 * schedule in their own (parent) mount effects, which run AFTER this child
 * effect, so judging staleness synchronously would see the initial demo schedule
 * (no checks) and wrongly stamp today — missing yesterday's restored checks. We
 * read the settled state through a ref inside a short timeout instead.
 */
export function useDailyDoneReset(): void {
  const today = useDayChange();
  const diaryDate = useStoreSelector((s) => s.diaryDate);
  const slices = useStoreSelector((s) => s.history.present.slices);
  const dispatch = useStoreDispatch();

  const ref = useRef({ diaryDate, slices });
  ref.current = { diaryDate, slices };

  useEffect(() => {
    const id = setTimeout(() => {
      const cur = ref.current;
      if (cur.diaryDate) return; // viewing a saved day — never touch its checks
      let last: string | null = null;
      try {
        last = localStorage.getItem(DONE_DATE_KEY);
      } catch {
        /* storage unavailable */
      }
      if (last === today) return; // already handled today
      if (cur.slices.some((sl) => sl.done)) dispatch({ type: 'RESET_DONE' });
      try {
        localStorage.setItem(DONE_DATE_KEY, today);
      } catch {
        /* storage unavailable */
      }
    }, 500);
    return () => clearTimeout(id);
  }, [today, diaryDate, dispatch]);
}
