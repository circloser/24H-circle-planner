/**
 * Several lives, read side by side.
 *
 * One line down the page is a life; two or three beside it are a generation.
 * The point of putting them together is the crossings — the year one person
 * started school and another left a country — so the one thing that must be
 * true is that a year is at the same height on every line. Everything here
 * exists to keep that true.
 *
 * The shape is worked out as plain numbers, with no canvas and no DOM, so the
 * drawing has nothing to decide and a test can check the arithmetic.
 */
import {
  DEFAULT_LIFE_EXPECTANCY, MAX_LIFE_LINES, isFullDate, partsOfLife,
  type LifeData, type LifeLine, type Milestone,
} from './life';
import { todayKey } from './calendar-grid';

/** Pixels a year is worth, at rest. */
export const YEAR_PX = 26;
/** How far in and out the years may be stretched. */
export const MIN_SPAN = 0.25;
export const MAX_SPAN = 6;
/** Space above the first year and below the last. */
export const EDGE_PX = 28;

export interface ParallelMoment {
  milestone: Milestone;
  /** Where it sits down the page, in pixels from the top. */
  y: number;
  /** The year it happened, and how old this person was in it. */
  year: number;
  age: number | null;
}

export interface ParallelLine {
  id: string;
  name: string;
  /** Mine is the first line and is never hidden or deleted. */
  mine: boolean;
  birthDate: string;
  /** Where the line begins and ends down the page, in pixels. */
  from: number;
  to: number;
  /** Where today falls on it, or null for someone born after today. */
  now: number | null;
  moments: ParallelMoment[];
}

export interface ParallelChart {
  /** The first and last year any line touches. */
  first: number;
  last: number;
  /** How tall the whole chart is, in pixels. */
  height: number;
  /** Where each of these years sits down the page. */
  ticks: Array<{ year: number; y: number; decade: boolean }>;
  lines: ParallelLine[];
  /** Where today is, on the shared scale. */
  today: number;
}

/** A year as a fraction: 2010-07-02 is a little past the middle of 2010. */
export function yearAt(date: string): number {
  const p = partsOfLife(date);
  if (!p) return 0;
  const month = p.m ?? 1;
  const day = p.d ?? 1;
  // Near enough: a month is a twelfth, a day a three-hundred-and-sixty-fifth.
  return p.y + (month - 1) / 12 + (day - 1) / 365;
}

/** How many whole years old somebody was on a date, or null if unknowable. */
export function ageAtYear(birth: string, when: string): number | null {
  if (!birth || !when) return null;
  const age = Math.floor(yearAt(when) - yearAt(birth));
  return age >= 0 ? age : null;
}

/** Everybody who could be drawn: me first, then the others, in their order. */
export function linesOf(life: LifeData): Array<{ line: LifeLine; mine: boolean }> {
  const mine: LifeLine = {
    id: 'me',
    name: life.profile.name ?? '',
    birthDate: life.profile.birthDate,
    milestones: life.milestones,
  };
  const rest = (life.others ?? []).map((line) => ({ line, mine: false }));
  return [{ line: mine, mine: true }, ...rest].slice(0, MAX_LIFE_LINES);
}

export interface ChartOptions {
  /** 1 is a year to YEAR_PX; more is closer in. */
  span?: number;
  today?: string;
  /** Ids folded away for now. Mine can never be one of them. */
  hidden?: ReadonlySet<string>;
}

/**
 * The whole picture: which years are on the page, where each line starts and
 * stops, and where every moment falls.
 *
 * One scale for everyone — that is the whole point — so the years run from
 * the earliest birth to the latest of (a hundred and twenty years after the
 * earliest birth, today, the last moment anybody recorded).
 */
export function buildParallel(life: LifeData, opts: ChartOptions = {}): ParallelChart {
  const today = opts.today ?? todayKey();
  const span = Math.min(MAX_SPAN, Math.max(MIN_SPAN, opts.span ?? 1));
  const hidden = opts.hidden ?? new Set<string>();

  const shown = linesOf(life)
    .filter(({ line, mine }) => (mine || !hidden.has(line.id)) && isLifeStart(line.birthDate))
    .map(({ line, mine }) => ({ line, mine }));
  if (!shown.length) {
    return { first: 0, last: 0, height: EDGE_PX * 2, ticks: [], lines: [], today: EDGE_PX };
  }

  const births = shown.map(({ line }) => yearAt(line.birthDate));
  const moments = shown.flatMap(({ line }) => line.milestones.map((m) => yearAt(m.date)));
  const first = Math.floor(Math.min(...births));
  const last = Math.ceil(Math.max(
    first + DEFAULT_LIFE_EXPECTANCY,
    yearAt(today),
    ...moments,
  ));

  const step = YEAR_PX * span;
  const at = (year: number) => EDGE_PX + (year - first) * step;
  const height = at(last) + EDGE_PX;

  // A label every year when there is room, every five or ten when there is
  // not: the same ladder whatever the zoom, so it never turns into a smear.
  const every = step >= 22 ? 1 : step >= 8 ? 5 : step >= 3 ? 10 : 25;
  const ticks: ParallelChart['ticks'] = [];
  for (let year = Math.ceil(first / every) * every; year <= last; year += every) {
    ticks.push({ year, y: at(year), decade: year % 10 === 0 });
  }

  const lines = shown.map(({ line, mine }): ParallelLine => {
    const born = yearAt(line.birthDate);
    const end = Math.min(last, born + DEFAULT_LIFE_EXPECTANCY);
    const nowYear = yearAt(today);
    return {
      id: line.id,
      name: line.name,
      mine,
      birthDate: line.birthDate,
      from: at(born),
      to: at(end),
      now: nowYear >= born ? at(Math.min(nowYear, end)) : null,
      moments: [...line.milestones]
        .sort((a, b) => yearAt(a.date) - yearAt(b.date))
        .map((milestone) => {
          const year = yearAt(milestone.date);
          return {
            milestone,
            y: at(year),
            year: Math.floor(year),
            age: ageAtYear(line.birthDate, milestone.date),
          };
        }),
    };
  });

  return { first, last, height, ticks, lines, today: at(yearAt(today)) };
}

/** A line needs a birthday to be drawn against the years at all. */
const isLifeStart = (date: string): boolean => !!date && (isFullDate(date) || !!partsOfLife(date));

/**
 * Where a label can go without landing on the one above it.
 *
 * Moments crowd: three things in one year is one dot on top of another. The
 * dots stay where the years put them — moving those would be a lie — and the
 * labels are nudged down just far enough to be read, in order, which is what
 * a hand drawing this would do.
 */
export function stackLabels(ys: readonly number[], least = 16): number[] {
  const out: number[] = [];
  let last = -Infinity;
  for (const y of ys) {
    const placed = Math.max(y, last + least);
    out.push(placed);
    last = placed;
  }
  return out;
}

/** The years a moment and a life have in common, for the crossing lines. */
export const sharedYears = (a: ParallelLine, b: ParallelLine): [number, number] | null => {
  const from = Math.max(a.from, b.from);
  const to = Math.min(a.to, b.to);
  return from < to ? [from, to] : null;
};
