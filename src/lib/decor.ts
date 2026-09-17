/**
 * Diary decorating (다꾸, Pro) — what a calendar day can be dressed with:
 * stickers stamped onto it and a highlighter tint behind it.
 *
 * Stickers are emoji: they render on every platform with no image assets, and a
 * day stays a few bytes in the synced store. Ids are stable short names so the
 * stored data does not depend on how an emoji happens to be encoded.
 */

export interface StickerGroup {
  id: 'mood' | 'weather' | 'life' | 'moment';
  items: ReadonlyArray<{ id: string; glyph: string }>;
}

export const STICKER_GROUPS: readonly StickerGroup[] = [
  {
    id: 'mood',
    items: [
      { id: 'smile', glyph: '😊' }, { id: 'laugh', glyph: '😆' }, { id: 'love', glyph: '🥰' },
      { id: 'party', glyph: '🥳' }, { id: 'calm', glyph: '😌' }, { id: 'tired', glyph: '😴' },
      { id: 'sad', glyph: '😢' }, { id: 'angry', glyph: '😤' }, { id: 'sick', glyph: '🤒' },
    ],
  },
  {
    id: 'weather',
    items: [
      { id: 'sun', glyph: '☀️' }, { id: 'partly', glyph: '⛅' }, { id: 'cloud', glyph: '☁️' },
      { id: 'rain', glyph: '🌧️' }, { id: 'storm', glyph: '⛈️' }, { id: 'snow', glyph: '❄️' },
      { id: 'rainbow', glyph: '🌈' },
    ],
  },
  {
    id: 'life',
    items: [
      { id: 'run', glyph: '🏃' }, { id: 'yoga', glyph: '🧘' }, { id: 'book', glyph: '📚' },
      { id: 'study', glyph: '✏️' }, { id: 'work', glyph: '💼' }, { id: 'coffee', glyph: '☕' },
      { id: 'meal', glyph: '🍽️' }, { id: 'cake', glyph: '🍰' }, { id: 'movie', glyph: '🎬' },
      { id: 'music', glyph: '🎧' }, { id: 'game', glyph: '🎮' }, { id: 'travel', glyph: '✈️' },
      { id: 'hospital', glyph: '🏥' }, { id: 'shopping', glyph: '🛍️' },
    ],
  },
  {
    id: 'moment',
    items: [
      { id: 'birthday', glyph: '🎂' }, { id: 'gift', glyph: '🎁' }, { id: 'flower', glyph: '💐' },
      { id: 'heart', glyph: '❤️' }, { id: 'star', glyph: '⭐' }, { id: 'sparkle', glyph: '✨' },
      { id: 'done', glyph: '✅' }, { id: 'pin', glyph: '📌' }, { id: 'fire', glyph: '🔥' },
      { id: 'clover', glyph: '🍀' },
    ],
  },
];

const GLYPH = new Map(STICKER_GROUPS.flatMap((g) => g.items.map((s) => [s.id, s.glyph] as const)));

export const stickerGlyph = (id: string): string | null => GLYPH.get(id) ?? null;
export const isSticker = (id: unknown): id is string => typeof id === 'string' && GLYPH.has(id);

/** Most stickers one day can hold — enough to decorate, not enough to bury it. */
export const MAX_STICKERS = 6;

/** Highlighter tints: soft enough that the day's plans stay readable on top. */
export const TINTS = ['#fef08a', '#fbcfe8', '#bfdbfe', '#bbf7d0', '#fed7aa', '#ddd6fe'] as const;
export type Tint = (typeof TINTS)[number];
export const isTint = (v: unknown): v is Tint => typeof v === 'string' && (TINTS as readonly string[]).includes(v);

export interface DayDecor {
  /** Sticker ids, in the order they were stamped. */
  s?: string[];
  /** Highlighter tint behind the whole day. */
  t?: Tint;
}

export type DecorByDate = Record<string, DayDecor>;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A stored day, cleaned: unknown stickers and tints are dropped, never trusted. */
export function cleanDay(raw: unknown): DayDecor | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out: DayDecor = {};
  const s = Array.isArray(o.s) ? o.s.filter(isSticker).slice(0, MAX_STICKERS) : [];
  if (s.length) out.s = s;
  if (isTint(o.t)) out.t = o.t;
  return out.s || out.t ? out : null;
}

export function cleanDecor(raw: unknown): DecorByDate | null {
  const p = raw as { version?: unknown; days?: unknown } | null;
  if (!p || p.version !== 1 || !p.days || typeof p.days !== 'object') return null;
  const out: DecorByDate = {};
  for (const [key, day] of Object.entries(p.days as Record<string, unknown>)) {
    if (!DAY_RE.test(key)) continue;
    const clean = cleanDay(day);
    if (clean) out[key] = clean;
  }
  return out;
}

/** Apply `fn` to one day; an empty result drops the day from the store. */
export function withDay(all: DecorByDate, key: string, fn: (day: DayDecor) => DayDecor): DecorByDate {
  const next = cleanDay(fn({ ...(all[key] ?? {}) }));
  const out = { ...all };
  if (next) out[key] = next;
  else delete out[key];
  return out;
}
