/**
 * Reading a Google Calendar iCal feed (RFC 5545), enough of it for a month view.
 *
 * Only what a personal calendar actually uses is handled: VEVENT with SUMMARY,
 * a date or date-time start/end, RRULE (FREQ/INTERVAL/COUNT/UNTIL/BYDAY),
 * EXDATE, RECURRENCE-ID overrides and STATUS:CANCELLED. Anything else is
 * ignored rather than guessed at.
 *
 * Time zones: a feed can stamp an event with any TZID, but converting one needs
 * the whole tz database. A UTC value ('…Z') is converted properly; a TZID or
 * floating value is read as the wall-clock time it says, which is right as long
 * as the calendar and the device agree — the usual case. Imported entries are
 * read-only, so a slip here never corrupts anything of the user's own.
 */
import { addDays, dateKey, dayGap, partsOf, weekdayOf } from './calendar-grid';
import { sortDayEvents, type DayEvent } from './calendar-events';

/** Imported chips are one muted colour: they are someone else's data. */
export const ICAL_COLOR = '#64748b';
/** Ceiling on occurrences expanded from one rule, so a broken feed cannot hang. */
const MAX_OCCURRENCES = 800;

export interface IcalEvent {
  uid: string;
  text: string;
  /** Local 'YYYY-MM-DD' the occurrence starts on. */
  start: string;
  /** 'HH:MM', or null for an all-day entry. */
  time: string | null;
  /** Days covered (1 = a single day). */
  days: number;
  rrule: string | null;
  /** Dates dropped from the rule (EXDATE). */
  exdates: string[];
  /** Set on an override: the date of the occurrence it replaces. */
  recurrenceId: string | null;
  cancelled: boolean;
}

/** An imported occurrence, shaped like any other day entry but read-only. */
export interface IcalDayEvent extends DayEvent {
  src: 'ical';
}

// ─── Text → properties ────────────────────────────────────────────────────────

/** Undo RFC 5545 line folding (a continuation line starts with space or tab). */
function unfold(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && out.length) out[out.length - 1] += raw.slice(1);
    else out.push(raw);
  }
  return out;
}

const unescapeText = (v: string) =>
  v.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** 'DTSTART;TZID=Asia/Seoul:20260916T093000' → name, params, value. */
function parseProp(line: string): Prop | null {
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...rest] = head.split(';');
  const params: Record<string, string> = {};
  for (const part of rest) {
    const eq = part.indexOf('=');
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value };
}

