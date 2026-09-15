import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MAX_EVENT_CHARS, useEvents } from '@/hooks/useEvents';
import { monthCells, monthPair, shiftMonth, thisMonth, todayKey, type YearMonth } from '@/lib/calendar-grid';

/** One month: its name, a weekday header and day cells carrying their events. */
function Month({ at, onPick }: { at: YearMonth; onPick: (dateKey: string) => void }) {
  const { lang } = useTranslation();
  const { events } = useEvents();
  const today = todayKey();
  const label = new Date(at.y, at.m, 1).toLocaleDateString(lang, { year: 'numeric', month: 'long' });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(lang, { weekday: 'short' }),
  );

  return (
    <section className="min-w-0 flex-1" data-calendar-month={`${at.y}-${String(at.m + 1).padStart(2, '0')}`}>
      <h3 className="mb-2 text-center text-sm font-semibold text-foreground">{label}</h3>
      <div className="grid grid-cols-7">
        {weekdays.map((w, i) => (
          <div key={`${w}${i}`} className={`py-1 text-center text-[11px] ${i === 0 ? 'text-red-500/80' : 'text-muted-foreground'}`}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border/60">
        {monthCells(at.y, at.m).map((cell, i) =>
          cell === null ? (
            <div key={`blank-${i}`} className="min-h-[74px] bg-surface/60" />
          ) : (
            <button
              key={cell.key}
              type="button"
              data-day={cell.key}
              onClick={() => onPick(cell.key)}
              className="min-h-[74px] bg-surface p-1 text-left align-top transition-colors hover:bg-accent/10"
            >
              <span
                className={`inline-grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[11px] ${
                  cell.key === today ? 'bg-primary font-bold text-primary-foreground' : 'text-foreground'
                }`}
              >
                {cell.day}
              </span>
              <span className="mt-0.5 flex flex-col gap-0.5">
                {(events[cell.key] ?? []).slice(0, 3).map((e) => (
                  <span key={e.id} data-event className="truncate rounded bg-accent/15 px-1 text-[10px] leading-4 text-foreground">
                    {e.text}
                  </span>
                ))}
                {(events[cell.key]?.length ?? 0) > 3 && (
                  <span className="px-1 text-[10px] text-muted-foreground">+{(events[cell.key]?.length ?? 0) - 3}</span>
                )}
              </span>
            </button>
          ),
        )}
      </div>
    </section>
  );
}

/**
 * Calendar mode: two months at once (stacked on a phone), moved together by the
 * arrows, with a day's events added and removed in a small dialog. Events live
 * in their own synced store (useEvents) — nothing here touches the timetable.
 */
export function CalendarView() {
  const { t, lang } = useTranslation();
  const isMobile = useIsMobile();
  const { events, addEvent, removeEvent } = useEvents();
  const [at, setAt] = useState<YearMonth>(() => thisMonth());
  const [picked, setPicked] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [left, right] = monthPair(at);
  const dayEvents = picked ? events[picked] ?? [] : [];

  const pickedLabel = picked
    ? new Date(Number(picked.slice(0, 4)), Number(picked.slice(5, 7)) - 1, Number(picked.slice(8, 10)))
      .toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
    : '';
  const submit = () => {
    if (!picked || !draft.trim()) return;
    addEvent(picked, draft);
    setDraft('');
  };
  const navBtn = 'grid h-9 w-9 place-items-center rounded-md border border-border transition-colors hover:bg-accent/10';

  return (
    <div className="flex w-full flex-col gap-3" data-calendar-view>
      {/* One set of arrows moves BOTH months. */}
      <div className="flex items-center justify-center gap-2">
        <button type="button" aria-label={t('calendar.prev')} title={t('calendar.prev')} data-cal-prev
          onClick={() => setAt((m) => shiftMonth(m, -1))} className={navBtn}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setAt(thisMonth())} data-cal-today
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent/10">
          <CalendarDays className="h-4 w-4" />
          {t('calendar.today')}
        </button>
        <button type="button" aria-label={t('calendar.next')} title={t('calendar.next')} data-cal-next
          onClick={() => setAt((m) => shiftMonth(m, 1))} className={navBtn}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className={isMobile ? 'flex flex-col gap-4' : 'flex flex-row gap-4'}>
        <Month at={left} onPick={setPicked} />
        <Month at={right} onPick={setPicked} />
      </div>

      <Dialog open={picked !== null} onOpenChange={(o) => { if (!o) { setPicked(null); setDraft(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{pickedLabel}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={draft}
              maxLength={MAX_EVENT_CHARS}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
              placeholder={t('calendar.placeholder')}
              aria-label={t('calendar.placeholder')}
              data-event-input
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
            <Button onClick={submit} disabled={!draft.trim()} className="gap-1 bg-primary text-primary-foreground" data-event-add>
              <Plus className="h-4 w-4" />
              {t('calendar.add')}
            </Button>
          </div>
          <ul className="flex max-h-[40vh] flex-col gap-1 overflow-y-auto">
            {dayEvents.length === 0 && <li className="py-2 text-center text-sm text-muted-foreground">{t('calendar.none')}</li>}
            {dayEvents.map((e) => (
              <li key={e.id} data-event-row className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                <span className="min-w-0 flex-1 break-words text-sm text-foreground">{e.text}</span>
                <button type="button" aria-label={t('common.close')} data-event-del
                  onClick={() => picked && removeEvent(picked, e.id)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded transition-colors hover:bg-black/10">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
