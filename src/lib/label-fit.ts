/**
 * Fitting a slice's name to its wedge.
 *
 * The name is never abbreviated: it shrinks to fit, and when it still does not
 * fit (or must not shrink — see SliceLabel on phones) it takes a second line
 * and may spill over the wedge. Legible beats tidy.
 */

/** Rough glyph width: CJK is nearly square, Latin about half as wide. */
export const isCjk = (ch: string): boolean => /[ᄀ-ᇿ㄰-㆏가-힣぀-ヿ一-鿿]/.test(ch);

export function estLabelWidth(text: string, font: number): number {
  let w = 0;
  for (const ch of text) w += (isCjk(ch) ? 0.98 : 0.55) * font;
  return w;
}

/**
 * The name as one line, or two when it is wider than `budget`: split at the
 * space nearest the middle, or mid-text for languages that do not space words.
 */
export function labelLines(text: string, font: number, budget: number): string[] {
  if (!text || estLabelWidth(text, font) <= budget) return [text];
  const mid = Math.floor(text.length / 2);
  let at = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' && (at < 0 || Math.abs(i - mid) < Math.abs(at - mid))) at = i;
  }
  if (at > 0) return [text.slice(0, at), text.slice(at + 1)];
  if (text.length >= 4 && [...text].some(isCjk)) return [text.slice(0, mid), text.slice(mid)];
  return [text];
}
