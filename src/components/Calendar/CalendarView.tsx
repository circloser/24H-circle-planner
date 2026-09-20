import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CalendarCheck, ChevronLeft, ChevronRight, GripVertical, Lock, Pencil, Plus, Sparkles, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MAX_EVENT_CHARS, useEvents } from '@/hooks/useEvents';
import {
  DEFAULT_EVENT_COLOR, EVENT_COLORS, REPEATS, dayEvents, dragRange, laneRows, sortDayEvents, spanOf,
  type DayEvent, type Repeat,
} from '@/lib/calendar-events';
import { useIcalFeeds } from '@/hooks/useIcalFeed';
import { IcalConnect } from './IcalConnect';
import { DayDecorEditor, DecorLayer, DecorTray, type Armed, type DecorTool, type Picked } from './Decor';
import { TOOLS, TOOL_ICON } from './decor-tools';
import { requestUpgrade } from '@/lib/pro';
import { CALENDAR_REQUEST_EVENT, takeCalendarRequest } from '@/lib/calendar-requests';
import { useDecor } from '@/hooks/useDecor';
import { useAuth } from '@/hooks/useAuth';
import { monthKey, paperOf } from '@/lib/decor-layer';
import { track, trackOnce } from '@/lib/track';
import { loadPhoto } from '@/lib/calendar-photos';
import { CALENDAR_EXPORT_EVENT } from '@/lib/calendar-export';
import { CalendarExportDialog } from './CalendarExport';
import { COLOR_THEMES } from '@/data/color-themes';
import { loadPersisted } from '@/hooks/usePersistedState';
import { lifeCodec } from '@/hooks/useLife';
import { LIFE_KEY, type LifeCategory } from '@/lib/life';
import { lifeAnniversaries } from '@/lib/life-calendar';
import { relationBirthdays } from '@/lib/relation-calendar';
import { RELATION_KEY } from '@/lib/relation';
import { relationCodec } from '@/hooks/useRelation';
import { groupColors } from '@/components/Relation/groups';
import { categoryColors } from '@/components/Life/categories';
import { chipInk, shownColor, themeAccent } from '@/lib/calendar-theme';
import { MONTH_ROWS, WEEK_DAYS, addDays, homeOf, dayGap, monthCells, monthPair, partsOf, shiftMonth, thisMonth, todayKey, type YearMonth } from '@/lib/calendar-grid';

/** Cells in one month grid. */
const MONTH_CELLS = WEEK_DAYS * MONTH_ROWS;
import type { TKey } from '@/i18n/translations';

/** Fallback before the grid has been measured; the real number comes from how
 *  many lines actually fit in a cell (see useChipRoom). */
const MAX_CHIPS = 3;
/** One chip line plus the 1px gap under it. A phone uses the smaller type,
 *  which is also what lets more plans fit in the same cell. */
const LINE_H = 18;
const LINE_H_PHONE = 14;
/** Chip type in the month grid: small on a phone, a touch larger from `sm` up
 *  (a cell only has room for so much). */
const TYPE = 'text-[9px] leading-[13px] sm:text-[11px] sm:leading-[17px]';
/** Chip type in a list — the day's editor and the hover peek. There is room, so
 *  it reads at the app's normal size on every screen. */
const TYPE_ROW = 'text-sm leading-5';
/** A long title is simply cut at the edge — no "…", which would eat the very
 *  letters a short cell has room for — on every screen. */
const CLIP = 'overflow-hidden whitespace-nowrap text-clip';
/** The day number above the chips, plus the cell's own padding. */
const HEAD_H = 20;

const TOOL_ADD_LABEL: Record<DecorTool, TKey> = { sticker: 'decor.stickers', tape: 'decor.tapeShort', photo: 'decor.photoShort' };

