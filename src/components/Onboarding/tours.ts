/**
 * The tours of the pages that are not the timetable.
 *
 * The first tutorial was the timetable's, and on any other page it pointed at
 * things that were not there. Each page now has its own: a handful of steps,
 * each pointing at the real control on the screen, and — where it can be seen
 * from the outside — noticing when the reader has actually done it.
 *
 * A step is "done" by comparing the page's stored record with how it stood
 * when the step began (or by a control that only exists once it is used), so
 * nothing here reaches into the pages themselves.
 */
import { todayKey } from '@/lib/calendar-grid';
import { isPageView, type ChartView } from '@/lib/chart-view';
import type { TKey } from '@/i18n/translations';

export type TourId = 'chart' | 'calendar' | 'life' | 'relation' | 'place';

export interface Rect { top: number; left: number; width: number; height: number }

/** The stored records a step may be judged by, as they stood when it began. */
export type Snapshot = Record<string, string | null>;

export interface TourStep {
  name: TKey;
  body: TKey;
  target: () => Rect | null;
  /** Whether the reader has done it since `before` was taken. Left out for a
   *  step that only explains. */
  done?: (before: Snapshot) => boolean;
}

const EVENTS = '24h-circle-planner.events';
const LIFE = '24h-circle-planner.life';
const RELATION = '24h-circle-planner.relation';
const PLACE = '24h-circle-planner.place';
const WATCHED = [EVENTS, LIFE, RELATION, PLACE];

const read = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};

export const snapshot = (): Snapshot => Object.fromEntries(WATCHED.map((k) => [k, read(k)]));

/** How many of something a stored record holds, by a path into it. */
function countIn(raw: string | null, pick: (o: Record<string, unknown>) => unknown): number {
  try {
    const o = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    const v = o ? pick(o) : null;
    return Array.isArray(v) ? v.length : 0;
  } catch {
    return 0;
  }
}

const grew = (key: string, pick: (o: Record<string, unknown>) => unknown) => (before: Snapshot) =>
  countIn(read(key), pick) > countIn(before[key] ?? null, pick);

const changed = (key: string) => (before: Snapshot) => read(key) !== (before[key] ?? null);

/** The first element that matches, measured; null when there is none. */
export function rectOf(...selectors: string[]): Rect | null {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }
  return null;
}

const present = (selector: string) => () => document.querySelector(selector) !== null;

/** Every meeting written for anybody, added up. */
const meetings = (raw: string | null): number => {
  try {
    const o = raw ? (JSON.parse(raw) as { people?: { log?: unknown[] }[] }) : null;
    return (o?.people ?? []).reduce((n, p) => n + (Array.isArray(p.log) ? p.log.length : 0), 0);
  } catch {
    return 0;
  }
};

