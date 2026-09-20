/**
 * The life line seen from the month: birthdays and the anniversaries of the
 * moments pinned on the line, drawn in the calendar the way an imported
 * calendar is — read-only, never editable there.
 *
 * It is all worked out on the device from the person's own record; nothing is
 * fetched, and nothing about the life record reaches the calendar's store.
 */
import type { DayEvent } from './calendar-events';
import { isFullDate, partsOfLife, type LifeData } from './life';

/** The words the calendar puts on them (the caller translates). */
export interface AnniversaryLabels {
  /** A birthday: the person's own, or a parent's. */
  birthday: (who: string) => string;
  /** How many years since a moment ("{n}주년"); empty to show the title alone. */
  years: (title: string, n: number) => string;
  me: string;
  mother: string;
  father: string;
}

const key = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Read-only chips for every anniversary between `first` and `last` (date keys).
 * Only dates the calendar can place are used: a birthday needs the whole date,
 * a pinned moment at least a month and a day.
 */
export function lifeAnniversaries(
  life: LifeData,
  first: string,
  last: string,
  labels: AnniversaryLabels,
  colors: { birth: string; family: string; moment: (category: string) => string },
): Record<string, DayEvent[]> {
  const out: Record<string, DayEvent[]> = {};
  const from = Number(first.slice(0, 4));
  const to = Number(last.slice(0, 4));
  if (!Number.isFinite(from) || !Number.isFinite(to)) return out;

  const add = (id: string, at: string, text: string, color: string) => {
    if (at < first || at > last) return;
    (out[at] ??= []).push({
      id, text, color, from: at, start: at, index: 0, length: 1, src: 'life',
    });
  };

  const yearly = (id: string, date: string, text: (year: number) => string, color: string) => {
    const { y, m, d } = partsOfLife(date);
    if (!m || !d) return;
    for (let year = from; year <= to; year++) {
      // 29 February falls back to the 28th in a year that has no 29th.
      const day = Math.min(d, new Date(year, m, 0).getDate());
      add(`${id}-${year}`, key(year, m, day), text(year - y), color);
    }
  };

  const birth = life.profile.birthDate;
  if (isFullDate(birth)) {
    yearly('life-me', birth, () => labels.birthday(life.profile.name?.trim() || labels.me), colors.birth);
  }
  for (const rel of ['mother', 'father'] as const) {
    const f = life.family.find((m) => m.relation === rel);
    if (f?.birthDate && isFullDate(f.birthDate)) {
      yearly(`life-${rel}`, f.birthDate, () => labels.birthday(f.name?.trim() || labels[rel]), colors.family);
    }
  }
  for (const m of life.milestones) {
    if (!m.pinned || m.isPlan) continue;
    yearly(`life-${m.id}`, m.date, (n) => (n > 0 ? labels.years(m.title, n) : m.title), colors.moment(m.category));
  }
  return out;
}
