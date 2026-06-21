/**
 * Pick a readable text colour (near-black or white) for a given background.
 *
 * Uses the WCAG relative-luminance formula so a label stays legible whether its
 * slice sits on a pale pastel or a deep, saturated tone. The default slice text
 * colour is derived from this; a per-slice `textColor` always overrides it.
 */

/** Dark text used on light backgrounds (matches the historical label default). */
export const DARK_TEXT = '#1f2937';
/** Light text used on dark backgrounds. */
export const LIGHT_TEXT = '#ffffff';

/** Parse a #rgb / #rrggbb / rgb(...) colour into 0–255 channels. */
function parseColor(c: string): [number, number, number] | null {
  const s = c.trim();
  const hex = s.startsWith('#') ? s.slice(1) : s;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1].split(',').map((p) => parseFloat(p));
    if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
      return [parts[0], parts[1], parts[2]];
    }
  }
  return null;
}

/** WCAG relative luminance (0 = black, 1 = white) of a colour, or null if unparsable. */
export function relativeLuminance(color: string): number | null {
  const rgb = parseColor(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const srgb = v / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Returns dark or light text for the given background. The 0.45 threshold (just
 * below the 0.5 midpoint) flips to white slightly earlier, which reads better on
 * the medium-saturation colours in this app's palettes. Falls back to dark text
 * when the colour can't be parsed.
 */
export function idealTextColor(bg: string): string {
  const L = relativeLuminance(bg);
  if (L === null) return DARK_TEXT;
  return L > 0.45 ? DARK_TEXT : LIGHT_TEXT;
}
