import { useEffect, useState } from 'react';
import { dateKey } from '@/hooks/useDiary';

/**
 * Re-renders the caller when the local calendar day rolls over — e.g. past
 * midnight while the app is left open — so time-derived UI (the untitled hub
 * date) stays current without a reload.
 *
 * Polls once a minute and only updates state when the day key actually changes,
 * so React bails out of re-rendering on every other tick. A minute poll (rather
 * than a precise setTimeout to midnight) is deliberate: it's robust to the
 * machine sleeping through midnight — the first tick after wake catches up.
 *
 * Returns today's `YYYY-MM-DD` (local) key.
 */
export function useDayChange(): string {
  const [key, setKey] = useState(() => dateKey());
  useEffect(() => {
    const id = setInterval(() => {
      setKey((prev) => {
        const next = dateKey();
        return prev === next ? prev : next;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return key;
}
