import { useState } from 'react';
import { Target, X, Check } from 'lucide-react';
import { useDiary, dateKey } from '@/hooks/useDiary';
import { useGoals } from '@/hooks/useGoals';
import { useTranslation } from '@/hooks/usePreferences';
import { accumulatedMinutes } from '@/lib/goals';

/**
 * Bottom-right floating goals viewer (next to the memo FAB). Appears only once
 * goals exist; the FAB toggles a small card showing each goal's live progress
 * (accumulated vs target), updating as the timetable is edited.
 */
export function GoalsWidget() {
  const { goals } = useGoals();
  const { entries } = useDiary();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // The feature only shows up once the user has set a goal/mission.
  if (goals.length === 0) return null;

  const fmt = (m: number) => t('goals.hm', { h: String(Math.floor(m / 60)), m: String(m % 60) });
  const todaySaved = !!entries[dateKey()];

  return (
    <>
      {open && (
        <div
          className="fixed bottom-[76px] right-5 z-30 max-h-[60vh] w-[300px] overflow-y-auto rounded-xl p-3 shadow-lg"
          style={{ backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))' }}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <Target className="h-4 w-4" style={{ color: 'hsl(var(--foreground))' }} />
            <span className="flex-1 text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{t('goals.title')}</span>
            <button
              type="button"
              aria-label={t('common.cancel')}
              onClick={() => setOpen(false)}
              className="grid h-6 w-6 place-items-center rounded transition-colors hover:bg-black/10"
            >
              <X className="h-4 w-4" style={{ color: 'hsl(var(--text-muted))' }} />
            </button>
          </div>
          <ul className="flex flex-col gap-2.5">
            {goals.map((g) => {
              const acc = accumulatedMinutes(g.label, g.period, entries);
              const pct = g.targetMinutes > 0 ? Math.min(100, Math.round((acc / g.targetMinutes) * 100)) : 0;
              const done = acc >= g.targetMinutes;
              return (
                <li key={g.id}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                      {g.label || t('goals.untitled')}
                    </span>
                    <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px]" style={{ backgroundColor: 'hsl(var(--muted) / 0.4)', color: 'hsl(var(--text-muted))' }}>
                      {g.period === 'day' ? t('goals.periodDay') : t('goals.periodWeek')}
                    </span>
                    {done && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: '#16a34a' }} />}
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'hsl(var(--muted) / 0.35)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: done ? '#16a34a' : 'hsl(var(--primary))' }} />
                  </div>
                  <div className="mt-0.5 text-right text-[11px] tabular-nums" style={{ color: 'hsl(var(--text-muted))' }}>
                    {fmt(acc)} / {fmt(g.targetMinutes)} · {pct}%
                  </div>
                </li>
              );
            })}
          </ul>
          {!todaySaved && (
            <p className="mt-2 text-[11px] leading-snug" style={{ color: 'hsl(var(--primary))' }}>{t('goals.saveDiaryHint')}</p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('goals.open')}
        aria-expanded={open}
        title={t('goals.open')}
        className="fixed bottom-5 right-[74px] z-30 grid h-12 w-12 place-items-center rounded-full shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--text-muted))', border: '1px solid hsl(var(--border))' }}
      >
        <Target className="h-5 w-5" />
      </button>
    </>
  );
}
