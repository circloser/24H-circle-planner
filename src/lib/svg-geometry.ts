import type { TimeSlice } from '@/types/time-slice';
import { hhmmToMinutes, sliceWidthMinutes } from '@/lib/time-utils';
import { angleForMin, FULL_SPEC, type ViewSpec } from '@/lib/chart-view';

// ─── Ring geometry constants ──────────────────────────────────────────────────
// T11 Redesign (donut → pizza): innerR reduced from 350 to 100.
// Wedges now span a ~360px band from a small center hub to the outer rim,
// reading visually as pizza slices rather than a thin donut ring.
// G7 export mask radii must be kept in sync — see src/lib/export/pixelDiff.ts.

/**
 * Ring geometry. `innerR` and `outerR` are the two mutable fields — the user's
 * "ring thickness" and "ring size" preferences write them (via
 * {@link setRingInnerR} / {@link setRingOuterR}) so the whole circle (render,
 * hit-testing, ticks, hour labels, leaders, export) reads one consistent pair.
 * cx/cy are fixed. Kept as a shared singleton (rather than threaded through
 * every call site) precisely so rendering and pointer hit-testing can never
 * disagree.
 */
export const RING: { innerR: number; outerR: number; cx: number; cy: number } = {
  innerR: 100,
  outerR: 460,
  cx: 500,
  cy: 500,
};

export type RingGeom = typeof RING;

/** Outer radius bounds. The viewBox is `-36 -36 1072 1072` (edges at ±536 from
 *  centre) and the cardinal hour labels sit at outerR + 32 with a 30px face, so
 *  480 is the most the rim can grow before "00"/"12" clip (verified: at 500 they
 *  do); 400 keeps the chart from looking lost in its box. */
export const RING_OUTER_MIN = 400;
export const RING_OUTER_MAX = 480;
/** Smallest band that still reads as a ring (inner is pushed down to keep it). */
const MIN_BAND = 40;

/** Set the ring's inner radius (ring-thickness preference). Clamped to keep a
 *  legible hub and a visible band under the current outer radius. */
export function setRingInnerR(innerR: number): void {
  RING.innerR = Math.max(60, Math.min(RING.outerR - MIN_BAND, Math.min(380, innerR)));
}

/** The outer radius the ring will actually use for a given preference value.
 *  Exported so overlays that sit OUTSIDE the chart (rim memos and their leader
 *  lines) can anchor to the same rim without reading the mutable singleton —
 *  they re-render from the preference, which the singleton alone can't trigger. */
export function clampRingOuterR(outerR: number): number {
  return Math.max(RING_OUTER_MIN, Math.min(RING_OUTER_MAX, outerR));
}

/** Set the ring's outer radius (ring-size preference). If the band would
 *  collapse, the inner radius yields — the rim the user is dragging wins. */
export function setRingOuterR(outerR: number): void {
  RING.outerR = clampRingOuterR(outerR);
  if (RING.innerR > RING.outerR - MIN_BAND) RING.innerR = RING.outerR - MIN_BAND;
}

// ─── Polar / Cartesian ────────────────────────────────────────────────────────

/**
 * Convert polar angle (degrees, standard math: 0° = right, CW+) to Cartesian.
 * SVG y-axis is flipped, but we work in SVG coordinates directly:
 *   x = cx + r * cos(θ)
 *   y = cy + r * sin(θ)
 * where θ = angleDeg in radians (SVG convention, CW positive).
 */
export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

// ─── Arc path ─────────────────────────────────────────────────────────────────

/**
 * Build the SVG `d` attribute for one slice arc (annulus sector).
 *
 * Path:
 *   M outer-start-point
 *   A outer-arc to outer-end-point (large-arc-flag depends on span)
 *   L inner-end-point
 *   A inner-arc back to inner-start-point (reverse direction)
 *   Z
 *
 * Angles follow the time-utils convention:
 *   00:00 → -90° (top), clockwise positive.
 */