const REPEAT_LABEL: Record<Repeat, TKey> = {
  none: 'calendar.repeatNone',
  daily: 'calendar.repeatDaily',
  weekly: 'calendar.repeatWeekly',
  monthly: 'calendar.repeatMonthly',
  yearly: 'calendar.repeatYearly',
};
/**
 * The grid lines, drawn as the cell's own inset shadow rather than as gaps
 * between cells: an inset shadow sits UNDER the cell's contents, so a bar that
 * runs to the edge covers the line and a span reads as one unbroken bar.
 */
function cellLines(i: number, lit: boolean): string {
  const line = 'hsl(var(--border))';
  const parts: string[] = [];
  if (i % 7 !== 6) parts.push(`inset -1px 0 0 ${line}`);
  if (i < MONTH_CELLS - 7) parts.push(`inset 0 -1px 0 ${line}`);
  if (lit) parts.push('inset 0 0 0 2px hsl(var(--primary))');
  return parts.join(', ');
}

/** A day from the neighbouring month sits on a darker ground (index.css
 *  sets how much darker per theme), so this month's days stand out. */
const OUTSIDE_BG = 'var(--cal-outside)';

/** The colour theme the calendar wears (a COLOR_THEMES id, or null). */
const LookContext = createContext<string | null>(null);

/** Sunday reads red and Saturday blue, as Korean calendars do. */
const weekdayTone = (i: number) => (i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground');

/** A drag in progress: painting a new span, or carrying an entry to another day. */
type Drag =
  | { kind: 'create'; from: string; over: string }
  | { kind: 'move'; from: string; over: string; ev: DayEvent };

/** The hollow outline of an imported bar — closed only on the days the span
 *  actually starts and ends on, so the days in between run straight through. */
function outline(color: string, ev: DayEvent): string {
  const sides = [`inset 0 1px 0 ${color}`, `inset 0 -1px 0 ${color}`];
  if (ev.index === 0) sides.push(`inset 1px 0 0 ${color}`);
  if (ev.index === ev.length - 1) sides.push(`inset -1px 0 0 ${color}`);
  return sides.join(', ');
}

/** One entry. All day fills the chip with its colour and a multi-day entry runs
 *  as one bar; a timed entry gets a dot and its clock time. */
function Chip({ ev, showText = true, inGrid = false }: { ev: DayEvent; showText?: boolean; inGrid?: boolean }) {
  const theme = useContext(LookContext);
  const raw = ev.color ?? DEFAULT_EVENT_COLOR;
  // A plan's stored colour is shown in the theme; an imported calendar keeps
  // its own tone, so the two never blur together.
  const color = ev.src ? raw : shownColor(raw, theme);
  const mid = ev.index > 0;
  const ends = ev.length === 1 ? 'rounded' : ev.index === 0 ? 'rounded-l' : ev.index === ev.length - 1 ? 'rounded-r' : '';
  // An imported entry is drawn hollow: it is someone else's, and read-only.
  const imported = !!ev.src;
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
        className={`block px-1 ${CLIP} ${inGrid ? TYPE : TYPE_ROW} ${imported ? 'text-foreground' : ''} ${ends} ${bleed}`}
        // Light theme colours need dark ink; the default ones keep white.
        style={imported ? { boxShadow: outline(color, ev) } : { backgroundColor: color, color: chipInk(color) }}
      >
        {mid && !showText ? ' ' : ev.text}
      </span>
    );
  }
  return (
    <span data-event data-imported={imported || undefined}
      className={`flex items-center gap-1 overflow-hidden px-1 ${inGrid ? TYPE : TYPE_ROW} text-foreground ${bleed}`}>
      <span className={`shrink-0 rounded-full ${inGrid ? 'h-1.5 w-1.5 sm:h-2 sm:w-2' : 'h-2 w-2'} ${imported ? 'border' : ''}`}
        style={imported ? { borderColor: color } : { backgroundColor: color }} />
      <span className={`min-w-0 flex-1 ${CLIP}`}>{ev.text}</span>
      {/* In a phone's narrow cell the title wins: the time would squeeze it to
          nothing, and the day's list still shows it. */}
      <span className={`shrink-0 tabular-nums text-muted-foreground ${inGrid ? 'hidden sm:inline' : ''}`}>{ev.time}</span>
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
  /** The decoration layer: taking the pointer (decorating), what is waiting
   *  to be placed, and what is selected. */
  decorating: boolean;
  armed: Armed | null;
  picked: Picked | null;
  onPick: (p: Picked | null) => void;
  onPlaced: (p: Picked) => void;
}

