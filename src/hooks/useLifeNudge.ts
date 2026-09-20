import { useCallback, useEffect, useState } from 'react';
import { loadPersisted } from '@/hooks/usePersistedState';
import { lifeCodec } from '@/hooks/useLife';
import { LIFE_KEY } from '@/lib/life';
import { lifeNudge, markNudgeSeen, seenNudges, type LifeNudge } from '@/lib/life-nudge';

/** Window event: the page tells the header button that a nudge was closed. */
const CHANGED = '24h:life-nudge';

/**
 * The one thing worth saying about the life line today — read straight from
 * storage, so the header button can ask without mounting the page.
 */
export function useLifeNudge(): { nudge: LifeNudge | null; dismiss: (key: string) => void } {
  const read = useCallback(() => lifeNudge(loadPersisted(LIFE_KEY, lifeCodec), { seen: seenNudges() }), []);
  const [nudge, setNudge] = useState<LifeNudge | null>(read);
  useEffect(() => {
    const again = () => setNudge(read());
    window.addEventListener(CHANGED, again);
    window.addEventListener('focus', again);
    return () => {
      window.removeEventListener(CHANGED, again);
      window.removeEventListener('focus', again);
    };
  }, [read]);
  const dismiss = useCallback((key: string) => {
    markNudgeSeen(key);
    setNudge(null);
    try { window.dispatchEvent(new Event(CHANGED)); } catch { /* non-browser */ }
  }, []);
  return { nudge, dismiss };
}
