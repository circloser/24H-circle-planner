import { v4 as uuid } from 'uuid';
import type { Schedule } from '@/types/schedule';
import type { TimeSlice } from '@/types/time-slice';
import {
  hhmmToMinutes,
  minutesToHhmm,
  snapMinutes,
  sliceWidthMinutes,
  isContiguous24h,
} from './time-utils';

export class ContiguityError extends Error {
  public readonly action: string;
  public readonly reason: string;
  constructor(action: string, reason: string) {
    super(`Contiguity violation in ${action}: ${reason}`);
    this.action = action;
    this.reason = reason;
    this.name = 'ContiguityError';
  }
}

function now(): string {
  return new Date().toISOString();
}

function cloneSlices(slices: TimeSlice[]): TimeSlice[] {
  return slices.map((s) => ({ ...s }));
}

/**
 * 12-colour palette (matches the ColorSwatch picker). Used to give a newly
 * split slice a colour visibly different from its parent.
 */
const SPLIT_PALETTE = [
  '#d1d5db', '#fca5a5', '#fdba74', '#fcd34d', '#bef264', '#6ee7b7',
  '#5eead4', '#7dd3fc', '#93c5fd', '#c4b5fd', '#f9a8d4', '#f0abfc',
];

/** Pick a palette colour distinctly different from `avoid`. */
export function pickDistinctColor(avoid: string): string {
  const lower = (avoid ?? '').toLowerCase();
  const idx = SPLIT_PALETTE.findIndex((c) => c.toLowerCase() === lower);
  if (idx === -1) {
    return SPLIT_PALETTE.find((c) => c.toLowerCase() !== lower) ?? SPLIT_PALETTE[1];
  }
  // Offset by ~half the wheel for maximum visual contrast (always != parent).
  return SPLIT_PALETTE[(idx + 5) % SPLIT_PALETTE.length];
}

// ─── Colour helpers (hex ↔ HSL) for sibling shades ─────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

/**
 * Pick a colour that is a *sibling* of `base` — the same hue/saturation, just a
 * step lighter or darker — so a newly added cell blends with its neighbour
 * instead of contrasting. Still distinguishable (≈12% lightness shift), and
 * always different from `base`. Falls back to a distinct palette colour if the
 * input isn't a parseable hex.
 */
export function pickSimilarColor(base: string): string {
  const rgb = hexToRgb(base);
  if (!rgb) return pickDistinctColor(base);
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  // Darken light pastels, lighten dark ones, so the shift is always visible.
  const nl = l > 0.5 ? Math.max(0.12, l - 0.13) : Math.min(0.92, l + 0.15);
  const [r, g, b] = hslToRgb(h, s, nl);
  return rgbToHex(r, g, b);
}

