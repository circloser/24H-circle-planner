/**
 * Several lives, side by side.
 *
 * A life makes a different kind of sense next to the lives it was lived among.
 * The first attempt at this drew a chart of its own — thin lanes, dots and
 * labels — which answered the question and looked like nothing else in the
 * app. This does the plain thing instead: another life is drawn exactly the
 * way mine is, as its own line, standing next to it. One drawing, repeated,
 * which is what side by side means.
 *
 * So all this has to do is hand each column a life to draw, and say which
 * columns there is room for.
 */
import { DEFAULT_LIFE_EXPECTANCY as LIFE_YEARS, emptyLife, type LifeData, type LifeLine } from './life';

/** How many lines a narrow screen holds: mine, and one other. */
export const PHONE_LINES = 2;
/** And how far out it has to stand to hold them: a phone is one line wide, so
 *  two of them is the one case where it is not given the choice. */
export const PHONE_ZOOM = 0.62;
/** Below this the writing is too small to read, however many lines there are. */
export const MIN_BOARD_ZOOM = 0.45;
export const MAX_BOARD_ZOOM = 1.4;

export interface BoardLine {
  /** 'me', or the other line's own id. */
  id: string;
  name: string;
  mine: boolean;
  /** Read as a life of its own, so one drawing can draw them all. */
  life: LifeData;
}

/**
 * Somebody else's line as a life: a birth, a name, and what happened.
 *
 * The line is drawn from a day, and a record written by an older version (or
 * restored from a backup) may hold only a year — so what is missing is filled
 * in as the first of it, rather than drawing nothing at all.
 */
export function lineAsLife(line: LifeLine): LifeData {
  const [y, m, d] = line.birthDate.split('-');
  const born = y ? `${y}-${(m ?? '01').padStart(2, '0')}-${(d ?? '01').padStart(2, '0')}` : '';
  return {
    ...emptyLife(),
    profile: { birthDate: born, ...(line.name ? { name: line.name } : {}) },
    milestones: line.milestones,
  };
}

/**
 * The columns to draw, mine always first.
 *
 * `hidden` is who has been folded away for now — a way of looking, not a
 * change to the record. `max` is how many the screen can hold at all: when
 * there are more than that, `chosen` says which one other line is wanted, and
 * everybody else waits their turn.
 */
export function boardLines(life: LifeData, opts: {
  hidden?: ReadonlySet<string>;
  chosen?: string | null;
  max?: number;
} = {}): BoardLine[] {
  const { hidden, chosen = null, max = Infinity } = opts;
  const mine: BoardLine = { id: 'me', name: life.profile.name ?? '', mine: true, life };
  const others = (life.others ?? []).filter((o) => !hidden?.has(o.id));
  const room = Math.max(1, max) - 1;
  let shown = others;
  if (others.length > room) {
    const pick = others.find((o) => o.id === chosen);
    shown = (pick ? [pick, ...others.filter((o) => o !== pick)] : others).slice(0, room);
  }
  return [mine, ...shown.map((o) => ({ id: o.id, name: o.name, mine: false, life: lineAsLife(o) }))];
}

/**
 * The run of years the whole board is drawn against: from the earliest thing
 * on any line to the latest year any of them reaches.
 *
 * Without this each line would start at its own birth and the same year would
 * sit at a different height on each — which is the one thing reading two lives
 * side by side is for.
 */
export function boardSpan(lines: readonly BoardLine[], today: string): { from: number; to: number } {
  const year = (d: string) => Number(d.slice(0, 4));
  const births = lines.map((l) => year(l.life.profile.birthDate)).filter((y) => Number.isFinite(y) && y > 0);
  const moments = lines.flatMap((l) => l.life.milestones.map((m) => year(m.date))).filter((y) => Number.isFinite(y));
  const from = Math.min(...births, ...moments, year(today));
  const to = Math.max(...births.map((y) => y + LIFE_YEARS), ...moments, year(today));
  return { from, to };
}

/**
 * How far to zoom the board out so several lines fit across a screen.
 *
 * Two lines are drawn at their own size; past that each new line takes the
 * whole thing down a little, and nothing is ever drawn smaller than it can be
 * read at. The person can overrule it either way — this is only where it
 * starts.
 */
export const boardZoom = (lines: number): number =>
  Math.max(MIN_BOARD_ZOOM, Math.min(1, 2 / Math.max(1, lines)));
