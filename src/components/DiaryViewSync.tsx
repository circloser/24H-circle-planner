import { useEffect, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { useDiary } from '@/hooks/useDiary';
import { useDays } from '@/hooks/useDays';
import { VIEW_KEY, VIEW_SYNC_EVENT } from '@/lib/sync/syncData';

/**
 * Cross-device diary VIEW sync (Pro). Mirrors the "currently viewed diary date"
 * to a small synced key ({diaryDate}) so entering / leaving / navigating a diary
 * on one signed-in device follows LIVE on the others — no page reload.
 *
 * Loading a diary changes no synced *content* (the legacy schedule key isn't
 * synced and the days writeback is gated on diaryDate), so only this cursor
 * travels. The sync engine applies a view-only change in place and fires
 * VIEW_SYNC_EVENT, which we handle here. Renders nothing.
 */
export function DiaryViewSync() {
  const diaryDate = useStoreSelector((s) => s.diaryDate);
  const dispatch = useStoreDispatch();
  const { entries } = useDiary();
  const { days, activeId } = useDays();
  const firstRun = useRef(true);

  // Publish our current view when it changes — but NOT on the initial mount, so a
  // plain reload (which resets to edit mode) doesn't push a view change that would
  // pull other devices out of the diary they're viewing.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify({ diaryDate: diaryDate ?? null }));
    } catch {
      /* storage unavailable */
    }
  }, [diaryDate]);

  // Apply a view adopted from the cloud (fired live by the sync engine).
  useEffect(() => {
    const apply = () => {
      let target: string | null = null;
      try {
        const v = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null');
        if (v && typeof v.diaryDate === 'string') target = v.diaryDate;
      } catch {
        /* ignore */
      }
      if (target === (diaryDate ?? null)) return; // already showing it
      if (target) {
        const e = entries[target];
        if (!e) return; // that diary isn't present locally (yet) — nothing to show
        dispatch({
          type: 'LOAD_DIARY',
          date: e.date,
          schedule: {
            id: uuid(),
            version: 1,
            name: e.name || '내 시간표',
            presetSource: null,
            updatedAt: new Date().toISOString(),
            slices: e.slices.map((s) => ({ ...s, id: uuid() })),
          },
        });
      } else {
        // View cleared → leave diary mode back to the working day.
        const active = activeId ? days.find((d) => d.id === activeId) : null;
        if (active) dispatch({ type: 'LOAD_SCHEDULE', schedule: active.schedule });
      }
    };
    window.addEventListener(VIEW_SYNC_EVENT, apply);
    return () => window.removeEventListener(VIEW_SYNC_EVENT, apply);
  }, [diaryDate, entries, days, activeId, dispatch]);

  return null;
}
