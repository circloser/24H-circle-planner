/**
 * The calendar's decoration layer (다꾸, Pro): stickers, masking tape and photo
 * stickers placed FREELY on a month, on a layer above the grid.
 *
 * Positions are fractions of the month grid (0..1 across and down), and sizes
 * are fractions of its width, so a decoration stays over the same spot of the
 * same days however large the calendar is drawn — on a phone, a wide monitor,
 * or a window being resized.
 */
import { stickerGlyph, isSticker, TINTS } from './decor';
import { MONTH_ROWS, addDays, dayGap, homeOf, monthCells, nextMonthOf } from './calendar-grid';

export type ItemKind = 'sticker' | 'tape' | 'photo';

export const TAPE_PATTERNS = ['solid', 'stripe', 'dot', 'check', 'grid'] as const;
export type TapePattern = (typeof TAPE_PATTERNS)[number];
export const TAPE_COLORS = TINTS;

export interface LayerItem {
  id: string;
  k: ItemKind;
  /** Centre, as a fraction of the month grid (0..1). */
  x: number;
  y: number;
  /** Size multiplier (1 = the default for its kind). */
  s: number;
  /** Rotation in degrees. */
  r: number;
  /** sticker: its id. */
  g?: string;
  /** tape: pattern, colour and length (fraction of the grid's width). */
  p?: TapePattern;
  c?: string;
  w?: number;
  /** photo: the id of the picture, kept on the device that added it. */
  ph?: string;
}

/** Keyed by month, 'YYYY-MM'. */
export type LayerByMonth = Record<string, LayerItem[]>;

export const MAX_ITEMS = 40;
export const SCALE_MIN = 0.5;
export const SCALE_MAX = 3;
export const TAPE_MIN = 0.06;
export const TAPE_MAX = 1;
/** A tape starts one day wide. */
export const TAPE_DEFAULT = 1 / 7;

/** Paper textures for the calendar (drawn by index.css). */
export const CALENDAR_PAPERS = ['none', 'grid', 'lined', 'dot', 'kraft'] as const;
export type CalendarPaper = (typeof CALENDAR_PAPERS)[number];
export const paperOf = (v: unknown): CalendarPaper =>
  (CALENDAR_PAPERS as readonly unknown[]).includes(v) ? (v as CalendarPaper) : 'none';

const MONTH_RE = /^\d{4}-\d{2}$/;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export const monthKey = (y: number, m: number): string => `${y}-${String(m + 1).padStart(2, '0')}`;

export const newItemId = (): string => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** One stored item, cleaned — anything unknown or out of range is dropped or
 *  pulled back into range, never trusted. */
export function cleanItem(raw: unknown): LayerItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id) return null;
  const base = {
    id: o.id,
    x: clamp(num(o.x, 0.5), 0, 1),
    y: clamp(num(o.y, 0.5), 0, 1),
    s: clamp(num(o.s, 1), SCALE_MIN, SCALE_MAX),
    r: ((Math.round(num(o.r, 0)) % 360) + 360) % 360,
  };
  if (o.k === 'sticker') {
    return isSticker(o.g) ? { ...base, k: 'sticker', g: o.g } : null;
  }
  if (o.k === 'tape') {
    const p = (TAPE_PATTERNS as readonly unknown[]).includes(o.p) ? (o.p as TapePattern) : 'solid';
    const c = (TAPE_COLORS as readonly unknown[]).includes(o.c) ? (o.c as string) : TAPE_COLORS[0];
    return { ...base, k: 'tape', p, c, w: clamp(num(o.w, TAPE_DEFAULT), TAPE_MIN, TAPE_MAX) };
  }
  if (o.k === 'photo') {
    return typeof o.ph === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(o.ph) ? { ...base, k: 'photo', ph: o.ph } : null;
  }
  return null;
}

/**
 * Version 1 measured heights against a six-week grid; version 2 against the
 * five-week one. A v1 item keeps its week and its place within that week: in
 * the same month for the first five weeks, and in the next month's grid for
 * the sixth (whose days that grid now shows).
 */
