import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { dayCompletion } from '@/lib/completion';
import { useTranslation } from '@/hooks/usePreferences';
import { track } from '@/lib/track';
import type { TimeSlice } from '@/types/time-slice';

/** Remembers the last day a 100%-completion toast was shown (one key, not one per day). */
const CELEBRATED_KEY = '24h-day-complete-last';

/**
 * Pride-moment share prompt: the first time the visible day's checklist reaches
 * 100% (at least 3 real tasks), celebrate with a toast whose action shares the
 * chart image. Fires only on an actual transition in this session (not when a
 * fully-checked day merely loads) and at most once per calendar day.
 */
export function useCompletionCelebration(
  slices: readonly TimeSlice[],
  dayId: string,
  shareImage: () => Promise<void> | void,
): void {
  const { t } = useTranslation();
  // Refs so the watcher effect only re-runs when the slices actually change.
  const shareRef = useRef(shareImage);
  const tRef = useRef(t);
  useEffect(() => {
    shareRef.current = shareImage;
    tRef.current = t;
  });
  const prevPct = useRef<number | null>(null);

  useEffect(() => {
    const { pct, total } = dayCompletion(slices);
    const prev = prevPct.current;
    prevPct.current = pct;
    if (pct !== 100 || total < 3) return;
    if (prev === null || prev === 100) return; // must cross into 100% while watching
    try {
      if (localStorage.getItem(CELEBRATED_KEY) === dayId) return;
      localStorage.setItem(CELEBRATED_KEY, dayId);
    } catch {
      // storage unavailable — celebrate anyway
    }
    track('day_complete', { total });
    toast.success(tRef.current('celebrate.day'), {
      action: { label: tRef.current('celebrate.share'), onClick: () => void shareRef.current() },
      duration: 10_000,
    });
  }, [slices, dayId]);
}