/** An iCal date or date-time → a local day key and clock time (null = all day). */
function parseWhen(prop: Prop): { key: string; time: string | null } | null {
  const v = prop.value.trim();
  const date = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (date) return { key: `${date[1]}-${date[2]}-${date[3]}`, time: null };
  const dt = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (!dt) return null;
  const [, y, m, d, hh, mm, , z] = dt;
  if (z === 'Z') {
    // A real instant: convert to the device's own clock.
    const at = new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm));
    return {
      key: dateKey(at.getFullYear(), at.getMonth(), at.getDate()),
      time: `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
    };
  }
  return { key: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}

/** Every VEVENT in a feed, in the order they appear. */
export function parseIcs(text: string): IcalEvent[] {
  const out: IcalEvent[] = [];
  let cur: Partial<IcalEvent> & { end?: { key: string; time: string | null } } | null = null;

  for (const line of unfold(text)) {
    if (line === 'BEGIN:VEVENT') { cur = { exdates: [] }; continue; }
    if (line === 'END:VEVENT') {
      if (cur?.start) {
        const allDay = cur.time == null;
        let days = 1;
        if (cur.end) {
          // DTEND is exclusive for a date, and a timed event may still run past
          // midnight; either way the span is the whole-day distance.
          const gap = dayGap(cur.start, cur.end.key);
          days = Math.max(1, allDay ? gap : gap + 1);
        }
        out.push({
          uid: cur.uid ?? `${cur.start}-${out.length}`,
          text: cur.text ?? '',
          start: cur.start,
          time: cur.time ?? null,
          days,
          rrule: cur.rrule ?? null,
          exdates: cur.exdates ?? [],
          recurrenceId: cur.recurrenceId ?? null,
          cancelled: cur.cancelled ?? false,
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;

    const prop = parseProp(line);
    if (!prop) continue;
    if (prop.name === 'UID') cur.uid = prop.value.trim();
    else if (prop.name === 'SUMMARY') cur.text = unescapeText(prop.value).trim();
    else if (prop.name === 'DTSTART') {
      const when = parseWhen(prop);
      if (when) { cur.start = when.key; cur.time = when.time; }
    } else if (prop.name === 'DTEND') {
      const when = parseWhen(prop);
      if (when) cur.end = when;
    } else if (prop.name === 'RRULE') cur.rrule = prop.value.trim();
    else if (prop.name === 'EXDATE') {
      for (const one of prop.value.split(',')) {
        const when = parseWhen({ ...prop, value: one });
        if (when) (cur.exdates ??= []).push(when.key);
      }
    } else if (prop.name === 'RECURRENCE-ID') {
      const when = parseWhen(prop);
      if (when) cur.recurrenceId = when.key;
    } else if (prop.name === 'STATUS') cur.cancelled = prop.value.trim().toUpperCase() === 'CANCELLED';
  }
  return out;
}

// ─── Rules → dates ────────────────────────────────────────────────────────────

interface Rule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count: number | null;
  until: string | null;
  /** Weekday numbers (0=Sun) for WEEKLY; for MONTHLY, with an ordinal. */
  byday: Array<{ day: number; nth: number | null }>;
}

const DAY_NUM: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export function parseRrule(rrule: string): Rule | null {
  const parts: Record<string, string> = {};
  for (const bit of rrule.split(';')) {
    const eq = bit.indexOf('=');
    if (eq > 0) parts[bit.slice(0, eq).toUpperCase()] = bit.slice(eq + 1);
  }
  const freq = (parts.FREQ ?? '').toUpperCase();
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') return null;
  const untilRaw = parts.UNTIL ? parseWhen({ name: 'UNTIL', params: {}, value: parts.UNTIL }) : null;
  const byday = (parts.BYDAY ?? '')
    .split(',')
    .map((code) => /^([+-]?\d)?([A-Z]{2})$/.exec(code.trim().toUpperCase()))
    .filter((m): m is RegExpExecArray => !!m && m[2] in DAY_NUM)
    .map((m) => ({ day: DAY_NUM[m[2]], nth: m[1] ? Number(m[1]) : null }));
  return {
    freq,
    interval: Math.max(1, Number(parts.INTERVAL ?? 1) || 1),
    count: parts.COUNT ? Number(parts.COUNT) : null,
    until: untilRaw?.key ?? null,
    byday,
  };
}

/** The date of the `nth` given weekday of a month (nth < 0 counts back). */
function nthWeekday(y: number, m: number, day: number, nth: number): string | null {
  const last = new Date(y, m + 1, 0).getDate();
  const hits: string[] = [];
  for (let d = 1; d <= last; d++) {
    if (new Date(y, m, d).getDay() === day) hits.push(dateKey(y, m, d));
  }
  const at = nth > 0 ? hits[nth - 1] : hits[hits.length + nth];
  return at ?? null;
}

/**
 * Start dates this event lands on between `from` and `to` (inclusive), the
 * one-off date when it does not repeat. EXDATEs are already removed.
 */
export function occurrenceStarts(ev: IcalEvent, from: string, to: string): string[] {
  const keep = (key: string) => !ev.exdates.includes(key);
  if (!ev.rrule) return ev.start <= to && ev.start >= addDays(from, -(ev.days - 1)) && keep(ev.start) ? [ev.start] : [];
  const rule = parseRrule(ev.rrule);
  if (!rule) return [];

  const out: string[] = [];
  const base = partsOf(ev.start);
  const startWeekday = weekdayOf(ev.start);
  // Never start before the event itself; a long span may begin before the window.
  const floor = addDays(from, -(ev.days - 1));
  let taken = 0;

  const offer = (key: string): boolean => {
    if (key < ev.start) return true;
    if (rule.until && key > rule.until) return false;
    taken++;
    if (rule.count != null && taken > rule.count) return false;
    if (key > to) return false;
    if (key >= floor && keep(key)) out.push(key);
    return true;
  };

  if (rule.freq === 'DAILY' || rule.freq === 'WEEKLY') {
    const days = rule.freq === 'WEEKLY'
      ? (rule.byday.length ? rule.byday.map((b) => b.day) : [startWeekday])
      : [];
    const step = rule.freq === 'DAILY' ? rule.interval : 1;
    let key = ev.start;
    for (let i = 0; i < MAX_OCCURRENCES && key <= to; i++, key = addDays(key, step)) {
      if (rule.freq === 'WEEKLY') {
        // Weeks advance by INTERVAL; days inside a chosen week all count.
        const week = Math.floor(dayGap(addDays(ev.start, -startWeekday), key) / 7);
        if (week % rule.interval !== 0 || !days.includes(weekdayOf(key))) continue;
      }
      if (!offer(key)) break;
    }
    return out;
  }

  const monthly = rule.freq === 'MONTHLY';
  const step = monthly ? rule.interval : rule.interval * 12;
  for (let i = 0; i < MAX_OCCURRENCES; i++) {
    const m = base.m + i * step;
    const y = base.y + Math.floor(m / 12);
    const month = ((m % 12) + 12) % 12;
    let key: string | null;
    if (monthly && rule.byday.length) {
      const b = rule.byday[0];
      key = nthWeekday(y, month, b.day, b.nth ?? 1);
    } else {
      // A monthly entry on the 31st skips the months without one, as Google does.
      const last = new Date(y, month + 1, 0).getDate();
      key = base.d > last ? null : dateKey(y, month, base.d);
    }
    if (key) {
      if (key > to) break;
      if (!offer(key)) break;
    }
  }
  return out;
}

// ─── Feed → days ──────────────────────────────────────────────────────────────

/**
 * Every imported occurrence between `from` and `to`, keyed by day and already
 * in display order. A VEVENT carrying RECURRENCE-ID replaces that one date of
 * its series; a cancelled one removes it.
 */
export function icalDays(events: IcalEvent[], from: string, to: string): Record<string, IcalDayEvent[]> {
  const overrides = new Map<string, IcalEvent>();
  for (const ev of events) {
    if (ev.recurrenceId) overrides.set(`${ev.uid}@${ev.recurrenceId}`, ev);
  }

  const byDay: Record<string, IcalDayEvent[]> = {};
  const put = (ev: IcalEvent, start: string) => {
    const length = Math.max(1, ev.days);
    for (let index = 0; index < length; index++) {
      const key = addDays(start, index);
      if (key < from || key > to) continue;
      (byDay[key] ??= []).push({
        id: `${ev.uid}@${start}`,
        text: ev.text,
        time: ev.time,
        color: ICAL_COLOR,
        from: start,
        start,
        index,
        length,
        src: 'ical',
      });
    }
  };

  for (const ev of events) {
    if (ev.cancelled || ev.recurrenceId) continue; // overrides are placed below
    for (const start of occurrenceStarts(ev, from, to)) {
      const over = overrides.get(`${ev.uid}@${start}`);
      if (over) { if (!over.cancelled) put(over, over.start); continue; }
      put(ev, start);
    }
  }
  // An override can also land outside its series' own window (moved to another
  // day), so place any that were never consumed above.
  for (const ev of overrides.values()) {
    if (ev.cancelled) continue;
    const placed = (byDay[ev.start] ?? []).some((x) => x.id === `${ev.uid}@${ev.start}`);
    if (!placed && ev.start >= addDays(from, -(ev.days - 1)) && ev.start <= to) put(ev, ev.start);
  }

  for (const key of Object.keys(byDay)) byDay[key] = sortDayEvents(byDay[key]) as IcalDayEvent[];
  return byDay;
}
