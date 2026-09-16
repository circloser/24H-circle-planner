import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MAX_EVENT_CHARS, useEvents } from '@/hooks/useEvents';
import {
  DEFAULT_EVENT_COLOR, EVENT_COLORS, REPEATS, dayEvents, type DayEvent, type Repeat,
} from '@/lib/calendar-events';
import { monthCells, monthPair, partsOf, shiftMonth, thisMonth, todayKey, type YearMonth } from '@/lib/calendar-grid';
import type { CalendarBg } from '@/hooks/usePreferences';
import type { TKey } from '@/i18n/translations';

/** Chips drawn straight in a day cell; the rest hide behind “+n”. */
const MAX_CHIPS = 3;

const REPEAT_LABEL: Record<Repeat, TKey> = {
  none: 'calendar.repeatNone',
  daily: 'calendar.repeatDaily',
  weekly: 'calendar.repeatWeekly',
  monthly: 'calendar.repeatMonthly',
  yearly: 'calendar.repeatYearly',
};
const BG_LABEL: Record<CalendarBg, TKey> = {
  solid: 'calendar.bgSolid',
  soft: 'calendar.bgSoft',
  clear: 'calendar.bgClear',
};
/** Sunday reads red and Saturday blue, as Korean calendars do. */
const weekdayTone = (i: number) => (i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground');

/** One entry: all day fills the chip with its colour, a timed one gets a dot. */
function Chip({ ev }: { ev: DayEvent }) {
  const color = ev.color ?? DEFAULT_EVENT_COLOR;
  if (!ev.time) {
    return (
      <span data-event data-all-day className="truncate rounded px-1 text-[11px] leading-5 text-white" style={{ backgroundColor: color }}>
        {ev.text}
      </span>
    );
  }
  return (
    <span data-event className="flex items-center gap-1 overflow-hidden px-1 text-[11px] leading-5 text-foreground">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="shrink-0 tabular-nums text-muted-foreground">{ev.time}</span>
      <span className="truncate">{ev.text}</span>
    </span>
  );
}

/** One month: name, weekday header and six rows of days filling the height. */
function Month({ at, bg, onPick }: { at: YearMonth; bg: CalendarBg; onPick: (dateKey: string) => void }) {
  const { t, lang } = useTranslation();
  const { events } = useEvents();
  const [peek, setPeek] = useState<string | null>(null);
  const today = todayKey();
  const label = new Date(at.y, at.m, 1).toLocaleDateString(lang, { year: 'numeric', month: 'long' });
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + i).toLocaleDateString(lang, { weekday: 'short' }));
  const cellBg = bg === 'clear' ? 'bg-transparent' : bg === 'soft' ? 'bg-surface/55' : 'bg-surface';
  const gridBg = bg === 'solid' ? 'bg-border/60' : 'bg-border/30';

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" data-calendar-month={`${at.y}-${String(at.m + 1).padStart(2, '0')}`}>
      <h3 className="mb-1 text-center text-sm font-semibold text-foreground">{label}</h3>
      <div className="grid grid-cols-7">
        {weekdays.map((w, i) => (
          <div key={`${w}${i}`} className={`py-1 text-center text-[11px] font-medium ${weekdayTone(i)}`}>{w}</div>
        ))}
      </div>
      <div className={`grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-px rounded-lg border border-border ${gridBg}`}>
        {monthCells(at.y, at.m).map((cell, i) => {
          const list = dayEvents(events, cell.key);
          const hidden = Math.max(0, list.length - MAX_CHIPS);
          const expanded = peek === cell.key && hidden > 0;
          const number = (
            <span
              className={`mx-auto grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[11px] ${
                cell.key === today
                  ? 'bg-primary font-bold text-primary-foreground'
                  : `${weekdayTone(i % 7)} ${cell.inMonth ? '' : 'opacity-40'}`
              }`}
            >
              {cell.day}
            </span>
          );
          return (
            <div key={cell.key} className="relative min-h-0" onMouseEnter={() => setPeek(cell.key)} onMouseLeave={() => setPeek(null)}>
              <button
                type="button"
                data-day={cell.key}
                onClick={() => onPick(cell.key)}
                className={`flex h-full w-full min-h-0 flex-col gap-0.5 overflow-hidden p-1 text-left transition-colors hover:bg-accent/10 ${cellBg} ${cell.inMonth ? '' : 'opacity-70'}`}
              >
                {number}
                <span className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                  {list.slice(0, MAX_CHIPS).map((ev) => <Chip key={`${ev.from}-${ev.id}`} ev={ev} />)}
                  {hidden > 0 && (
                    <span className="px-1 text-[10px] text-muted-foreground">{t('calendar.more', { n: String(hidden) })}</span>
                  )}
                </span>
              </button>
              {/* Hovering a crowded day lifts the whole list above the grid. */}
              {expanded && (
                <div
                  data-day-peek
                  onClick={() => onPick(cell.key)}
                  className="absolute inset-x-0 bottom-0 z-40 flex max-h-[260px] cursor-pointer flex-col gap-0.5 overflow-auto rounded-lg border border-border bg-surface p-1 shadow-xl"
                >
                  {number}
                  {list.map((ev) => <Chip key={`${ev.from}-${ev.id}`} ev={ev} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Calendar mode: two months side by side filling the window (stacked on a
 * phone), one pair of arrows moving both, and a day editor for all-day or timed
 * plans that can repeat. Events live in their own synced store (useEvents).
 */
export function CalendarView() {
  const { t, lang } = useTranslation();
  const { prefs, setPreference } = usePreferences();
  const isMobile = useIsMobile();
  const { events, addEvent, removeEvent } = useEvents();
  const [at, setAt] = useState<YearMonth>(() => thisMonth());
  const [picked, setPicked] = useState<string | null>(null);
  const [draft, setDraft] = useState({ text: '', allDay: true, time: '09:00', color: DEFAULT_EVENT_COLOR as string, repeat: 'none' as Repeat });
  const [left, right] = monthPair(at);
  const bg: CalendarBg = prefs.calendarBg ?? 'solid';
  const dayList = picked ? dayEvents(events, picked) : [];

  const pickedLabel = picked
    ? (({ y, m, d }) => new Date(y, m, d).toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }))(partsOf(picked))
    : '';
  const submit = () => {
    if (!picked || !draft.text.trim()) return;
    addEvent(picked, {
      text: draft.text,
      time: draft.allDay ? null : draft.time,
      color: draft.color,
      repeat: draft.repeat,
    });
    setDraft((d) => ({ ...d, text: '' }));
  };
  const navBtn = 'grid h-9 w-9 place-items-center rounded-md border border-border transition-colors hover:bg-accent/10';
  const chip = (on: boolean) =>
    `rounded-md border px-2 py-1 text-xs transition-colors ${on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent/10'}`;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2" data-calendar-view>
      <div className="flex flex-wrap items-center justify-center gap-2">
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
        {/* How solid the grid sits on the app background. */}
        <span className="ml-2 flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{t('calendar.background')}</span>
          {(['solid', 'soft', 'clear'] as CalendarBg[]).map((mode) => (
            <button key={mode} type="button" data-cal-bg={mode} aria-pressed={bg === mode}
              onClick={() => setPreference('calendarBg', mode)} className={chip(bg === mode)}>
              {t(BG_LABEL[mode])}
            </button>
          ))}
        </span>
      </div>

      <div className={`flex min-h-0 flex-1 gap-3 ${isMobile ? 'flex-col overflow-y-auto' : 'flex-row'}`}>
        <Month at={left} bg={bg} onPick={setPicked} />
        <Month at={right} bg={bg} onPick={setPicked} />
      </div>

      <Dialog open={picked !== null} onOpenChange={(o) => { if (!o) { setPicked(null); setDraft((d) => ({ ...d, text: '' })); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{pickedLabel}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={draft.text}
              maxLength={MAX_EVENT_CHARS}
              onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
              placeholder={t('calendar.placeholder')}
              aria-label={t('calendar.placeholder')}
              data-event-input
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" data-all-day-on aria-pressed={draft.allDay} className={chip(draft.allDay)}
                onClick={() => setDraft((d) => ({ ...d, allDay: true }))}>
                {t('calendar.allDay')}
              </button>
              <button type="button" data-all-day-off aria-pressed={!draft.allDay} className={chip(!draft.allDay)}
                onClick={() => setDraft((d) => ({ ...d, allDay: false }))}>
                {t('calendar.atTime')}
              </button>
              {!draft.allDay && (
                <input type="time" value={draft.time} data-event-time aria-label={t('calendar.atTime')}
                  onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('calendar.color')}</span>
              {EVENT_COLORS.map((c) => (
                <button key={c} type="button" aria-label={c} data-event-color={c} aria-pressed={draft.color === c}
                  onClick={() => setDraft((d) => ({ ...d, color: c }))}
                  className="h-5 w-5 rounded-full border border-black/20"
                  style={{ backgroundColor: c, outline: draft.color === c ? '2px solid hsl(var(--primary))' : 'none', outlineOffset: '1px' }} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('calendar.repeat')}</span>
              <select value={draft.repeat} data-event-repeat aria-label={t('calendar.repeat')}
                onChange={(e) => setDraft((d) => ({ ...d, repeat: e.target.value as Repeat }))}
                className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground">
                {REPEATS.map((r) => <option key={r} value={r}>{t(REPEAT_LABEL[r])}</option>)}
              </select>
            </div>
            <Button onClick={submit} disabled={!draft.text.trim()} className="gap-1 bg-primary text-primary-foreground" data-event-add>
              <Plus className="h-4 w-4" />
              {t('calendar.add')}
            </Button>
          </div>

          <ul className="flex max-h-[34vh] flex-col gap-1 overflow-y-auto">
            {dayList.length === 0 && <li className="py-2 text-center text-sm text-muted-foreground">{t('calendar.none')}</li>}
            {dayList.map((ev) => (
              <li key={`${ev.from}-${ev.id}`} data-event-row className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                <span className="min-w-0 flex-1"><Chip ev={ev} /></span>
                {ev.repeat && ev.repeat !== 'none' && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">{t(REPEAT_LABEL[ev.repeat])}</span>
                )}
                <button type="button" aria-label={t('common.close')} data-event-del
                  onClick={() => removeEvent(ev.from, ev.id)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded transition-colors hover:bg-black/10">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">{t('calendar.seriesNote')}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
