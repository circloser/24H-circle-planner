import { useEffect, useState } from 'react';
import { Play, Square, X, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';
import { useRecords } from '@/hooks/useRecords';
import { hhmmToMinutes } from '@/lib/time-utils';
import { RecordRing } from './RecordRing';

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Real-time recording mode: log activities with Start/Stop (or manual times).
 * Only logged time fills the ring; gaps stay empty. Lives alongside the planner
 * as a separate view ('record').
 */
export function RecordView() {
  const { records, active, startLive, stopLive, cancelLive, addManual, removeRecord, clearToday } = useRecords();
  const { t } = useTranslation();

  const [label, setLabel] = useState('');
  const [mStart, setMStart] = useState('');
  const [mEnd, setMEnd] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const nowMin = now.getHours() * 60 + now.getMinutes();

  const durMin = (start: string, end: string) => (hhmmToMinutes(end) - hhmmToMinutes(start) + 1440) % 1440;
  const fmtDur = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? t('goals.hm', { h: String(h), m: String(m) }) : t('record.minOnly', { m: String(m) });
  };

  const elapsed = (() => {
    if (!active) return '';
    const s = Math.max(0, Math.floor((now.getTime() - active.startedAt) / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}:${pad2(m)}:${pad2(sec)}` : `${m}:${pad2(sec)}`;
  })();

  const inputStyle = { backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' } as const;

  function start() {
    if (!label.trim()) return;
    startLive(label.trim());
    setLabel('');
  }
  function add() {
    if (!label.trim() || !mStart || !mEnd) return;
    addManual(label.trim(), mStart, mEnd);
    setLabel('');
    setMStart('');
    setMEnd('');
  }

  return (
    <div className="flex w-full max-w-[720px] flex-col items-center gap-4">
      <div className="relative aspect-square w-full max-w-[560px]">
        <RecordRing records={records} active={active} nowMin={nowMin} />
      </div>

      {/* Controls. */}
      <div className="w-full rounded-xl p-3" style={{ backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))' }}>
        {active ? (
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full" style={{ backgroundColor: active.color }} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
              {t('record.recording')} · {active.label || t('record.untitled')}
            </span>
            <span className="shrink-0 tabular-nums text-sm" style={{ color: 'hsl(var(--text-muted))' }}>{elapsed}</span>
            <Button size="sm" onClick={stopLive} className="gap-1" style={{ backgroundColor: '#ef4444', color: '#fff' }}>
              <Square className="h-3.5 w-3.5" />{t('record.stop')}
            </Button>
            <button type="button" aria-label={t('record.cancel')} onClick={cancelLive} className="grid h-7 w-7 shrink-0 place-items-center rounded transition-colors hover:bg-black/10">
              <X className="h-4 w-4" style={{ color: 'hsl(var(--text-muted))' }} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') start(); }}
                placeholder={t('record.labelPlaceholder')}
                className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-sm outline-none"
                style={inputStyle}
              />
              <Button onClick={start} className="shrink-0 gap-1.5" style={{ backgroundColor: '#16a34a', color: '#fff' }}>
                <Play className="h-4 w-4" />{t('record.start')}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
              <span className="text-xs">{t('record.or')}</span>
              <input type="time" value={mStart} onChange={(e) => setMStart(e.target.value)} className="rounded-md px-2 py-1 text-sm outline-none" style={inputStyle} aria-label={t('record.startTime')} />
              <span>~</span>
              <input type="time" value={mEnd} onChange={(e) => setMEnd(e.target.value)} className="rounded-md px-2 py-1 text-sm outline-none" style={inputStyle} aria-label={t('record.endTime')} />
              <button type="button" onClick={add} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs" style={{ border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
                <Plus className="h-3.5 w-3.5" />{t('record.add')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Today's records. */}
      {records.length === 0 ? (
        <p className="text-sm" style={{ color: 'hsl(var(--text-muted))' }}>{t('record.empty')}</p>
      ) : (
        <ul className="flex w-full flex-col gap-1">
          {records.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ border: '1px solid hsl(var(--border))' }}>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'hsl(var(--foreground))' }}>{r.label || t('record.untitled')}</span>
              <span className="shrink-0 tabular-nums text-xs" style={{ color: 'hsl(var(--text-muted))' }}>{r.start}–{r.end} · {fmtDur(durMin(r.start, r.end))}</span>
              <button type="button" aria-label={t('record.delete')} onClick={() => removeRecord(r.id)} className="grid h-6 w-6 shrink-0 place-items-center rounded transition-colors hover:bg-black/10">
                <Trash2 className="h-3.5 w-3.5" style={{ color: 'hsl(var(--text-muted))' }} />
              </button>
            </li>
          ))}
          <li className="mt-1 flex justify-end">
            <button type="button" onClick={clearToday} className="text-xs underline" style={{ color: 'hsl(var(--text-muted))' }}>{t('record.clear')}</button>
          </li>
        </ul>
      )}
    </div>
  );
}
