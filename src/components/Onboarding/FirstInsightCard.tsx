import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';
import { sliceWidthMinutes } from '@/lib/time-utils';
import { useTranslation } from '@/hooks/usePreferences';
import type { TimeSlice } from '@/types/time-slice';

interface FirstInsightCardProps {
  slices: TimeSlice[];
  onClose: () => void;
}

interface Cat { label: string; icon: string; minutes: number }

/** Sum minutes per label (merging repeated blocks), biggest first. */
function categories(slices: TimeSlice[]): Cat[] {
  const by = new Map<string, Cat>();
  for (const s of slices) {
    const label = (s.label || '').trim();
    if (!label) continue;
    const prev = by.get(label);
    const minutes = (prev?.minutes ?? 0) + sliceWidthMinutes(s);
    by.set(label, { label, icon: prev?.icon || s.icon || '', minutes });
  }
  return [...by.values()].sort((a, b) => b.minutes - a.minutes);
}

/**
 * The first "aha": right after the first schedule exists, a small card reveals
 * the single biggest slice of the day — computed purely from the timetable, no
 * AI tokens. Turns the pretty circle into "here's what your day is actually
 * made of", and teases reshaping it tomorrow.
 */
export function FirstInsightCard({ slices, onClose }: FirstInsightCardProps) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(false);
  useEffect(() => { const id = window.setTimeout(() => setShown(true), 900); return () => window.clearTimeout(id); }, []);

  const cats = useMemo(() => categories(slices), [slices]);
  const top = cats[0];
  if (!top) return null;

  const pct = Math.round((top.minutes / 1440) * 100);
  const hm = t('goals.hm', { h: String(Math.floor(top.minutes / 60)), m: String(top.minutes % 60) });

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-24 z-[55] flex justify-center px-4"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-2xl"
        style={{ transform: shown ? 'translateY(0)' : 'translateY(12px)', opacity: shown ? 1 : 0, transition: 'transform .35s ease, opacity .35s ease' }}
      >
        <div className="mb-2 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4" style={{ color: 'hsl(var(--primary))' }} />
          <span className="flex-1 text-sm font-semibold text-foreground">{t('insight.title')}</span>
          <button type="button" onClick={onClose} aria-label={t('insight.close')}
            className="grid h-6 w-6 place-items-center rounded transition-colors hover:bg-black/10">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* The headline number: biggest chunk of the day. */}
        <div className="flex items-baseline gap-2">
          <span style={{ fontSize: 22 }}>{top.icon}</span>
          <span className="text-lg font-extrabold text-foreground">{top.label}</span>
          <span className="ml-auto text-sm font-bold tabular-nums" style={{ color: 'hsl(var(--primary))' }}>{pct}%</span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">{hm}</div>

        {/* Runner-up categories for context. */}
        {cats.length > 1 && (
          <ul className="mt-2.5 flex flex-col gap-1">
            {cats.slice(1, 4).map((c) => (
              <li key={c.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>{c.icon}</span>
                <span className="flex-1 truncate">{c.label}</span>
                <span className="tabular-nums">{Math.round((c.minutes / 1440) * 100)}%</span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs" style={{ color: 'hsl(var(--primary))' }}>{t('insight.nudge')}</p>
      </div>
    </div>,
    document.body,
  );
}
