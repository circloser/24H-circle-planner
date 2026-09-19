/**
 * The calendar in the user's colour theme.
 *
 * A plan stores one of the six canonical EVENT_COLORS (blue, red, amber, green,
 * violet, slate). When a colour theme is chosen, each canonical colour is SHOWN
 * as the theme colour closest to it in hue — so switching themes recolours
 * every plan at once, while what is stored (and synced) never changes. A plan
 * given any other colour keeps it as-is.
 */
import { COLOR_THEMES } from '@/data/color-themes';
import { EVENT_COLORS } from './calendar-events';
import { idealTextColor } from './contrast';

interface Hsl { h: number; s: number; l: number }

function hsl(hex: string): Hsl | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Below this a colour reads as grey, whatever its nominal hue. */
const GREY = 0.18;

/**
 * The theme colour each canonical plan colour is shown in, in EVENT_COLORS
 * order. Each theme colour is used at most once while any are left; the grey
 * slot takes the least saturated colour, the others the nearest hue.
 */
export function themeSlots(colors: readonly string[]): string[] {
  return matchColors(EVENT_COLORS, colors);
}

/**
 * Each of `canon` shown as the closest colour of `colors` — the same matching
 * as themeSlots, for any set of canonical colours (the life timeline's
 * categories use it too).
 */
export function matchColors(canon: readonly string[], colors: readonly string[]): string[] {
  const pool = colors.map((c) => ({ c, hsl: hsl(c) })).filter((x): x is { c: string; hsl: Hsl } => !!x.hsl);
  if (!pool.length) return [...canon];
  const left = [...pool];
  const take = (pick: (xs: typeof left) => number) => {
    const from = left.length ? left : pool;
    const i = pick(from);
    const chosen = from[i];
    if (left.length) left.splice(i, 1);
    return chosen.c;
  };
  return canon.map((c) => {
    const want = hsl(c)!;
    if (want.s < GREY) {
      return take((xs) => xs.reduce((best, x, i) => (x.hsl.s < xs[best].hsl.s ? i : best), 0));
    }
    return take((xs) => xs.reduce((best, x, i) => {
      // Greys are a poor stand-in for a hue; only fall back to them when forced.
      const cost = (y: typeof x) => hueGap(y.hsl.h, want.h) + (y.hsl.s < GREY ? 360 : 0);
      return cost(x) < cost(xs[best]) ? i : best;
    }, 0));
  });
}

const slotCache = new Map<string, string[]>();

/** The chosen theme's slots, or null for the calendar's own colours. */
export function slotsFor(themeId: string | null | undefined): string[] | null {
  if (!themeId) return null;
  const hit = slotCache.get(themeId);
  if (hit) return hit;
  const theme = COLOR_THEMES.find((t) => t.id === themeId);
  if (!theme) return null;
  const slots = themeSlots(theme.colors);
  slotCache.set(themeId, slots);
  return slots;
}

/** How a stored plan colour is shown under the theme. */
export function shownColor(stored: string, themeId: string | null | undefined): string {
  const slots = slotsFor(themeId);
  if (!slots) return stored;
  const i = (EVENT_COLORS as readonly string[]).indexOf(stored.toLowerCase());
  return i < 0 ? stored : slots[i];
}

/** Ink that stays readable on a filled chip of this colour. */
export const chipInk = (fill: string): string => idealTextColor(fill);

/** How vivid a colour looks (max − min channel, 0..1). HSL saturation is no
 *  use here: a pale pastel can score near 1 on it. */
function chroma(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (Math.max(...ch) - Math.min(...ch)) / 255;
}

/**
 * The theme's accent — its most vivid colour — used for today's number, so
 * the grid itself carries the theme.
 */
export function themeAccent(themeId: string | null | undefined): string | null {
  const theme = themeId ? COLOR_THEMES.find((t) => t.id === themeId) : null;
  if (!theme || !theme.colors.length) return null;
  return theme.colors.reduce((best, c) => (chroma(c) > chroma(best) ? c : best));
}
