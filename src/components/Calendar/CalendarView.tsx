import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Link, Pencil, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MAX_EVENT_CHARS, useEvents } from '@/hooks/useEvents';
import {
  DEFAULT_EVENT_COLOR, EVENT_COLORS, REPEATS, dayEvents, dragRange, laneRows, sortDayEvents, spanOf,
  type DayEvent, type Repeat,
} from '@/lib/calendar-events';
import { useIcalFeeds } from '@/hooks/useIcalFeed';
import { IcalConnect } from './IcalConnect';
import { MONTH_ROWS, addDays, dayGap, monthCells, monthPair, partsOf, shiftMonth, thisMonth, todayKey, type YearMonth } from '@/lib/calendar-grid';

/** Cells in one six-week month grid. */
const MONTH_CELLS = 42;
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
/** Sunday reads red and Saturday blue, as Korean calendars do. */
const weekdayTone = (i: number) => (i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground');

/** A drag in progress: painting a new span, or carrying an entry to another day. */
type Drag =
  | { kind: 'create'; from: string; over: string }
  | { kind: 'move'; from: string; over: string; ev: DayEvent };

/** One entry. All day fills the chip with its colour and a multi-day entry runs
 *  as one bar; a timed entry gets a dot and its clock time. */
function Chip({ ev, showText = true, inGrid = false }: { ev: DayEvent; showText?: boolean; inGrid?: boolean }) {
  const color = ev.color ?? DEFAULT_EVENT_COLOR;
  const mid = ev.index > 0;
  const ends = ev.length === 1 ? 'rounded' : ev.index === 0 ? 'rounded-l' : ev.index === ev.length - 1 ? 'rounded-r' : '';
  // An imported entry is drawn hollow: it is someone else's, and read-only.
  const imported = ev.src === 'ical';
  // Bleed over the cell's padding on the sides the span continues on; the cell
  // clips at its padding edge, so the bar meets the grid line either way.
  const bleed = inGrid
    ? `${ev.index > 0 ? '-ml-1' : ''} ${ev.index < ev.length - 1 ? '-mr-1' : ''}`
    : '';
  if (!ev.time) {
    return (
      <span
        data-event
        data-all-day
        data-imported={imported || undefined}
        data-span={ev.length > 1 ? (mid ? 'mid' : 'start') : undefined}
        className={`block truncate px-1 text-[11px] leading-5 ${imported ? 'text-foreground' : 'text-white'} ${ends} ${bleed}`}
        style={imported
          ? { boxShadow: `inset 0 0 0 1px ${color}`, borderLeft: `3px solid ${color}` }
          : { backgroundColor: color }}
      >
        {mid && !showText ? ' ' : ev.text}
      </span>
    );
  }
  return (
    <span data-event data-imported={imported || undefined}
      className={`flex items-center gap-1 overflow-hidden px-1 text-[11px] leading-5 text-foreground ${bleed}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${imported ? 'border-2' : ''}`}
        style={imported ? { borderColor: color } : { backgroundColor: color }} />
      <span className="shrink-0 tabular-nums text-muted-foreground">{ev.time}</span>
      <span className="truncate">{ev.text}</span>
    </span>
  );
}

/** Wraps a chip so it can be picked up and carried to another day. */
function Handle({ ev, on, onDragStart, children }: {
  ev: DayEvent; on: string; onDragStart: (d: Drag) => void; children: React.ReactNode;
}) {
  return (
    <span
      data-drag-handle
      className="block min-w-0 cursor-grab active:cursor-grabbing"
      onPointerDown={(e) => { e.stopPropagation(); if (e.button === 0) onDragStart({ kind: 'move', from: on, over: on, ev }); }}
    >
      {children}
    </span>
  );
}

interface MonthProps {
  at: YearMonth;
  /** Read-only entries pulled from a connected feed, keyed by day. */
  imported: Record<string, DayEvent[]>;
  drag: Drag | null;
  onOpen: (start: string, days: number) => void;
  onDragStart: (d: Drag) => void;
  onDragOver: (key: string) => void;
}

/** One month: name, weekday header and six rows of days filling the height. */
function Month({ at, imported, drag, onOpen, onDragStart, onDragOver }: MonthProps) {
  const { t, lang } = useTranslation();
  const { events } = useEvents();
  const [peek, setPeek] = useState<string | null>(null);
  const today = todayKey();
  const label = new Date(at.y, at.m, 1).toLocaleDateString(lang, { year: 'numeric', month: 'long' });
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + i).toLocaleDateString(lang, { weekday: 'short' }));
  const cells = useMemo(() => monthCells(at.y, at.m), [at.y, at.m]);
  const byDay = useMemo(() => {
    const out: Record<string, DayEvent[]> = {};
    for (const cell of cells) {
      const mine = dayEvents(events, cell.key);
      const all = imported[cell.key] ? sortDayEvents([...mine, ...imported[cell.key]]) : mine;
      if (all.length) out[cell.key] = all;
    }
    return out;
  }, [cells, events, imported]);
  /** One lane table per week: lanes[week][lane][weekday]. */
  const weeks = useMemo(
    () => Array.from({ length: MONTH_ROWS }, (_, r) => laneRows(cells.slice(r * 7, r * 7 + 7).map((c) => c.key), byDay)),
    [cells, byDay],
  );
  const painting = drag?.kind === 'create' ? dragRange(drag.from, drag.over) : null;
  const inPaint = (key: string) =>
    !!painting && key >= painting.start && dayGap(painting.start, key) < painting.days;
  /** The day a carried plan would land on. */
  const dropOn = drag?.kind === 'move' ? drag.over : null;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" data-calendar-month={`${at.y}-${String(at.m + 1).padStart(2, '0')}`}>
      <h3 className="mb-1 text-center text-sm font-semibold text-foreground">{label}</h3>
      <div className="grid grid-cols-7">
        {weekdays.map((w, i) => (
          <div key={`${w}${i}`} className={`py-1 text-center text-[11px] font-medium ${weekdayTone(i)}`}>{w}</div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-px rounded-lg border border-border bg-border/60">
        {cells.map((cell, i) => {
          const list = byDay[cell.key] ?? [];
          const lanes = weeks[Math.floor(i / 7)];
          const col = i % 7;
          const shown = lanes.slice(0, MAX_CHIPS).map((lane) => lane[col]);
          const hidden = list.length - shown.filter(Boolean).length;
          const expanded = peek === cell.key && hidden > 0 && !drag;
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
            <div
              key={cell.key}
              className="relative min-h-0"
              onMouseEnter={() => setPeek(cell.key)}
              onMouseLeave={() => setPeek(null)}
              onPointerEnter={() => onDragOver(cell.key)}
            >
              <button
                type="button"
                data-day={cell.key}
                onPointerDown={(e) => { if (e.button === 0) onDragStart({ kind: 'create', from: cell.key, over: cell.key }); }}
                // Keyboard activation only: a mouse click is handled by the drag.
                onClick={(e) => { if (e.detail === 0) onOpen(cell.key, 1); }}
                className={`flex h-full w-full min-h-0 select-none flex-col gap-0.5 overflow-hidden bg-surface p-1 text-left transition-colors hover:bg-accent/10 ${
                  inPaint(cell.key) || cell.key === dropOn ? 'ring-2 ring-inset ring-primary' : ''
                } ${cell.inMonth ? '' : 'opacity-70'}`}
              >
                {number}
                <span className="flex min-h-0 flex-col gap-0.5">
                  {shown.map((ev, lane) => (!ev ? (
                    // An empty lane still holds its line, so the bars below it
                    // stay level with the same bars in the next day.
                    <span key={`gap${lane}`} className="h-5 shrink-0" aria-hidden />
                  ) : ev.src === 'ical' ? (
                    <Chip key={`${ev.from}-${ev.id}`} ev={ev} showText={false} inGrid />
                  ) : (
                    <Handle key={`${ev.from}-${ev.id}`} ev={ev} on={cell.key} onDragStart={onDragStart}>
                      <Chip ev={ev} showText={false} inGrid />
                    </Handle>
                  )))}
                  {hidden > 0 && (
                    <span className="px-1 text-[10px] text-muted-foreground">{t('calendar.more', { n: String(hidden) })}</span>
                  )}
                </span>
              </button>
              {/* Hovering a crowded day opens the full list from the cell's middle. */}
              {expanded && (
                <div
                  data-day-peek
                  onClick={() => onOpen(cell.key, 1)}
                  className="absolute left-1/2 top-1/2 z-40 flex w-[max(100%,180px)] max-h-[60vh] -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col gap-0.5 overflow-auto rounded-lg border border-border bg-surface p-1 shadow-xl"
                >
                  {number}
                  {list.map((ev) => (ev.src === 'ical' ? (
                    <Chip key={`${ev.from}-${ev.id}`} ev={ev} />
                  ) : (
                    <Handle key={`${ev.from}-${ev.id}`} ev={ev} on={cell.key} onDragStart={onDragStart}>
                      <Chip ev={ev} />
                    </Handle>
                  )))}
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
 * Calendar mode: two months filling the window (stacked on a phone), one pair of
 * arrows moving both, drag across days to block out a span, drag an entry to
 * another day, and a day editor for all-day or timed plans that can repeat.
 * Events live in their own synced store (useEvents).
 */
export function CalendarView() {
  const { t, lang } = useTranslation();
  const isMobile = useIsMobile();
  const { events, addEvent, updateEvent, moveEvent, skipOccurrence, endSeriesBefore, removeEvent } = useEvents();
  const [at, setAt] = useState<YearMonth>(() => thisMonth());
  const [picked, setPicked] = useState<{ start: string; days: number } | null>(null);
  const [draft, setDraft] = useState({ text: '', allDay: true, time: '09:00', color: DEFAULT_EVENT_COLOR as string, repeat: 'none' as Repeat });
  /** Set while an existing entry is being edited (instead of adding a new one). */
  const [editing, setEditing] = useState<DayEvent | null>(null);
  /** Which repeating row is asking what to delete. */
  const [deleting, setDeleting] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [left, right] = monthPair(at);
  const feeds = useIcalFeeds();
  const [connecting, setConnecting] = useState(false);
  // Only the two months on screen are expanded — the six-week grids overshoot
  // the months themselves, so the window runs from the first cell to the last.
  const importedDays = feeds.days;
  const imported = useMemo(() => {
    const first = monthCells(left.y, left.m)[0].key;
    const last = monthCells(right.y, right.m)[MONTH_CELLS - 1].key;
    return importedDays(first, last);
  }, [importedDays, left.y, left.m, right.y, right.m]);
  const dayList = picked
    ? sortDayEvents([...dayEvents(events, picked.start), ...(imported[picked.start] ?? [])])
    : [];

  const blankDraft = { text: '', allDay: true, time: '09:00', color: DEFAULT_EVENT_COLOR as string, repeat: 'none' as Repeat };
  const openDay = (start: string, days: number) => {
    setPicked({ start, days });
    setEditing(null);
    setDeleting(null);
    setDraft(blankDraft);
  };
  const closeDay = () => {
    setPicked(null);
    setEditing(null);
    setDeleting(null);
    setDraft(blankDraft);
  };
  const startEdit = (ev: DayEvent) => {
    setEditing(ev);
    setDeleting(null);
    setDraft({
      text: ev.text,
      allDay: !ev.time,
      time: ev.time ?? '09:00',
      color: ev.color ?? DEFAULT_EVENT_COLOR,
      repeat: ev.repeat ?? 'none',
    });
  };

  // While a plan is being carried, a copy of it follows the pointer — the peek
  // closes as soon as the drag starts, so this is what the eye follows.
  useEffect(() => {
    if (drag?.kind !== 'move') return; // the ghost only renders during a move anyway
    const track = (e: PointerEvent) => setGhost({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', track);
    return () => window.removeEventListener('pointermove', track);
  }, [drag]);

  // A drag ends wherever the pointer is released, inside the grid or not.
  useEffect(() => {
    if (!drag) return;
    const finish = () => {
      setDrag(null);
      if (drag.kind === 'create') {
        const { start, days } = dragRange(drag.from, drag.over);
        openDay(start, days);
        return;
      }
      const delta = dayGap(drag.from, drag.over);
      // Released on the same day: that was a click on the chip, not a move.
      if (delta === 0) openDay(drag.from, 1);
      else moveEvent(drag.ev.from, drag.ev.id, addDays(drag.ev.from, delta));
    };
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', () => setDrag(null), { once: true });
    return () => window.removeEventListener('pointerup', finish);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  const fmtDay = (key: string, withYear = true) => {
    const { y, m, d } = partsOf(key);
    return new Date(y, m, d).toLocaleDateString(lang, {
      ...(withYear ? { year: 'numeric' } : {}), month: 'long', day: 'numeric', weekday: 'short',
    });
  };
  const pickedLabel = !picked
    ? ''
    : picked.days > 1
      ? `${fmtDay(picked.start)} ~ ${fmtDay(addDays(picked.start, picked.days - 1), false)}`
      : fmtDay(picked.start);

  const submit = () => {
    if (!picked || !draft.text.trim()) return;
    const values = {
      text: draft.text,
      time: draft.allDay ? null : draft.time,
      color: draft.color,
      repeat: draft.repeat,
    };
    if (!editing) {
      addEvent(picked.start, { ...values, days: picked.days });
      setDraft((d) => ({ ...d, text: '' }));
      return;
    }
    // Editing one occurrence of a repeat: drop that day from the series and
    // file the edited copy on its own, so the rest of the series is untouched.
    if (editing.repeat && editing.repeat !== 'none' && editing.start !== editing.from) {
      skipOccurrence(editing.from, editing.id, editing.start);
      addEvent(editing.start, { ...values, repeat: 'none', days: spanOf(editing) });
    } else {
      updateEvent(editing.from, editing.id, { ...values, days: spanOf(editing) });
    }
    setEditing(null);
    setDraft((d) => ({ ...d, text: '' }));
  };

  const navBtn = 'grid h-9 w-9 place-items-center rounded-md border border-border transition-colors hover:bg-accent/10';
  const chip = (on: boolean) =>
    `rounded-md border px-2 py-1 text-xs transition-colors ${on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent/10'}`;
  const rowBtn = 'grid h-6 w-6 shrink-0 place-items-center rounded transition-colors hover:bg-black/10';

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
        <button type="button" data-ical-open onClick={() => setConnecting(true)}
          aria-label={t('ical.title')} title={t('ical.title')}
          className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors hover:bg-accent/10 ${
            feeds.calendars.length ? 'border-primary text-foreground' : 'border-border text-muted-foreground'
          }`}>
          <Link className="h-3.5 w-3.5" />
          {t('ical.button')}
          {feeds.calendars.length > 1 && <span className="tabular-nums">{feeds.calendars.length}</span>}
        </button>
      </div>

      <div className={`flex min-h-0 flex-1 gap-3 ${isMobile ? 'flex-col overflow-y-auto' : 'flex-row'}`}>
        {[left, right].map((month) => (
          <Month
            key={`${month.y}-${month.m}`}
            at={month}
            imported={imported}
            drag={drag}
            onOpen={openDay}
            onDragStart={setDrag}
            onDragOver={(key) => setDrag((d) => (d ? { ...d, over: key } : d))}
          />
        ))}
      </div>

      {drag?.kind === 'move' && ghost && (
        <div data-drag-ghost className="pointer-events-none fixed z-50 w-36 opacity-90"
          style={{ left: ghost.x + 10, top: ghost.y + 10 }}>
          <Chip ev={drag.ev} />
        </div>
      )}

      <IcalConnect feeds={feeds} open={connecting} onOpenChange={setConnecting} />

      <Dialog open={picked !== null} onOpenChange={(o) => { if (!o) closeDay(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{pickedLabel}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            {picked && picked.days > 1 && (
              <span className="text-xs text-muted-foreground" data-span-days>{t('calendar.spanDays', { n: String(picked.days) })}</span>
            )}
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
              {editing ? t('common.save') : t('calendar.add')}
            </Button>
            {editing && editing.repeat && editing.repeat !== 'none' && (
              <p className="text-[11px] text-muted-foreground" data-edit-scope>{t('calendar.editOccurrenceNote')}</p>
            )}
          </div>

          <ul className="flex max-h-[32vh] flex-col gap-1 overflow-y-auto">
            {dayList.length === 0 && <li className="py-2 text-center text-sm text-muted-foreground">{t('calendar.none')}</li>}
            {dayList.map((ev) => {
              const rowKey = `${ev.from}-${ev.id}`;
              const repeating = !!ev.repeat && ev.repeat !== 'none';
              return (
                <li key={rowKey} data-event-row className="flex flex-col gap-1 rounded-md border border-border px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1"><Chip ev={ev} /></span>
                    {repeating && <span className="shrink-0 text-[10px] text-muted-foreground">{t(REPEAT_LABEL[ev.repeat ?? 'none'])}</span>}
                    {ev.src === 'ical' ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground" data-row-imported>{t('ical.readOnly')}</span>
                    ) : (
                      <>
                        <button type="button" aria-label={t('calendar.editPlan')} data-event-edit className={rowBtn} onClick={() => startEdit(ev)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button type="button" aria-label={t('common.close')} data-event-del className={rowBtn}
                          onClick={() => (repeating ? setDeleting(deleting === rowKey ? null : rowKey) : removeEvent(ev.from, ev.id))}>
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </>
                    )}
                  </div>
                  {/* A repeat asks how much to remove. */}
                  {repeating && deleting === rowKey && (
                    <div className="flex flex-wrap gap-1.5" data-delete-scope>
                      <button type="button" className={chip(false)} data-del-one
                        onClick={() => { skipOccurrence(ev.from, ev.id, ev.start); setDeleting(null); }}>
                        {t('calendar.scopeOne')}
                      </button>
                      <button type="button" className={chip(false)} data-del-future
                        onClick={() => { endSeriesBefore(ev.from, ev.id, ev.start); setDeleting(null); }}>
                        {t('calendar.scopeFuture')}
                      </button>
                      <button type="button" className={chip(false)} data-del-all
                        onClick={() => { removeEvent(ev.from, ev.id); setDeleting(null); }}>
                        {t('calendar.scopeAll')}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
