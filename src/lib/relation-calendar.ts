/**
 * The relation map seen from the month: everybody's birthday, drawn in the
 * calendar the way an imported calendar is — read-only, never editable there.
 *
 * It is worked out on the device from the person's own record; nothing is
 * fetched, and nothing about the map reaches the calendar's own store. The
 * same ⚙ switch that hides the life line's anniversaries hides these, because
 * they are the same kind of thing: a quiet reminder from another page.
 */
import type { DayEvent } from './calendar-events';
import { birthdayParts, type RelationData, type RelationGroup } from './relation';

const key = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Read-only chips for every birthday between `first` and `last` (date keys).
 * A birthday without a year still shows — only the age is left unsaid.
 */
export function relationBirthdays(
  data: RelationData,
  first: string,
  last: string,
  label: (who: string, age: number | null) => string,
  colorOf: (group: RelationGroup) => string,
): Record<string, DayEvent[]> {
  const out: Record<string, DayEvent[]> = {};
  const from = Number(first.slice(0, 4));
  const to = Number(last.slice(0, 4));
  if (!Number.isFinite(from) || !Number.isFinite(to)) return out;

  for (const person of data.people) {
    const b = birthdayParts(person.birthday);
    if (!b) continue;
    for (let year = from; year <= to; year++) {
      // 29 February falls back to the 28th in a year that has no 29th.
      const day = Math.min(b.d, new Date(year, b.m, 0).getDate());
      const at = key(year, b.m, day);
      if (at < first || at > last) continue;
      (out[at] ??= []).push({
        id: `rel-${person.id}-${year}`,
        text: label(person.name, b.y === null ? null : year - b.y),
        color: colorOf(person.group),
        from: at,
        start: at,
        index: 0,
        length: 1,
        src: 'life',
      });
    }
  }
  return out;
}
