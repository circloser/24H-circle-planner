/**
 * Decorating the life line (다꾸, Pro): stickers, masking tape and photo
 * stickers laid over it.
 *
 * The calendar anchors a decoration to the month grid, which never changes
 * shape. A life line does: every new moment makes it longer. So each item is
 * anchored to a ROW — a moment, the birth card, a decade label, today — and
 * its place is a fraction of that row's box. Add a moment above it and the
 * sticker still sits on the same memory.
 */
import { cleanItem, type LayerItem } from './decor-layer';

/** Items keyed by the row they belong to (a moment id, 'birth', 'today', 'd1990'). */
export type LifeDecor = Record<string, LayerItem[]>;

export const LIFE_DECOR_KEY = '24h-circle-planner.life-decor';
/** Per row — a whole line can hold plenty; one row should not become a heap. */
export const MAX_PER_ROW = 12;
export const LIFE_DECOR_VERSION = 1;

const ROW_RE = /^[A-Za-z0-9:_-]{1,64}$/;

/** Strict decode: unknown rows and broken items are dropped, never thrown on. */
export function cleanLifeDecor(raw: unknown): LifeDecor | null {
  const p = raw as { version?: number; rows?: unknown } | null;
  if (!p || p.version !== LIFE_DECOR_VERSION || !p.rows || typeof p.rows !== 'object') return null;
  const out: LifeDecor = {};
  for (const [row, list] of Object.entries(p.rows as Record<string, unknown>)) {
    if (!ROW_RE.test(row) || !Array.isArray(list)) continue;
    const kept = list.map(cleanItem).filter((i): i is LayerItem => i !== null).slice(0, MAX_PER_ROW);
    if (kept.length) out[row] = kept;
  }
  return out;
}

export const encodeLifeDecor = (rows: LifeDecor) => ({ version: LIFE_DECOR_VERSION, rows });

/** Apply `fn` to one row; an empty row leaves the record entirely. */
export function withRow(all: LifeDecor, row: string, fn: (items: LayerItem[]) => LayerItem[]): LifeDecor {
  const next = fn(all[row] ?? []);
  const out = { ...all };
  if (next.length) out[row] = next;
  else delete out[row];
  return out;
}

/** Decorations of rows that no longer exist (a deleted moment) are dropped. */
export function pruneLifeDecor(all: LifeDecor, rows: ReadonlySet<string>): LifeDecor {
  const out: LifeDecor = {};
  for (const [row, items] of Object.entries(all)) if (rows.has(row)) out[row] = items;
  return out;
}

/** Every photo the decorations point at (for backups and clean-up). */
export const decorPhotoIds = (all: LifeDecor): string[] =>
  Object.values(all).flat().map((i) => i.ph).filter((p): p is string => !!p);