/** Euclidean distance between two RGB triples (0..~441). */
function rgbDistance(a: number[], b: number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Pick a colour for a cell inserted BETWEEN two neighbours. The result stays a
 * soft *sibling* of `parentColor` (same hue family — only a small lightness/hue
 * step) while being chosen to sit clearly apart from BOTH `parentColor` and
 * `neighborColor`. So a split reads as related to its surroundings yet every
 * adjacent wedge stays distinguishable, whichever two colours flank the new one.
 *
 * Used for every split (background click, scissors cut, +/− affordance) and thus
 * applies identically in the 24h, day, and night views — they share this path.
 */
export function pickSimilarColorBetween(parentColor: string, neighborColor: string): string {
  const parentRgb = hexToRgb(parentColor);
  if (!parentRgb) return pickSimilarColor(parentColor);
  const neighborRgb = hexToRgb(neighborColor);

  const [h, s, l] = rgbToHsl(parentRgb[0], parentRgb[1], parentRgb[2]);
  const darker = Math.max(0.12, l - 0.14);
  const lighter = Math.min(0.92, l + 0.16);
  const ROT = 0.045; // ~16° hue nudge — an escape route when both siblings collide
  // Candidate sibling shades: a lighter/darker step, plus slight hue-rotated
  // variants so a cell can dodge a neighbour when both lightness siblings clash.
  const candidates: number[][] = [
    [h, s, darker],
    [h, s, lighter],
    [(h + ROT) % 1, s, darker],
    [(h + 1 - ROT) % 1, s, lighter],
  ];

  let best = candidates[0];
  let bestScore = -Infinity;
  for (const c of candidates) {
    const rgb = hslToRgb(c[0], c[1], c[2]);
    const dParent = rgbDistance(rgb, parentRgb);
    const dNeighbor = neighborRgb ? rgbDistance(rgb, neighborRgb) : Infinity;
    // Maximise the SMALLER of the two gaps → as distinct as possible from both,
    // while the deliberately small shifts keep it a sibling (visually similar).
    const score = Math.min(dParent, dNeighbor);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  const [r, g, b] = hslToRgb(best[0], best[1], best[2]);
  return rgbToHex(r, g, b);
}

/**
 * Find the index of the slice that contains the given time (in minutes).
 * Handles midnight-wrap slices.
 */
function findSliceIndexAt(slices: TimeSlice[], targetMin: number): number {
  for (let i = 0; i < slices.length; i++) {
    const s = slices[i];
    const startMin = hhmmToMinutes(s.startTime);
    const endStr = s.endTime === '24:00' ? '00:00' : s.endTime;
    const endMin = hhmmToMinutes(endStr);

    if (startMin === 0 && endMin === 0) {
      // Full-day single slice
      return i;
    }

    if (endMin <= startMin) {
      // Wraps midnight: contains [startMin..1439] ∪ [0..endMin)
      if (targetMin >= startMin || targetMin < endMin) return i;
    } else {
      if (targetMin >= startMin && targetMin < endMin) return i;
    }
  }
  return -1;
}

/**
 * Split the slice containing `hhmm` into two slices at that boundary.
 *
 * `newSlotSide` decides which half becomes the fresh empty slot (label/icon
 * cleared, distinct colour); the other half keeps the parent's content and id:
 * - 'after'  (default): the later/CW half is the new empty slot.
 * - 'before':           the earlier/CCW half is the new empty slot.
 *
 * This lets the "+" affordance always sprout the empty cell adjacent to the
 * division line and push the existing content away, symmetrically on both sides.
 * Throws if the snapped split would create a <10-min slice on either side.
 */
export function splitSliceAt(
  schedule: Schedule,
  hhmm: string,
  // 'smaller' empties whichever half is smaller (the larger half keeps the
  // original name + colour) — used by the scissors cut.
  newSlotSide: 'before' | 'after' | 'smaller' = 'after',
): Schedule {
  const action = 'splitSliceAt';
  const targetMin = hhmmToMinutes(hhmm);
  const snappedMin = snapMinutes(targetMin);
  const snappedHhmm = minutesToHhmm(snappedMin);

  const slices = cloneSlices(schedule.slices);
  const idx = findSliceIndexAt(slices, snappedMin);
  if (idx === -1) throw new ContiguityError(action, `No slice contains time ${hhmm}`);

  const parent = slices[idx];
  const parentStartMin = hhmmToMinutes(parent.startTime);
  const parentEndStr = parent.endTime === '24:00' ? '00:00' : parent.endTime;
  const parentEndMin = hhmmToMinutes(parentEndStr);

  // Compute widths of both halves
  let leftWidth: number;
  let rightWidth: number;

  if (parentStartMin === 0 && parentEndMin === 0) {
    // Full-day slice — split at snappedMin
    leftWidth = snappedMin === 0 ? 1440 : snappedMin;
    rightWidth = 1440 - leftWidth;
  } else if (parentEndMin <= parentStartMin) {
    // Wrap-around: left = snappedMin - startMin (if snappedMin > startMin)
    // or left = snappedMin + (1440 - startMin) (if snappedMin < startMin)
    if (snappedMin >= parentStartMin) {
      leftWidth = snappedMin - parentStartMin;
      rightWidth = 1440 - snappedMin + parentEndMin;
    } else {
      leftWidth = 1440 - parentStartMin + snappedMin;
      rightWidth = parentEndMin - snappedMin;
    }
  } else {
    leftWidth = snappedMin - parentStartMin;
    rightWidth = parentEndMin - snappedMin;
  }

  if (leftWidth < 10) throw new ContiguityError(action, `Split would create a <10-min left slice (width=${leftWidth})`);
  if (rightWidth < 10) throw new ContiguityError(action, `Split would create a <10-min right slice (width=${rightWidth})`);

  // The cells flanking the new empty slot: the parent-kept half (parent.color) on
  // the inner side, and the existing adjacent slice on the outer side. Indices
  // wrap circularly; with a single slice both resolve to the parent.
  const n = slices.length;
  const ccwNeighborColor = slices[(idx - 1 + n) % n].color; // before the parent
  const cwNeighborColor = slices[(idx + 1) % n].color; //      after the parent

  // A fresh empty slot, coloured as a sibling shade that stays distinct from BOTH
  // flanking cells so the split blends in yet every wedge stays distinguishable.
  const emptySlot = (startTime: string, endTime: string, neighborColor: string): TimeSlice => ({
    id: uuid(),
    label: '',
    icon: '',
    color: pickSimilarColorBetween(parent.color, neighborColor),
    textPosition: 'inside',
    startTime,
    endTime,
  });

  // Resolve 'smaller' to the actual side: empty out the smaller half so the
  // LARGER half keeps the original name + colour. Ties keep the earlier half.
  const effectiveSide =
    newSlotSide === 'smaller'
      ? leftWidth >= rightWidth
        ? 'after' // left (earlier) is larger → keep it, empty the right
        : 'before' // right (later) is larger → keep it, empty the left
      : newSlotSide;

  // Place the new empty slot on the resolved side; the other half keeps the
  // parent's content (and id).
  let firstSlice: TimeSlice;
  let secondSlice: TimeSlice;
  if (effectiveSide === 'before') {
    // Empty slot is the earlier half → its outer (CCW) neighbour is the slice
    // before the parent; the inner side is the parent-kept half (parent.color).
    firstSlice = emptySlot(parent.startTime, snappedHhmm, ccwNeighborColor);
    secondSlice = { ...parent, startTime: snappedHhmm };
  } else {
    // Empty slot is the later half → its outer (CW) neighbour is the slice after
    // the parent; the inner side is the parent-kept half (parent.color).
    firstSlice = { ...parent, endTime: snappedHhmm };
    secondSlice = emptySlot(snappedHhmm, parent.endTime, cwNeighborColor);
  }

  const newSlices = [...slices.slice(0, idx), firstSlice, secondSlice, ...slices.slice(idx + 1)];

  const out: Schedule = {
    ...schedule,
    slices: newSlices,
    updatedAt: now(),
  };

  if (!isContiguous24h(out.slices)) throw new ContiguityError(action, 'isContiguous24h failed');
  return out;
}

/**
 * Merge two adjacent slices into one.
 * `idCw` is the clockwise (later) slice; `idCcw` is the counter-clockwise (earlier) slice.
 * The merged slice keeps the content (name/icon/colour/styling) of whichever side
 * is WIDER; ties keep the earlier (CCW) side. It always spans CCW.start → CW.end.
 */
export function mergeSlices(schedule: Schedule, idCw: string, idCcw: string): Schedule {
  const action = 'mergeSlices';
  const slices = cloneSlices(schedule.slices);

  const ccwIdx = slices.findIndex((s) => s.id === idCcw);
  const cwIdx = slices.findIndex((s) => s.id === idCw);

  if (ccwIdx === -1) throw new ContiguityError(action, `Slice ${idCcw} not found`);
  if (cwIdx === -1) throw new ContiguityError(action, `Slice ${idCw} not found`);

  const ccwSlice = slices[ccwIdx];
  const cwSlice = slices[cwIdx];

  // They must be adjacent: ccw.endTime === cw.startTime
  const ccwEnd = ccwSlice.endTime === '24:00' ? '00:00' : ccwSlice.endTime;
  if (ccwEnd !== cwSlice.startTime) {
    throw new ContiguityError(action, `Slices are not adjacent: ${idCcw}.endTime=${ccwSlice.endTime} !== ${idCw}.startTime=${cwSlice.startTime}`);
  }

  // Keep the wider side's content (name/icon/colour/styling + id); ties → CCW.
  const survivor = sliceWidthMinutes(cwSlice) > sliceWidthMinutes(ccwSlice) ? cwSlice : ccwSlice;
  const merged: TimeSlice = {
    ...survivor,
    startTime: ccwSlice.startTime,
    endTime: cwSlice.endTime,
  };

  // Remove both and insert merged at ccwIdx
  const newSlices = slices.filter((s) => s.id !== idCw && s.id !== idCcw);
  newSlices.splice(ccwIdx < cwIdx ? ccwIdx : cwIdx, 0, merged);

  const out: Schedule = {
    ...schedule,
    slices: newSlices,
    updatedAt: now(),
  };

  if (!isContiguous24h(out.slices)) throw new ContiguityError(action, 'isContiguous24h failed');
  return out;
}

/**
 * Resize the boundary between slices[boundaryIndex] (CCW side) and
 * slices[(boundaryIndex+1) % len] (CW side).
 *
 * Iterative fold per C5:
 * - Snap newHHmm to 10-min.
 * - Determine drag direction (CW vs CCW).
 * - CW drag: boundary moves forward; CW neighbors shrink and are absorbed if <10 min.
 * - CCW drag: boundary moves backward; CCW neighbors shrink and are absorbed if <10 min.
 * - Throw ContiguityError if the final survivor would collapse.
 */
export function resizeBoundary(
  schedule: Schedule,
  boundaryIndex: number,
  newHHmm: string,
): Schedule {
  const action = 'resizeBoundary';
  const rawMin = hhmmToMinutes(newHHmm);
  const snappedMin = snapMinutes(rawMin);

  let slices = cloneSlices(schedule.slices);

  if (boundaryIndex < 0 || boundaryIndex >= slices.length) {
    throw new ContiguityError(action, `boundaryIndex ${boundaryIndex} out of range (len=${slices.length})`);
  }

  // Current boundary position: the endTime of slices[boundaryIndex]
  const currentBoundaryStr =
    slices[boundaryIndex].endTime === '24:00' ? '00:00' : slices[boundaryIndex].endTime;
  const currentBoundaryMin = hhmmToMinutes(currentBoundaryStr);

  // Determine drag direction using circular delta from currentBoundary to snapped
  const delta = (snappedMin - currentBoundaryMin + 1440) % 1440;
  const isCW = delta > 0 && delta <= 720;
  const isCCW = delta > 720;

  if (!isCW && !isCCW) {
    return { ...schedule, updatedAt: now() };
  }

  let bi = boundaryIndex;
  const initialSliceCount = slices.length;

  if (isCW) {
    // Moving CW: the boundary sweeps forward in time.
    // Absorb each CW neighbor that is entirely consumed (its end ≤ snappedMin in CW order from start).
    let iterations = 0;
    while (true) {
      // Safety net: cannot absorb more neighbors than we started with
      if (++iterations > initialSliceCount) {
        throw new ContiguityError(action, 'survivor would collapse');
      }
      const cwIdx = (bi + 1) % slices.length;
      // Self-reference guard: cwIdx === bi means only 1 slice remains — no boundary possible
      if (cwIdx === bi) {
        throw new ContiguityError(action, 'survivor would collapse');
      }
      const cwSlice = slices[cwIdx];
      const cwEndStr = cwSlice.endTime === '24:00' ? '00:00' : cwSlice.endTime;
      const cwEndMin = hhmmToMinutes(cwEndStr);

      // Distance from the original boundary to cw's end (always positive, CW direction)
      const cwEndDelta = (cwEndMin - currentBoundaryMin + 1440) % 1440;
      // Distance from the original boundary to snappedMin
      const snappedDelta = (snappedMin - currentBoundaryMin + 1440) % 1440;

      // Absorb if the snapped position has overtaken the CW slice's end
      const isOvertaken = snappedDelta >= cwEndDelta && cwEndDelta > 0;

      // Also absorb if remainder would be <10 min (but not overtaken)
      const hypoSlice: TimeSlice = { ...cwSlice, startTime: minutesToHhmm(snappedMin) };
      const newCwWidth = isOvertaken ? 0 : sliceWidthMinutes(hypoSlice);

      if (isOvertaken || newCwWidth < 10) {
        // Absorbing cwSlice would leave slices.length-1 slices; need at least 2 for a boundary
        if (slices.length <= 2) {
          throw new ContiguityError(action, 'survivor would collapse');
        }
        // Before absorbing, check the next CW neighbor (the survivor)
        const nextCwIdx = (cwIdx + 1) % slices.length;
        const nextCwSlice = slices[nextCwIdx];
        const nextHypo: TimeSlice = { ...nextCwSlice, startTime: minutesToHhmm(snappedMin) };
        if (sliceWidthMinutes(nextHypo) < 10) {
          throw new ContiguityError(action, 'survivor would collapse');
        }

        // Absorb cwSlice into bi (ccw slice takes cwSlice's endTime)
        const newCcwSlice: TimeSlice = { ...slices[bi], endTime: cwSlice.endTime };
        const newSlices: TimeSlice[] = [];
        for (let i = 0; i < slices.length; i++) {
          if (i === bi) newSlices.push(newCcwSlice);
          else if (i !== cwIdx) newSlices.push(slices[i]);
        }
        if (cwIdx < bi) bi--;
        slices = newSlices;
      } else {
        break;
      }
    }
  } else {
    // Moving CCW: the boundary sweeps backward in time.
    // The CCW slice (slices[bi]) shrinks from its endTime side.
    // If the snapped position is at or before the CCW slice's startTime, the entire slice
    // is consumed and must be absorbed into the CW slice.
    let iterations = 0;
    while (true) {
      // Safety net: cannot absorb more neighbors than we started with
      if (++iterations > initialSliceCount) {
        throw new ContiguityError(action, 'survivor would collapse');
      }
      const cwIdx = (bi + 1) % slices.length;
      // Self-reference guard: cwIdx === bi means only 1 slice remains — no boundary possible
      if (cwIdx === bi) {
        throw new ContiguityError(action, 'survivor would collapse');
      }
      const ccwSlice = slices[bi];
      const ccwWidth = sliceWidthMinutes(ccwSlice);

      // The drag distance (in CCW direction) from the original boundary to snappedMin
      const dragDistance = (currentBoundaryMin - snappedMin + 1440) % 1440;

      // The CCW slice is overtaken when the drag distance equals or exceeds its full width
      const isOvertaken = dragDistance >= ccwWidth;

      // Also absorb if the resulting width would be <10 min
      const hypoSlice: TimeSlice = { ...ccwSlice, endTime: minutesToHhmm(snappedMin) };
      const newCcwWidth = isOvertaken ? 0 : sliceWidthMinutes(hypoSlice);

      if (isOvertaken || newCcwWidth < 10) {
        // Absorbing ccwSlice would leave slices.length-1 slices; need at least 2 for a boundary
        if (slices.length <= 2) {
          throw new ContiguityError(action, 'survivor would collapse');
        }
        // Before absorbing, check the previous CCW neighbor (new ccw after absorb)
        const prevIdx = (bi - 1 + slices.length) % slices.length;
        if (prevIdx !== cwIdx) {
          const prevSlice = slices[prevIdx];
          const prevHypo: TimeSlice = { ...prevSlice, endTime: minutesToHhmm(snappedMin) };
          if (sliceWidthMinutes(prevHypo) < 10) {
            throw new ContiguityError(action, 'survivor would collapse');
          }
        }

        // Absorb: CW slice takes ccwSlice's startTime
        const cwSlice = slices[cwIdx];
        const newCwSlice: TimeSlice = { ...cwSlice, startTime: ccwSlice.startTime };
        const newSlices: TimeSlice[] = [];
        for (let i = 0; i < slices.length; i++) {
          if (i === bi) continue; // remove ccwSlice
          else if (i === cwIdx) newSlices.push(newCwSlice);
          else newSlices.push(slices[i]);
        }
        slices = newSlices;
        // After removing bi, the cw slice (formerly cwIdx) is now at:
        const newCwPos = cwIdx > bi ? cwIdx - 1 : cwIdx;
        // New bi: the slice before newCwPos
        bi = (newCwPos - 1 + slices.length) % slices.length;
      } else {
        break;
      }
    }
  }

  // Commit the boundary move
  const finalCwIdx = (bi + 1) % slices.length;
  const finalSlices = slices.map((s, i) => {
    if (i === bi) return { ...s, endTime: minutesToHhmm(snappedMin) };
    if (i === finalCwIdx) return { ...s, startTime: minutesToHhmm(snappedMin) };
    return s;
  });

  const out: Schedule = {
    ...schedule,
    slices: finalSlices,
    updatedAt: now(),
  };

  if (!isContiguous24h(out.slices)) throw new ContiguityError(action, 'isContiguous24h failed');
  return out;
}

/**
 * Recolour every slice from a palette, cycling through it
 * (slice[i] → colors[i % colors.length]). Times/labels/icons are untouched.
 */
export function applyPalette(schedule: Schedule, colors: string[]): Schedule {
  const action = 'applyPalette';
  if (colors.length === 0) return schedule;
  const slices = schedule.slices.map((s, i) => ({ ...s, color: colors[i % colors.length] }));

  const out: Schedule = {
    ...schedule,
    slices,
    updatedAt: now(),
  };

  if (!isContiguous24h(out.slices)) throw new ContiguityError(action, 'isContiguous24h failed');
  return out;
}

/**
 * Shallow-patch a slice's label/color/icon/textPosition.
 * Does not touch start/end times.
 */
export function replaceSlice(
  schedule: Schedule,
  id: string,
  patch: Partial<
    Pick<TimeSlice, 'label' | 'color' | 'icon' | 'textPosition' | 'textColor' | 'bold' | 'italic'>
  >,
): Schedule {
  const action = 'replaceSlice';
  const slices = schedule.slices.map((s) => (s.id === id ? { ...s, ...patch } : s));

  const out: Schedule = {
    ...schedule,
    slices,
    updatedAt: now(),
  };

  if (!isContiguous24h(out.slices)) throw new ContiguityError(action, 'isContiguous24h failed');
  return out;
}
