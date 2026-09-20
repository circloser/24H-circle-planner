/**
 * What would bring someone back to their life line.
 *
 * The line is written once and then forgotten — it has no reason of its own to
 * be opened again. Two moments do have one:
 *
 *  - a plan is coming up (the trip, the move, the exam), and
 *  - the year is ending with nothing written in it.
 *
 * Both are decided here, on the device: the plans live in the person's own
 * record (encrypted when the diary lock is on), so the server neither knows
 * nor needs to know. The life button wears a quiet dot when one applies, and
 * the page says it in one line that can be closed.
 */
import { isPlanned, sortMilestones, type LifeData, type Milestone } from './life';
import { todayKey } from './calendar-grid';

export type LifeNudge =
  | { kind: 'plan'; key: string; moment: Milestone }
  | { kind: 'review'; key: string; year: number };

/** How near a plan has to be before it is worth mentioning. */
export const PLAN_SOON_DAYS = 60;
const SEEN_KEY = '24h-life-nudge-seen';

const yearOf = (date: string) => Number(date.slice(0, 4));
/** Days from `today` to a life date, counting an unknown month/day as its start. */
function daysUntil(date: string, today: string): number {
  const [y, m = '01', d = '01'] = date.split('-');
  const at = Date.UTC(Number(y), Number(m) - 1, Number(d));
  const [ty, tm, td] = today.split('-').map(Number);
  return Math.round((at - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

/**
 * The one thing worth saying today, or null. `seen` holds the keys already
 * closed, so nothing is said twice.
 */
export function lifeNudge(life: LifeData, opts: { today?: string; seen?: ReadonlySet<string> } = {}): LifeNudge | null {
  const today = opts.today ?? todayKey();
  const seen = opts.seen ?? new Set<string>();
  if (!life.profile.birthDate) return null;

  // The nearest plan inside the window, counted from today.
  const soon = sortMilestones(life.milestones)
    .filter((m) => isPlanned(m, today))
    .map((m) => ({ m, days: daysUntil(m.date, today) }))
    .filter(({ days }) => days >= 0 && days <= PLAN_SOON_DAYS)
    .sort((a, b) => a.days - b.days)[0];
  if (soon) {
    const key = `plan:${soon.m.id}:${yearOf(soon.m.date)}`;
    if (!seen.has(key)) return { kind: 'plan', key, moment: soon.m };
  }

  // December, and this year holds nothing yet: a year is easy to lose.
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  if (month === 12 && !life.milestones.some((m) => yearOf(m.date) === year && !isPlanned(m, today))) {
    const key = `review:${year}`;
    if (!seen.has(key)) return { kind: 'review', key, year };
  }
  return null;
}

/** Keys already closed (device-local, never synced). */
export function seenNudges(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

export function markNudgeSeen(key: string): void {
  try {
    const all = seenNudges();
    all.add(key);
    // Keep the list short: only the last 20 matter.
    localStorage.setItem(SEEN_KEY, JSON.stringify([...all].slice(-20)));
  } catch {
    /* storage unavailable — it will simply be offered again */
  }
}
