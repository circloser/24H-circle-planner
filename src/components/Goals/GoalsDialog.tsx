import { useState } from 'react';
import { Target, Trash2, Check, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AdSlot } from '@/components/Ads/AdSlot';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { useDiary } from '@/hooks/useDiary';
import { useGoals } from '@/hooks/useGoals';
import { useTranslation } from '@/hooks/usePreferences';
import { accumulatedMinutes, knownLabels } from '@/lib/goals';

interface GoalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoalsDialog({ open, onOpenChange }: GoalsDialogProps) {
  const present = useStoreSelector((s) => s.history.present);
  const { entries } = useDiary();
  const { goals, addGoal, removeGoal } = useGoals();
  const { t } = useTranslation();

  const [label, setLabel] = useState('');
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('0');
  const [period, setPeriod] = useState<'day' | 'week'>('day');

  const fmt = (m: number) => t('goals.hm', { h: String(Math.floor(m / 60)), m: String(m % 60) });

  function submit() {
    const tm = (parseInt(hours, 10) || 0) * 60 + (parseInt(minutes, 10) || 0);
    if (!label.trim() || tm <= 0) return;
    addGoal({ label: label.trim(), targetMinutes: tm, period });
    setLabel('');
    setHours('1');
    setMinutes('0');
  }

  const labelOptions = knownLabels(present.slices, entries);
  const numCls = 'w-14 rounded-md px-2 py-1 text-center tabular-nums outline-none';
  const numStyle = { backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' } as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {t('goals.title')}
          </DialogTitle>
        </DialogHeader>

        {/* Existing goals + progress. */}
        {goals.length === 0 ? (
          <p className="py-2 text-sm" style={{ color: 'hsl(var(--text-muted))' }}>{t('goals.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {goals.map((g) => {
              const acc = accumulatedMinutes(g.label, g.period, present.slices, entries);
              const pct = g.targetMinutes > 0 ? Math.min(100, Math.round((acc / g.targetMinutes) * 100)) : 0;
              const done = acc >= g.targetMinutes;
              return (
                <li key={g.id}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
                        {g.label || t('goals.untitled')}
                      </span>
                      <span
                        className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px]"
                        style={{ backgroundColor: 'hsl(var(--muted) / 0.4)', color: 'hsl(var(--text-muted))' }}
                      >
                        {g.period === 'day' ? t('goals.periodDay') : t('goals.periodWeek')}
                      </span>
                      {done && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: '#16a34a' }} />}
                    </div>
                    <button
                      type="button"
                      aria-label={t('goals.delete')}
                      onClick={() => removeGoal(g.id)}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded transition-colors hover:bg-black/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" style={{ color: 'hsl(var(--text-muted))' }} />
                    </button>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'hsl(var(--muted) / 0.35)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: done ? '#16a34a' : 'hsl(var(--primary))' }}
                    />
                  </div>
                  <div className="mt-0.5 text-right text-[11px] tabular-nums" style={{ color: 'hsl(var(--text-muted))' }}>
                    {fmt(acc)} / {fmt(g.targetMinutes)} · {pct}%
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Add a goal. */}
        <div className="mt-1 flex flex-col gap-2 rounded-lg p-3" style={{ backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))' }}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            list="goal-labels"
            placeholder={t('goals.labelPlaceholder')}
            className="w-full rounded-md px-2 py-1.5 text-sm outline-none"
            style={numStyle}
          />
          <datalist id="goal-labels">
            {labelOptions.map((l) => <option key={l} value={l} />)}
          </datalist>
          <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: 'hsl(var(--foreground))' }}>
            <input type="number" min="0" max="24" value={hours} onChange={(e) => setHours(e.target.value)} className={numCls} style={numStyle} aria-label={t('goals.hoursLabel')} />
            <span>{t('goals.hUnit')}</span>
            <input type="number" min="0" max="59" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={numCls} style={numStyle} aria-label={t('goals.minutesLabel')} />
            <span>{t('goals.mUnit')}</span>
            <div className="ml-auto flex overflow-hidden rounded-md" style={{ border: '1px solid hsl(var(--border))' }}>
              {(['day', 'week'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className="px-2.5 py-1 text-xs transition-colors"
                  style={period === p
                    ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }
                    : { backgroundColor: 'transparent', color: 'hsl(var(--text-muted))' }}
                >
                  {p === 'day' ? t('goals.periodDay') : t('goals.periodWeek')}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={submit} className="gap-1.5" style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
            <Plus className="h-4 w-4" />
            {t('goals.add')}
          </Button>
        </div>

        <AdSlot slot="goals" className="mt-3" />
      </DialogContent>
    </Dialog>
  );
}