export function slicePath(slice: TimeSlice, geom: RingGeom = RING, spec: ViewSpec = FULL_SPEC): string {
  const { innerR, outerR, cx, cy } = geom;

  const startAngle = angleForMin(hhmmToMinutes(slice.startTime), spec);
  const widthMin = sliceWidthMinutes(slice);
  // widthMin in minutes → degrees (the window spans 360°)
  const spanDeg = (widthMin / spec.spanMin) * 360;
  const endAngle = startAngle + spanDeg;

  const largeArc = spanDeg > 180 ? 1 : 0;

  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);

  const fmt = (n: number) => n.toFixed(4);

  return [
    `M ${fmt(outerStart.x)} ${fmt(outerStart.y)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${fmt(outerEnd.x)} ${fmt(outerEnd.y)}`,
    `L ${fmt(innerEnd.x)} ${fmt(innerEnd.y)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${fmt(innerStart.x)} ${fmt(innerStart.y)}`,
    'Z',
  ].join(' ');
}

// ─── Boundary handle ──────────────────────────────────────────────────────────

/**
 * Position of the drag handle at a slice boundary.
 * Placed at the midpoint radius between innerR and outerR.
 */
export function boundaryHandlePosition(
  slice: TimeSlice,
  side: 'start' | 'end',
  geom: RingGeom = RING,
  spec: ViewSpec = FULL_SPEC,
): { x: number; y: number; angleDeg: number } {
  const { innerR, outerR, cx, cy } = geom;
  const midR = (innerR + outerR) / 2;

  const startAngle = angleForMin(hhmmToMinutes(slice.startTime), spec);
  const widthMin = sliceWidthMinutes(slice);
  const spanDeg = (widthMin / spec.spanMin) * 360;

  const angleDeg = side === 'start' ? startAngle : startAngle + spanDeg;
  const { x, y } = polarToCartesian(cx, cy, midR, angleDeg);
  return { x, y, angleDeg };
}

// ─── Label anchors ────────────────────────────────────────────────────────────

/**
 * Inside-label anchor: positioned along the wedge bisector at 55% of the band
 * depth (innerR + (outerR - innerR) * 0.55). This places the label comfortably
 * in the thick pizza band, away from the hub and the rim ticks.
 * rotation: tangent angle for radial text alignment (+ 90 to face outward).
 */
export function labelAnchorInside(
  slice: TimeSlice,
  geom: RingGeom = RING,
  spec: ViewSpec = FULL_SPEC,
  radialOffset = 0,
): { x: number; y: number; angleDeg: number; rotation: number } {
  const { innerR, outerR, cx, cy } = geom;
  const midR = innerR + (outerR - innerR) * 0.55 + radialOffset;

  const startAngle = angleForMin(hhmmToMinutes(slice.startTime), spec);
  const widthMin = sliceWidthMinutes(slice);
  const spanDeg = (widthMin / spec.spanMin) * 360;
  const midAngle = startAngle + spanDeg / 2;

  const { x, y } = polarToCartesian(cx, cy, midR, midAngle);
  return { x, y, angleDeg: midAngle, rotation: midAngle + 90 };
}

// Below this slice width, adjacent labels are prone to colliding tangentially, so
// we stagger them radially (alternating in/out by index) to keep both readable.
const NARROW_LABEL_MIN = 120;
const LABEL_STAGGER = 30;

/** Radial nudge for an inside label so adjacent NARROW slices don't overlap.
 *  Wide slices stay centred (offset 0); narrow ones alternate in/out by index. */
export function labelRadialOffset(slice: TimeSlice, index: number): number {
  if (sliceWidthMinutes(slice) >= NARROW_LABEL_MIN) return 0;
  return index % 2 === 0 ? -LABEL_STAGGER : LABEL_STAGGER;
}

/**
 * Outside-label anchor: text placed horizontally beyond outerR + 22.
 * leader: two-point line from outerR + 5 to outerR + 18.
 */