export function fromSixWeeks(month: string, item: LayerItem): { month: string; item: LayerItem } {
  const [yy, mm] = month.split('-').map(Number);
  const rows = item.y * 6;
  const row = Math.min(5, Math.floor(rows));
  const within = rows - row;
  if (row < MONTH_ROWS) return { month, item: { ...item, y: (row + within) / MONTH_ROWS } };
  const week = addDays(monthCells(yy, mm - 1)[0].key, 7 * row);
  const next = nextMonthOf(yy, mm - 1);
  const at = dayGap(monthCells(next.y, next.m)[0].key, week) / 7;
  return { month: monthKey(next.y, next.m), item: { ...item, y: clamp((at + within) / MONTH_ROWS, 0, 1) } };
}

export const LAYER_VERSION = 2;

export function cleanLayer(raw: unknown): LayerByMonth | null {
  const p = raw as { version?: unknown; months?: unknown } | null;
  if (!p || (p.version !== 1 && p.version !== LAYER_VERSION) || !p.months || typeof p.months !== 'object') return null;
  const sixWeeks = p.version === 1;
  const buckets: Record<string, LayerItem[]> = {};
  for (const [key, list] of Object.entries(p.months as Record<string, unknown>)) {
    if (!MONTH_RE.test(key) || !Array.isArray(list)) continue;
    for (const raw of list) {
      const item = cleanItem(raw);
      if (!item) continue;
      const home = sixWeeks ? fromSixWeeks(key, item) : { month: key, item };
      (buckets[home.month] ??= []).push(home.item);
    }
  }
  const out: LayerByMonth = {};
  for (const [key, list] of Object.entries(buckets)) {
    const seen = new Set<string>();
    const items = list.filter((i) => !seen.has(i.id) && !!seen.add(i.id)).slice(0, MAX_ITEMS);
    if (items.length) out[key] = items;
  }
  return out;
}

/** Replace one month's items; an empty month drops out of the store. */
export function withMonth(all: LayerByMonth, key: string, fn: (items: LayerItem[]) => LayerItem[]): LayerByMonth {
  const next = fn([...(all[key] ?? [])]).slice(0, MAX_ITEMS);
  const out = { ...all };
  if (next.length) out[key] = next;
  else delete out[key];
  return out;
}

/**
 * Where a day's corner sits on its month's grid — used once, to move stickers
 * that were stamped onto days (before the free layer existed) onto the layer
 * at the same spot: the top-right of that day's cell.
 */
export function dayCorner(dayKey: string): { month: string; x: number; y: number } {
  const { y, m, index } = homeOf(dayKey);
  const col = index % 7;
  const row = Math.floor(index / 7);
  return { month: monthKey(y, m), x: (col + 0.8) / 7, y: (row + 0.18) / MONTH_ROWS };
}

/** Day stickers from the first version, as layer items (side by side). */
export function migrateDayStickers(days: Record<string, { s?: string[] }>): LayerByMonth {
  let out: LayerByMonth = {};
  for (const [day, deco] of Object.entries(days)) {
    const stickers = (deco.s ?? []).filter((id) => stickerGlyph(id));
    if (!stickers.length) continue;
    const corner = dayCorner(day);
    out = withMonth(out, corner.month, (items) => [
      ...items,
      ...stickers.map((g, i) => ({
        id: `m-${day}-${i}`,
        k: 'sticker' as const,
        g,
        x: clamp(corner.x - i * 0.03, 0, 1),
        y: corner.y,
        s: 0.8,
        r: 0,
      })),
    ]);
  }
  return out;
}

/** CSS background for a strip of masking tape. */
export function tapeBackground(p: TapePattern, c: string): string {
  const ink = 'rgba(255,255,255,0.55)';
  switch (p) {
    case 'stripe':
      return `repeating-linear-gradient(135deg, ${c} 0 6px, ${ink} 6px 10px)`;
    case 'dot':
      return `radial-gradient(${ink} 1.6px, transparent 1.8px) 0 0 / 8px 8px, ${c}`;
    case 'check':
      return `repeating-conic-gradient(${c} 0 25%, ${ink} 0 50%) 0 0 / 10px 10px`;
    case 'grid':
      return `linear-gradient(${ink} 1px, transparent 1px) 0 0 / 7px 7px, linear-gradient(90deg, ${ink} 1px, transparent 1px) 0 0 / 7px 7px, ${c}`;
    default:
      return c;
  }
}
