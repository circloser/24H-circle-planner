import { useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { useTranslation } from '@/hooks/usePreferences';

/**
 * Auto-save trust signal. Every edit persists to localStorage on a debounce;
 * this briefly shows "Saving…" after a change, then settles on "Saved", so users
 * can see their work is being kept (reduces the "will I lose this?" anxiety).
 * Tied to the schedule store (the primary editing surface).
 */
/** Show "Saved" for this long after the save settles, then fade the indicator out. */
const SAVED_LINGER_MS = 10_000;

type Phase = 'idle' | 'saving' | 'saved';

export function SaveIndicator() {
  const present = useStoreSelector((s) => s.history.present);
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>('idle');
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false; // skip the initial mount (no edit happened)
      return;
    }
    setPhase('saving');
    const savedId = setTimeout(() => setPhase('saved'), 800);
    // ~10s after it settles on "Saved", hide the indicator for a clean header.
    const hideId = setTimeout(() => setPhase('idle'), 800 + SAVED_LINGER_MS);
    return () => {
      clearTimeout(savedId);
      clearTimeout(hideId);
    };
  }, [present]);

  // Idle (initial, or 10s after the last save): show nothing.
  if (phase === 'idle') return null;

  const saving = phase === 'saving';
  return (
    <div
      className="inline-flex shrink-0 items-center gap-1 text-xs"
      style={{ color: 'hsl(var(--text-muted))' }}
      aria-live="polite"
      title={saving ? t('app.saving') : t('app.saved')}
    >
      {saving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Check className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">{saving ? t('app.saving') : t('app.saved')}</span>
    </div>
  );
}
