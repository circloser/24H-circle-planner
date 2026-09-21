/**
 * A name, written inside its own circle.
 *
 * The map used to hang each name under its dot, which reads as a caption and
 * leaves the circle holding two letters of it. A name written inside is the
 * node — but then the circle has to be big enough to hold the name, and the
 * layout has to know how big before it can keep anyone from overlapping.
 *
 * So the size is worked out here, without a canvas: how wide a string is in
 * ems is close enough to count its characters, if a wide character counts as
 * one and a narrow one as about half. That is what CJK and Latin actually do,
 * and it does not need a font to be loaded or a frame to be drawn — which
 * means the layout can call it, and so can a test.
 */

/** Lines a name may be broken into before it is simply cut short. */
export const MAX_NAME_LINES = 3;
/** Point size the name is drawn at, in layout units. */
export const NAME_SIZE = 11;
/** Space between a name and the edge of its circle. */
export const NAME_PAD = 4;
/** A name no wider than this is never broken: four Korean characters, or
 *  about seven Latin ones, which covers most of the names people write. */
export const ONE_LINE = 4;

/** Roughly how many ems wide a character is. */
const widthOf = (ch: string): number => {
  if (/[ᄀ-ᇿ⺀-鿿ꥠ-꥿가-퟿豈-﫿＀-｠]/.test(ch)) return 1;
  if (/[iIl1!.,:;'`|()[\]]/.test(ch)) return 0.3;
  if (/[A-Z@%WM]/.test(ch)) return 0.72;
  if (ch === ' ') return 0.35;
  return 0.55;
};

/** How wide a string is, in ems. */
export const emWidth = (text: string): number =>
  [...text].reduce((w, ch) => w + widthOf(ch), 0);

/**
 * Break a name to fit a line of `perLine` ems, at a space where there is one
 * and between characters where there is not — which is how Korean, Japanese
 * and Chinese are broken anyway.
 */
export function wrapName(name: string, perLine: number, maxLines = MAX_NAME_LINES): string[] {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) return [];
  if (emWidth(clean) <= perLine) return [clean];

  const lines: string[] = [];
  let line = '';
  const flush = () => {
    if (line) lines.push(line);
    line = '';
  };
  // Words first, so a Latin name breaks where it reads; a word too long for a
  // line (or a run of CJK, which is one "word") is then broken by character.
  for (const word of clean.split(' ')) {
    if (lines.length >= maxLines) break;
    const joined = line ? `${line} ${word}` : word;
    if (emWidth(joined) <= perLine) {
      line = joined;
      continue;
    }
    flush();
    if (emWidth(word) <= perLine) {
      line = word;
      continue;
    }
    for (const ch of word) {
      if (emWidth(line + ch) > perLine) {
        flush();
        if (lines.length >= maxLines) break;
      }
      line += ch;
    }
  }
  flush();
  if (lines.length > maxLines) lines.length = maxLines;
  // Whatever did not fit is said with an ellipsis rather than silently lost.
  // Counted in characters, not in ems: the spaces a line break stands in for
  // are not missing, they are the break.
  const kept = lines.join('').replace(/\s+/g, '').length;
  const whole = clean.replace(/\s+/g, '').length;
  if (kept < whole && lines.length) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = `${[...last].slice(0, Math.max(1, [...last].length - 1)).join('')}…`;
  }
  return lines;
}

export interface NameBox {
  lines: string[];
  /** The radius the circle needs to hold them, in layout units. */
  radius: number;
}

/**
 * The name laid out, and how big a circle it wants.
 *
 * A circle is squarest where it is widest, so the text is fitted to a square
 * inside it: a box of w × h fits a circle of radius √(w² + h²)/2. The name is
 * tried on one line, then two, then three, and whichever wants the smallest
 * circle wins — which keeps short names round and long names from being tall.
 */
export function nameBox(name: string, least: number, size = NAME_SIZE): NameBox {
  const clean = name.trim();
  if (!clean) return { lines: [], radius: least };
  // A name that fits on one line stays on one line, even where two would
  // make a smaller circle: "이정숙" broken after two characters is a smaller
  // circle and a worse name.
  if (emWidth(clean) <= ONE_LINE) {
    const w = emWidth(clean) * size;
    return { lines: [clean], radius: Math.max(least, Math.hypot(w, size * 1.15) / 2 + NAME_PAD) };
  }
  // A Latin word cannot be broken mid-word and still read, so every line has
  // to be at least as wide as the longest one of them. A run of Korean,
  // Japanese or Chinese breaks anywhere, so it sets no floor.
  const floor = clean.split(/\s+/)
    .filter((w) => !/[ᄀ-ᇿ⺀-鿿ꥠ-꥿가-퟿豈-﫿]/.test(w))
    .reduce((w, word) => Math.max(w, emWidth(word)), 0);
  const whole = clean.replace(/\s+/g, '').length;
  let best: NameBox | null = null;
  let cut: NameBox | null = null;
  const said = (lines: string[]) => lines.join('').replace(/\s+/g, '').replace(/…/g, '').length;
  const weigh = (lines: string[]): NameBox => {
    const w = Math.max(...lines.map(emWidth)) * size;
    const h = lines.length * size * 1.15;
    return { lines, radius: Math.max(least, Math.hypot(w, h) / 2 + NAME_PAD) };
  };
  for (let n = 1; n <= MAX_NAME_LINES; n++) {
    // An even split of the width is the narrowest a line could be; words and
    // characters rarely fall that evenly, so the line is widened until the
    // whole name fits on n lines — which is what a person would do by hand.
    const start = Math.max(1, floor, emWidth(clean) / n);
    const widest = Math.max(start, emWidth(clean));
    for (let per = start; per <= widest + 0.01; per += 0.25) {
      const lines = wrapName(clean, per, n);
      if (!lines.length) break;
      const box = weigh(lines);
      // A name with its tail cut off makes a smaller circle than the same
      // name whole, so the two are never compared: whole names are chosen
      // among themselves, and a cut one is the last resort.
      if (said(lines) >= whole) {
        if (!best || box.radius < best.radius) best = box;
        break;
      }
      if (!cut || box.radius < cut.radius) cut = box;
    }
  }
  return best ?? cut ?? { lines: [clean], radius: least };
}
