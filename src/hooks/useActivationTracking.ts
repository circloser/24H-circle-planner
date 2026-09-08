import { useEffect, useRef } from 'react';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { track } from '@/lib/track';

/** Keep the historical event, and measure the first actual content/time edit separately. */
export function useActivationTracking(): void {
  const edited = useStoreSelector((state) => state.history.past.length > 0);
  const semanticRevision = useStoreSelector((state) => state.semanticEditRevision ?? 0);
  const initialRevision = useRef(semanticRevision);
  const recorded = useRef(false);
  const meaningfulRecorded = useRef(false);
  useEffect(() => {
    if (!edited || recorded.current) return;
    recorded.current = true;
    try {
      if (sessionStorage.getItem('24h-edited') === '1') return;
      sessionStorage.setItem('24h-edited', '1');
    } catch { /* The ref retains once-per-mount behavior without storage. */ }
    track('schedule_edit');
  }, [edited]);

  useEffect(() => {
    if (semanticRevision <= initialRevision.current || meaningfulRecorded.current) return;
    meaningfulRecorded.current = true;
    try {
      if (sessionStorage.getItem('24h-meaningful-edited') === '1') return;
      sessionStorage.setItem('24h-meaningful-edited', '1');
    } catch { /* No schedule content is stored or sent in this event. */ }
    track('meaningful_schedule_edit');
  }, [semanticRevision]);
}
