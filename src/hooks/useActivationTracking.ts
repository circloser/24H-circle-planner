import { useEffect } from 'react';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { track } from '@/lib/track';

/** Fires `schedule_edit` once per browser session the first time the user makes
 *  any undoable edit (history.past grows) — i.e. they made the schedule theirs.
 *  This is the activation funnel's key middle step (view → EDIT → alarm). */
export function useActivationTracking(): void {
  const edited = useStoreSelector((s) => s.history.past.length > 0);
  useEffect(() => {
    if (!edited) return;
    try {
      if (sessionStorage.getItem('24h-edited') === '1') return;
      sessionStorage.setItem('24h-edited', '1');
    } catch {
      /* sessionStorage unavailable — fall through and still record it once */
    }
    track('schedule_edit');
  }, [edited]);
}