/** How many chip lines fit in one day cell right now — remeasured whenever the
 *  grid changes size, so a taller window simply shows more plans. */
function useChipRoom(grid: React.RefObject<HTMLDivElement | null>, lineH: number): number {
  const [room, setRoom] = useState(MAX_CHIPS);
  useEffect(() => {
    const el = grid.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // ResizeObserver fires once on observe, which is the first measurement.
    const ro = new ResizeObserver(() => {
      const rowH = el.clientHeight / MONTH_ROWS;
      setRoom(Math.max(1, Math.floor((rowH - HEAD_H) / lineH)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [grid, lineH]);
  return room;
}

/** A week's height on a phone, where the calendar scrolls instead of filling
 *  the window — every week the same, whether or not it holds anything. */
const PHONE_ROW_H = 72;

/** One month: name, weekday header and six rows of days filling the height. */
function Month({ at, imported, drag, onOpen, onDragStart, onDragOver, decorating, armed, picked, onPick, onPlaced }: MonthProps) {
  const isMobile = useIsMobile();
  const { t, lang } = useTranslation();
  const { events } = useEvents();
  const { decor } = useDecor();
  const accent = themeAccent(useContext(LookContext));
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
  const gridRef = useRef<HTMLDivElement>(null);
  const room = useChipRoom(gridRef, isMobile ? LINE_H_PHONE : LINE_H);
  const painting = drag?.kind === 'create' ? dragRange(drag.from, drag.over) : null;
  const inPaint = (key: string) =>
    !!painting && key >= painting.start && dayGap(painting.start, key) < painting.days;
  /** The day a carried plan would land on. */
  const dropOn = drag?.kind === 'move' ? drag.over : null;

  const month = monthKey(at.y, at.m);

  return (
    <section className={`flex min-w-0 flex-col ${isMobile ? 'shrink-0' : 'min-h-0 flex-1'}`}
      data-calendar-month={month}>
      <h3 className="mb-0.5 text-center text-xs font-semibold text-foreground">{label}</h3>
      <div className="grid grid-cols-7">
        {weekdays.map((w, i) => (
          <div key={`${w}${i}`} className={`py-0.5 text-center text-[10px] font-medium ${weekdayTone(i)}`}>{w}</div>
        ))}
      </div>
      {/* The decoration layer sits exactly over the grid, and measures itself
          by it — so whatever is placed there keeps its spot over the days. */}
      <div className={`relative ${isMobile ? '' : 'flex min-h-0 flex-1 flex-col'}`}>
      <div ref={gridRef}
        style={isMobile ? { gridTemplateRows: `repeat(${MONTH_ROWS}, ${PHONE_ROW_H}px)` } : undefined}
        className={`grid grid-cols-7 overflow-hidden rounded-lg border border-border bg-surface ${
          isMobile ? '' : 'min-h-0 flex-1 grid-rows-5'
        }`}>
        {cells.map((cell, i) => {
          const list = byDay[cell.key] ?? [];
          const lanes = weeks[Math.floor(i / 7)];
          const col = i % 7;
          const drawn = (n: number) => lanes.slice(0, n).map((lane) => lane[col]);
          // Everything fits, or one line is given up to say how many don't.
          let shown = drawn(room);
          let hidden = list.length - shown.filter(Boolean).length;
          if (hidden > 0 && room > 1) {
            shown = drawn(room - 1);
            hidden = list.length - shown.filter(Boolean).length;
          }
          const expanded = peek === cell.key && hidden > 0 && !drag;
          // The last days of a month that needed a sixth week are drawn only
          // here, at the head of this month: they carry their month's number.
          const carried = !cell.inMonth && i < WEEK_DAYS && homeOf(cell.key).m === at.m;
          const number = (
            <span
              className={`mx-auto grid h-4 min-w-[18px] place-items-center rounded-full px-1 text-[10px] ${
                cell.key === today
                  ? `font-bold ${accent ? '' : 'bg-primary text-primary-foreground'}`
                  : `${weekdayTone(i % 7)} ${cell.inMonth ? '' : carried ? 'opacity-80' : 'opacity-40'}`
              }`}
              style={cell.key === today && accent ? { backgroundColor: accent, color: chipInk(accent) } : undefined}
            >
              {carried ? `${partsOf(cell.key).m + 1}/${cell.day}` : cell.day}
            </span>
          );
          const deco = decor[cell.key];
          return (
            <div
              key={cell.key}
              data-decor-tint={deco?.t}
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
                data-outside={cell.inMonth ? undefined : ''}
                data-carried={carried || undefined}
                style={{
                  '--cell-bg': cell.inMonth ? 'hsl(var(--surface))' : OUTSIDE_BG,
                  boxShadow: cellLines(i, inPaint(cell.key) || cell.key === dropOn),
                  // A highlighter tint is mixed into the cell's own ground, so
                  // the plans on top keep their contrast in either theme.
                  ...(deco?.t ? { backgroundColor: `color-mix(in srgb, ${deco.t} 55%, var(--cell-bg))` } : {}),
                } as React.CSSProperties}
                className="flex h-full w-full min-h-0 select-none flex-col gap-px overflow-hidden bg-[var(--cell-bg)] p-0.5 text-left transition-colors hover:bg-accent/10"
              >
                {number}
                {/* The neighbouring month's plans stay readable but step back. */}
                <span className={`flex min-h-0 flex-col gap-px ${cell.inMonth ? '' : 'opacity-75'}`}>
                  {shown.map((ev, lane) => (!ev ? (
                    // An empty lane still holds its line, so the bars below it
                    // stay level with the same bars in the next day.
                    <span key={`gap${lane}`} className="h-[13px] shrink-0 sm:h-[17px]" aria-hidden />
                  ) : ev.src ? (
                    <Chip key={`${ev.from}-${ev.id}`} ev={ev} showText={false} inGrid />
                  ) : (
                    <Handle key={`${ev.from}-${ev.id}`} ev={ev} on={cell.key} onDragStart={onDragStart}>
                      <Chip ev={ev} showText={false} inGrid />
                    </Handle>
                  )))}
                  {hidden > 0 && (
                    <span className="px-1 text-[8px] leading-[13px] text-muted-foreground sm:text-[10px] sm:leading-[17px]">{t('calendar.more', { n: String(hidden) })}</span>
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
                  {list.map((ev) => (ev.src ? (
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
      <DecorLayer month={month} active={decorating} armed={armed} selected={picked} onSelect={onPick} onPlaced={onPlaced} />
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
  const { prefs } = usePreferences();
  const theme = COLOR_THEMES.some((th) => th.id === prefs.colorTheme) ? prefs.colorTheme : null;
  /** The theme's colour, which also tints the neighbouring months' days. */
  const tint = themeAccent(theme) ?? 'hsl(var(--primary))';
  const isPro = useAuth().plan === 'pro';
  const paper = paperOf(prefs.calendarPaper);
  const { layer, decor } = useDecor();
  /** The open decorating tool (the tray), what waits to be placed, and the
   *  item selected on the layer. */
  const [decorOn, setDecorOn] = useState(false);
  const [tool, setTool] = useState<DecorTool | null>(null);
  const [armed, setArmed] = useState<Armed | null>(null);
  const [chosen, setChosen] = useState<Picked | null>(null);
  // Only a Pro account decorates; a lapsed one simply stops.
  const decorating = isPro && decorOn;
  const chosenItem = chosen ? layer[chosen.month]?.find((i) => i.id === chosen.id) : undefined;
  const closeTray = () => { setTool(null); setArmed(null); setChosen(null); };
  /** 꾸미기 ⇄ 일정 편집. */
  const toggleDecorating = () => {
    if (!isPro) return requestUpgrade('decor');
    if (decorOn) closeTray();
    setDecorOn((v) => !v);
  };
  const pickTool = (k: DecorTool) => {
    setArmed(null);
    setTool((cur) => (cur === k ? null : k));
    if (tool !== k) track('decor_tool', { tool: k });
  };
  useEffect(() => { trackOnce('calendar_open'); }, []);
  const rootRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  // The header's 내보내기, while the calendar is showing.
  useEffect(() => {
    const open = () => setExporting(true);
    window.addEventListener(CALENDAR_EXPORT_EVENT, open);
    return () => window.removeEventListener(CALENDAR_EXPORT_EVENT, open);
  }, []);
  const { events, addEvent, updateEvent, moveEvent, skipOccurrence, endSeriesBefore, removeEvent, orderDay } = useEvents();
  const [at, setAt] = useState<YearMonth>(() => thisMonth());
  const [picked, setPicked] = useState<{ start: string; days: number } | null>(null);
  const [draft, setDraft] = useState({ text: '', allDay: true, time: '09:00', color: DEFAULT_EVENT_COLOR as string, repeat: 'none' as Repeat });
  /** Set while an existing entry is being edited (instead of adding a new one). */
  const [editing, setEditing] = useState<DayEvent | null>(null);
  /** Which repeating row is asking what to delete. */
  const [deleting, setDeleting] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  /** The day list as it looks mid-drag: [from, to] positions being swapped. */
  const [carry, setCarry] = useState<{ id: string; over: number } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [left, right] = monthPair(at);
  const feeds = useIcalFeeds();
  const [connecting, setConnecting] = useState(false);
  // Requests from the header menus (⚙ → 구글 캘린더, 디자인 → 캘린더 꾸미기),
  // including one made just before the calendar came on screen.
  useEffect(() => {
    const take = () => {
      const req = takeCalendarRequest();
      if (!req) return;
      if (req.kind === 'ical') setConnecting(true);
      else if (!isPro) requestUpgrade('decor');
      else { setDecorOn(true); setTool(req.tool); setArmed(null); }
    };
    take();
    window.addEventListener(CALENDAR_REQUEST_EVENT, take);
    return () => window.removeEventListener(CALENDAR_REQUEST_EVENT, take);
  }, [isPro]);
  // Only the two months on screen are expanded — the six-week grids overshoot
  // the months themselves, so the window runs from the first cell to the last.
  const importedDays = feeds.days;
  // Read-only entries from elsewhere: an imported calendar, and (unless it is
  // turned off) the birthdays and pinned anniversaries of the life line. The
  // life record is read once per visit — it is edited on its own page.
  const lifeRecord = useMemo(() => loadPersisted(LIFE_KEY, lifeCodec), []);
  // The relation map's birthdays ride the same switch: both are quiet
  // reminders from another page, and one person would not want one without
  // the other.
  const relationRecord = useMemo(() => loadPersisted(RELATION_KEY, relationCodec), []);
  const showLife = prefs.lifeInCalendar !== false;
  const imported = useMemo<Record<string, DayEvent[]>>(() => {
    const first = monthCells(left.y, left.m)[0].key;
    const last = monthCells(right.y, right.m)[MONTH_CELLS - 1].key;
    const feeds = importedDays(first, last);
    if (!showLife) return feeds;
    const cat = categoryColors(theme);
    const days = lifeAnniversaries(lifeRecord, first, last, {
      birthday: (who) => t('life.cal.birthday', { who }),
      years: (title, n) => t('life.cal.years', { title, n: String(n) }),
      me: t('life.cal.me'), mother: t('life.rel.mother'), father: t('life.rel.father'),
    }, { birth: cat.birth, family: cat.family, moment: (c) => cat[c as LifeCategory] ?? cat.other });
    const group = groupColors(theme);
    const born = relationBirthdays(relationRecord, first, last,
      (who, age) => (age === null
        ? t('life.cal.birthday', { who })
        : `${t('life.cal.birthday', { who })} ${t('relation.turning', { n: String(age) })}`),
      (g) => group[g]);
    const out: Record<string, DayEvent[]> = { ...feeds };
    for (const source of [days, born]) {
      for (const [key, list] of Object.entries(source)) out[key] = [...(out[key] ?? []), ...list];
    }
    return out;
  }, [importedDays, left.y, left.m, right.y, right.m, lifeRecord, relationRecord, showLife, theme, t]);
  const sorted = picked
    ? sortDayEvents([...dayEvents(events, picked.start), ...(imported[picked.start] ?? [])])
    : [];
  // While a row is carried it is shown where it would land, not where it is.
  const dayList = (() => {
    if (!carry) return sorted;
    const at = sorted.findIndex((e) => `${e.from}-${e.id}` === carry.id);
    if (at < 0) return sorted;
    const next = [...sorted];
    const [row] = next.splice(at, 1);
    next.splice(Math.max(0, Math.min(next.length, carry.over)), 0, row);
    return next;
  })();

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
      track('cal_plan_add', { kind: picked.days > 1 ? 'span' : draft.allDay ? 'allday' : 'timed' });
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

  const startCarry = (e: React.PointerEvent, rowKey: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const list = e.currentTarget.closest('ul');
    if (!list) return;
    const rows = () => [...list.querySelectorAll('[data-event-row]')] as HTMLElement[];
    const at = rows().findIndex((r) => r.contains(e.currentTarget as Node));
    setCarry({ id: rowKey, over: at });

    const move = (ev: PointerEvent) => {
      const boxes = rows().map((r) => r.getBoundingClientRect());
      let over = boxes.findIndex((b) => ev.clientY < b.top + b.height / 2);
      if (over < 0) over = boxes.length - 1;
      setCarry((c) => (c && c.over !== over ? { ...c, over } : c));
    };
    const done = () => {
      window.removeEventListener('pointermove', move);
      // The rows themselves are the record of where things ended up. Only the
      // user's own entries carry an order; imported ones are passengers.
      const order = rows()
        .filter((r) => r.dataset.rowSrc !== 'ical')
        .map((r) => ({ from: r.dataset.rowFrom ?? '', id: r.dataset.rowId ?? '' }))
        .filter((r) => r.from && r.id);
      if (order.length) orderDay(order);
      setCarry(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', done, { once: true });
    window.addEventListener('pointercancel', done, { once: true });
  };

  const monthLabel = (m: YearMonth) => new Date(m.y, m.m, 1).toLocaleDateString(lang, { year: 'numeric', month: 'long' });

  /** One month as an image, decorations and all (`scale` 1 = 1080 px wide). */
  const makeImage = async (m: YearMonth, scale: number): Promise<Blob> => {
    const root = rootRef.current;
    if (!root) throw new Error('calendar not mounted');
    const { renderCalendarImage, resolveColors } = await import('@/lib/export/calendarImage');
    const cells = monthCells(m.y, m.m);
    const fromImport = feeds.days(cells[0].key, cells[cells.length - 1].key);
    const byDay: Record<string, DayEvent[]> = {};
    const tints: Record<string, string> = {};
    for (const cell of cells) {
      const mine = dayEvents(events, cell.key);
      const all = fromImport[cell.key] ? sortDayEvents([...mine, ...fromImport[cell.key]]) : mine;
      if (all.length) byDay[cell.key] = all;
      const tone = decor[cell.key]?.t;
      if (tone) tints[cell.key] = tone;
    }
    const items = layer[monthKey(m.y, m.m)] ?? [];
    const photos: Record<string, HTMLImageElement | null> = {};
    await Promise.all(items.filter((i) => i.ph).map(async (i) => {
      const url = await loadPhoto(i.ph!);
      photos[i.ph!] = url ? await new Promise<HTMLImageElement | null>((done) => {
        const img = new Image();
        img.onload = () => done(img);
        img.onerror = () => done(null);
        img.src = url;
      }) : null;
    }));
    const colors = resolveColors(root, {
      background: 'hsl(var(--background))',
      surface: 'hsl(var(--surface))',
      outside: 'var(--cal-outside)',
      border: 'hsl(var(--border))',
      text: 'hsl(var(--text-primary))',
      muted: 'hsl(var(--text-muted))',
      accent: tint,
      paperInk: 'var(--paper-ink)',
      paperDot: 'var(--paper-dot)',
      paperKraft: 'var(--paper-kraft)',
      paperFleck: 'var(--paper-fleck)',
    });
    return renderCalendarImage({
      title: monthLabel(m),
      weekdays: Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + i).toLocaleDateString(lang, { weekday: 'short' })),
      cells,
      carried: new Set(cells.filter((c, i) => !c.inMonth && i < 7 && homeOf(c.key).m === m.m).map((c) => c.key)),
      byDay,
      tints,
      items,
      photos,
      paper,
      theme,
      today: todayKey(),
      colors,
      moreLabel: (n) => t('calendar.more', { n: String(n) }),
      footer: '24houring.com',
    }, scale);
  };

  const navBtn = 'grid h-8 w-8 place-items-center rounded-md border border-border transition-colors hover:bg-accent/10';
  const chip = (on: boolean) =>
    `rounded-md border px-2 py-1 text-xs transition-colors ${on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent/10'}`;
  const rowBtn = 'grid h-6 w-6 shrink-0 place-items-center rounded transition-colors hover:bg-black/10';

  return (
    <LookContext.Provider value={theme}>
    <div ref={rootRef} className="flex min-h-0 w-full flex-1 flex-col gap-1" data-calendar-view data-cal-look={theme ?? ''}
      data-paper={paper === 'none' ? undefined : paper}
      style={{ '--cal-tint': tint } as React.CSSProperties}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" aria-label={t('calendar.prev')} title={t('calendar.prev')} data-cal-prev
          onClick={() => setAt((m) => shiftMonth(m, -1))} className={navBtn}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setAt(thisMonth())} data-cal-today
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1 text-xs transition-colors hover:bg-accent/10">
          <CalendarDays className="h-4 w-4" />
          {t('calendar.today')}
        </button>
        <button type="button" aria-label={t('calendar.next')} title={t('calendar.next')} data-cal-next
          onClick={() => setAt((m) => shiftMonth(m, 1))} className={navBtn}>
          <ChevronRight className="h-4 w-4" />
        </button>
        {/* 꾸미기 ⇄ 일정 편집: decorating edits what is placed on the calendar,
            and brings up the three things that can be added. */}
        <button type="button" data-decor-toggle aria-pressed={decorating} onClick={toggleDecorating}
          title={decorating ? t('decor.toggleEdit') : t('decor.menu')}
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
            decorating ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90' : 'border-border text-foreground hover:bg-accent/10'
          }`}>
          {decorating ? <CalendarCheck className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
          {decorating ? t('decor.toggleEdit') : t('decor.menu')}
          {!isPro && <Lock className="h-3 w-3 opacity-60" aria-hidden />}
        </button>
        {decorating && (
          <span className="flex items-center gap-1" data-decor-addbar>
            {TOOLS.map((k) => {
              const Icon = TOOL_ICON[k];
              return (
                <button key={k} type="button" data-decor-add={k} aria-pressed={tool === k} onClick={() => pickTool(k)}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                    tool === k ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent/10'
                  }`}>
                  <Plus className="h-3 w-3" />
                  <Icon className="h-3.5 w-3.5" />
                  {t(TOOL_ADD_LABEL[k])}
                </button>
              );
            })}
          </span>
        )}
      </div>

      {decorating && (tool || chosenItem) && (
        <DecorTray
          tool={tool}
          armed={armed}
          onArm={setArmed}
          selected={chosen && chosenItem ? { month: chosen.month, item: chosenItem } : null}
          onClose={closeTray}
        />
      )}

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
            decorating={decorating}
            armed={armed}
            picked={chosen}
            onPick={setChosen}
            // A photo is one picture: once placed it is no longer waiting.
            onPlaced={(p) => { setChosen(p); if (armed?.k === 'photo') setArmed(null); }}
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
      <CalendarExportDialog
        open={exporting}
        onOpenChange={setExporting}
        months={[left, right]}
        label={monthLabel}
        keyOf={(m) => monthKey(m.y, m.m)}
        make={makeImage}
      />

      <Dialog open={picked !== null} onOpenChange={(o) => { if (!o) closeDay(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{pickedLabel}</DialogTitle>
          </DialogHeader>

          {/* The list simply grows with the day — no scroll box of its own. The
              dialog itself scrolls if a very full day outgrows the screen. */}
          <ul className="flex flex-col gap-1" data-day-list>
            {dayList.length === 0 && <li className="py-2 text-center text-sm text-muted-foreground">{t('calendar.none')}</li>}
            {dayList.map((ev, i) => {
              const rowKey = `${ev.from}-${ev.id}`;
              const repeating = !!ev.repeat && ev.repeat !== 'none';
              return (
                <li key={rowKey} data-event-row data-row-index={i}
                  data-row-from={ev.from} data-row-id={ev.id} data-row-src={ev.src ?? 'me'}
                  className={`flex flex-col gap-1 rounded-md border px-2 py-1.5 ${
                    carry?.id === rowKey ? 'border-primary bg-primary/5' : 'border-border'
                  }`}>
                  <div className="flex items-center gap-2">
                    {ev.src ? (
                      <span className="w-4 shrink-0" aria-hidden />
                    ) : (
                      <button type="button" data-row-handle aria-label={t('calendar.reorder')} title={t('calendar.reorder')}
                        onPointerDown={(e) => startCarry(e, rowKey)}
                        className="w-4 shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing">
                        <GripVertical className="h-4 w-4" />
                      </button>
                    )}
                    <span className="min-w-0 flex-1"><Chip ev={ev} /></span>
                    {repeating && <span className="shrink-0 text-xs text-muted-foreground">{t(REPEAT_LABEL[ev.repeat ?? 'none'])}</span>}
                    {ev.src ? (
                      <span className="shrink-0 text-xs text-muted-foreground" data-row-imported>{t('ical.readOnly')}</span>
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

          {picked && (
            <div className="border-t border-border pt-3">
              <DayDecorEditor day={picked.start} />
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-3" data-event-form>
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
                  style={{ backgroundColor: shownColor(c, theme), outline: draft.color === c ? '2px solid hsl(var(--primary))' : 'none', outlineOffset: '1px' }} />
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
            {editing && editing.repeat && editing.repeat !== 'none' && (
              <p className="text-[11px] text-muted-foreground" data-edit-scope>{t('calendar.editOccurrenceNote')}</p>
            )}
            <Button onClick={submit} disabled={!draft.text.trim()} className="gap-1 bg-primary text-primary-foreground" data-event-add>
              <Plus className="h-4 w-4" />
              {editing ? t('common.save') : t('calendar.add')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </LookContext.Provider>
  );
}
