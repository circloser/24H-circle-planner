/**
 * Every memoir written, kept by date.
 *
 * A memoir is paid for, so writing a new one must never throw the old one
 * away. The life record keeps only the latest (`life.memoir`, which older
 * versions of the app read); this store keeps them all, newest last, and
 * travels with Pro sync like the 사주 readings do.
 */
import type { PersistedCodec } from '@/hooks/usePersistedState';

export const MEMOIRS_KEY = '24h-circle-planner.memoirs';
export const MAX_MEMOIRS = 20;
const MAX_TEXT = 40_000;

export interface MemoirEntry { text: string; createdAt: string }
export interface MemoirHistory { version: 1; items: MemoirEntry[] }

export const emptyMemoirs = (): MemoirHistory => ({ version: 1, items: [] });

/** Strict and byte-stable: fixed order, nothing empty written. */
export function decodeMemoirs(parsed: unknown): MemoirHistory | null {
  const p = parsed as Record<string, unknown> | null;
  if (!p || typeof p !== 'object' || p['version'] !== 1) return null;
  const seen = new Set<string>();
  const items = (Array.isArray(p['items']) ? p['items'] : []).flatMap((r) => {
    const o = r as Record<string, unknown> | null;
    const text = typeof o?.['text'] === 'string' ? o['text'].slice(0, MAX_TEXT).trim() : '';
    const createdAt = typeof o?.['createdAt'] === 'string' ? o['createdAt'] : '';
    if (!text || !createdAt || seen.has(createdAt)) return [];
    seen.add(createdAt);
    return [{ text, createdAt }];
  }).slice(-MAX_MEMOIRS);
  return { version: 1, items };
}

export const memoirsCodec: PersistedCodec<MemoirHistory> = {
  decode: decodeMemoirs,
  encode: (s) => decodeMemoirs(s) ?? emptyMemoirs(),
  fallback: emptyMemoirs,
};

/**
 * What to list, newest first. A memoir written before this store existed
 * lives only in the life record; it is shown too, so nothing already paid
 * for goes missing.
 */
export function memoirList(history: MemoirHistory, legacy: MemoirEntry | null): MemoirEntry[] {
  const items = [...history.items];
  if (legacy?.text && !items.some((m) => m.text === legacy.text)) {
    items.unshift({ text: legacy.text, createdAt: legacy.createdAt || '' });
  }
  return items.reverse();
}

/** Add a newly written memoir, keeping an older legacy one alongside it. */
export function addMemoir(history: MemoirHistory, entry: MemoirEntry, legacy: MemoirEntry | null): MemoirHistory {
  const items = history.items.length === 0 && legacy?.text && legacy.text !== entry.text
    ? [{ text: legacy.text, createdAt: legacy.createdAt || new Date(0).toISOString() }]
    : [...history.items];
  return { version: 1, items: [...items, entry].slice(-MAX_MEMOIRS) };
}