export function labelAnchorOutside(
  slice: TimeSlice,
  geom: RingGeom = RING,
  spec: ViewSpec = FULL_SPEC,
): {
  x: number;
  y: number;
  leader: [{ x: number; y: number }, { x: number; y: number }];
} {
  const { outerR, cx, cy } = geom;

  const startAngle = angleForMin(hhmmToMinutes(slice.startTime), spec);
  const widthMin = sliceWidthMinutes(slice);
  const spanDeg = (widthMin / spec.spanMin) * 360;
  const midAngle = startAngle + spanDeg / 2;

  const leaderStart = polarToCartesian(cx, cy, outerR + 5, midAngle);
  const leaderEnd = polarToCartesian(cx, cy, outerR + 18, midAngle);
  const textAnchor = polarToCartesian(cx, cy, outerR + 22, midAngle);

  return {
    x: textAnchor.x,
    y: textAnchor.y,
    leader: [leaderStart, leaderEnd],
  };
}

// ─── Label truncation ─────────────────────────────────────────────────────────

/** Returns true if the string contains at least one CJK / Hangul / full-width character. */
function hasEastAsianChars(s: string): boolean {
  // Unicode ranges: Hangul syllables, Hangul jamo, CJK unified ideographs,
  // CJK compatibility, Hiragana, Katakana
  return /[ᄀ-ᇿ぀-ヿ㐀-鿿가-힯豈-﫿]/.test(s);
}

/**
 * Truncate a label to fit inside a slice label area.
 * - For Korean/CJK text: truncate when grapheme count > maxKrChars (default 12).
 * - For Latin/other text: truncate when plain length > maxEnChars (default 24).
 * - Uses Intl.Segmenter for accurate grapheme counting when available.
 */
export function truncateLabel(
  label: string,
  maxKrChars = 12,
  maxEnChars = 24,
): string {
  if (!label) return label;

  const isEastAsian = hasEastAsianChars(label);

  if (isEastAsian && typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    // Grapheme-based truncation for Korean/CJK content
    const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
    const segments = [...segmenter.segment(label)];
    if (segments.length > maxKrChars) {
      return (
        segments
          .slice(0, maxKrChars - 1)
          .map((s) => s.segment)
          .join('') + '…'
      );
    }
    return label;
  }

  // Plain character length for Latin/other text
  if (label.length > maxEnChars) {
    return label.slice(0, maxEnChars - 1) + '…';
  }

  return label;
}

// ─── Multi-line wrapping (hub title) ──────────────────────────────────────────

/** Visual width in "units": CJK/full-width glyphs count as 2, others as 1. */
function visualWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    w += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch)
      ? 2
      : 1;
  }
  return w;
}

/**
 * Wrap `text` into at most `maxLines` lines of ≤ `maxUnits` visual width each,
 * breaking at spaces when possible (and inside over-long words otherwise). If
 * the content still overflows, the last line ends with an ellipsis. Used by the
 * center hub title to fill the circular space instead of hard-truncating.
 */
export function wrapText(text: string, maxUnits: number, maxLines: number): string[] {
  const trimmed = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return [];
  if (visualWidth(trimmed) <= maxUnits) return [trimmed];

  const all: string[] = [];
  let line = '';
  let lastSpace = -1; // index in `line` of the last break opportunity
  for (const ch of [...trimmed]) {
    if (visualWidth(line + ch) <= maxUnits) {
      line += ch;
      if (ch === ' ') lastSpace = line.length - 1;
    } else if (lastSpace > 0) {
      all.push(line.slice(0, lastSpace).trim());
      line = (line.slice(lastSpace + 1) + ch).trimStart();
      lastSpace = -1;
    } else {
      all.push(line.trim());
      line = ch;
      lastSpace = -1;
    }
  }
  if (line.trim()) all.push(line.trim());

  if (all.length <= maxLines) return all;

  // Overflow: keep maxLines lines, ellipsize the last.
  const kept = all.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 0 && visualWidth(last + '…') > maxUnits) {
    last = last.slice(0, -1);
  }
  kept[maxLines - 1] = last.trimEnd() + '…';
  return kept;
}