export const TOURS: Record<Exclude<TourId, 'chart'>, { title: TKey; steps: TourStep[] }> = {
  calendar: {
    title: 'tour.calendar.title',
    steps: [
      {
        name: 'tour.calendar.n1', body: 'tour.calendar.s1',
        target: () => rectOf(`[data-calendar-month] [data-day="${todayKey()}"]`, '[data-calendar-month]'),
        done: changed(EVENTS),
      },
      { name: 'tour.calendar.n2', body: 'tour.calendar.s2', target: () => rectOf('[data-cal-next]') },
      {
        name: 'tour.calendar.n3', body: 'tour.calendar.s3', target: () => rectOf('[data-decor-toggle]'),
        done: present('[data-decor-addbar], [data-decor-tray], [data-decor-editor]'),
      },
      { name: 'tour.calendar.n4', body: 'tour.calendar.s4', target: () => rectOf('[data-tour="design"]') },
      { name: 'tour.calendar.n5', body: 'tour.calendar.s5', target: () => rectOf('[data-tour="export"]') },
    ],
  },
  life: {
    title: 'tour.life.title',
    steps: [
      {
        name: 'tour.life.n1', body: 'tour.life.s1',
        target: () => rectOf('[data-life-birth-input]', '[data-life-column="me"] [data-life-birth]'),
        done: () => {
          try { return !!(JSON.parse(read(LIFE) ?? '{}') as { profile?: { birthDate?: string } }).profile?.birthDate; } catch { return false; }
        },
      },
      {
        name: 'tour.life.n2', body: 'tour.life.s2',
        // Until there is a birthday there is no line: everything after the
        // first step points back at where the line begins.
        target: () => rectOf('[data-life-column="me"] [data-life-today]', '[data-life-timeline]', '[data-life-onboarding]'),
        done: grew(LIFE, (o) => o['milestones']),
      },
      {
        name: 'tour.life.n3', body: 'tour.life.s3', target: () => rectOf('[data-life-line-add]', '[data-life-onboarding]'),
        done: grew(LIFE, (o) => o['others']),
      },
      { name: 'tour.life.n4', body: 'tour.life.s4', target: () => rectOf('[data-life-filter-fab]', '[data-life-onboarding]') },
      {
        name: 'tour.life.n5', body: 'tour.life.s5', target: () => rectOf('[data-life-ending]', '[data-life-onboarding]'),
        done: (before) => {
          const note = (raw: string | null) => {
            try { return JSON.stringify((JSON.parse(raw ?? '{}') as { endingNote?: unknown }).endingNote ?? null); } catch { return 'null'; }
          };
          return note(read(LIFE)) !== note(before[LIFE] ?? null);
        },
      },
      { name: 'tour.life.n6', body: 'tour.life.s6', target: () => rectOf('[data-tour="export"]') },
    ],
  },
  relation: {
    title: 'tour.relation.title',
    steps: [
      {
        name: 'tour.relation.n1', body: 'tour.relation.s1', target: () => rectOf('[data-relation-add]'),
        done: grew(RELATION, (o) => o['people']),
      },
      {
        name: 'tour.relation.n2', body: 'tour.relation.s2',
        target: () => rectOf('[data-relation-panel]', '[data-relation-canvas]'),
        done: present('[data-relation-panel]'),
      },
      {
        name: 'tour.relation.n3', body: 'tour.relation.s3',
        // The meetings are folded away on the card: point at the heading that
        // opens them until they are open.
        target: () => rectOf('[data-relation-log]', '[data-relation-fold-toggle="log"]', '[data-relation-canvas]'),
        done: (before) => meetings(read(RELATION)) > meetings(before[RELATION] ?? null),
      },
      {
        name: 'tour.relation.n4', body: 'tour.relation.s4',
        target: () => rectOf('[data-relation-link]', '[data-relation-canvas]'),
        done: grew(RELATION, (o) => o['links']),
      },
      {
        name: 'tour.relation.n5', body: 'tour.relation.s5', target: () => rectOf('[data-relation-filter-toggle]'),
        done: present('[data-relation-filters]'),
      },
    ],
  },
  place: {
    title: 'tour.place.title',
    steps: [
      {
        name: 'tour.place.n1', body: 'tour.place.s1', target: () => rectOf('[data-place-world]', '[data-place-pins]'),
        done: grew(PLACE, (o) => o['countries']),
      },
      {
        name: 'tour.place.n2', body: 'tour.place.s2', target: () => rectOf('[data-place-search-open]'),
        done: present('[data-place-search]'),
      },
      {
        name: 'tour.place.n3', body: 'tour.place.s3', target: () => rectOf('[data-place-zoom-in]'),
        done: present('[data-place-pins]'),
      },
      {
        name: 'tour.place.n4', body: 'tour.place.s4', target: () => rectOf('[data-place-pins]', '[data-place-world]'),
        done: grew(PLACE, (o) => o['pins']),
      },
      { name: 'tour.place.n5', body: 'tour.place.s5', target: () => rectOf('[data-place-corner]') },
    ],
  },
};

/** The tour for the page that is open. */
export function tourOf(view: ChartView): TourId {
  if (!isPageView(view)) return 'chart';
  return view as Exclude<TourId, 'chart'>;
}

/** Where a page's tour is remembered as offered, so it is offered once. */
export const tourOfferedKey = (tour: TourId) => `24h-tour-offered.${tour}`;
