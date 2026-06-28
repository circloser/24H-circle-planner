import type { TimeSlice } from '@/types/time-slice';

/** "HH:mm" → minutes 0..1439. Throws on malformed input. */
export function hhmmToMinutes(hhmm: string): number {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) {
    throw new Error(`Invalid time format: "${hhmm}". Expected "HH:mm".`);
  }
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (h < 0 || h > 23) throw new Error(`Invalid hour ${h} in "${hhmm}"`);
  if (m < 0 || m > 59) throw new Error(`Invalid minute ${m} in "${hhmm}"`);
  return h * 60 + m;
}

/** minutes 0..1439 → "HH:mm" with zero-padding. */
export function minutesToHhmm(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * "HH:mm" → degrees where 00:00 = -90 (top of circle),
 * increasing clockwise.
 * Formula: ((h*60+m)/1440)*360 - 90
 */
export function hhmmToAngle(hhmm: string): number {
  const m = hhmmToMinutes(hhmm);
  return (m / 1440) * 360 - 90;
}

/**
 * Degrees → "HH:mm", inverse of hhmmToAngle.
 * Snapped to nearest 10-minute step.
 */
export function angleToHhmm(deg: number): string {
  // Normalize degrees to [0, 360)
  const normalized = ((deg + 90) % 360 + 360) % 360;
  const totalMinutes = (normalized / 360) * 1440;
  const snapped = snapMinutes(Math.round(totalMinutes));
  // Clamp to 0..1430 range
  return minutesToHhmm(snapped === 1440 ? 0 : snapped);
}

/** Round to nearest 10-minute step, clamped 0..1430. */
export function snapMinutes(m: number): number {
  const snapped = Math.round(m / 10) * 10;
  return Math.max(0, Math.min(1430, snapped));
}

/** Pure lexicographic compare on HH:mm (no wrap). */
export function compareHHmm(a: string, b: string): number {
  const aMin = hhmmToMinutes(a);
  const bMin = hhmmToMinutes(b);
  return aMin - bMin;
}

/**
 * Width of a slice in minutes, handling midnight wrap.
 * If endMin <= startMin → 1440 - startMin + endMin (wrap-around).
 * Otherwise endMin - startMin.
 * Minimum legal width is 10.
 */
export function sliceWidthMinutes(slice: TimeSlice): number {
  const startMin = hhmmToMinutes(slice.startTime);
  // Special case: 00:00–00:00 means the full 24h (1440 minutes)
  const endStr = slice.endTime === '24:00' ? '00:00' : slice.endTime;
  const endMin = hhmmToMinutes(endStr);
  if (startMin === 0 && endMin === 0) return 1440;
  // startMin === endMin (non-zero) means a collapsed (0-width) hypothetical slice
  if (startMin === endMin) return 0;
  if (endMin < startMin) {
    return 1440 - startMin + endMin;
  }
  return endMin - startMin;
}

/** Current minute-of-day (0..1439) in an IANA time zone, or null if unsupported. */
export function tzMinutes(tz: string, now: Date = new Date()): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const h = Number(parts.find((p) => p.type === 'hour')?.value);
    const m = Number(parts.find((p) => p.type === 'minute')?.value);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return (h % 24) * 60 + m;
  } catch {
    return null;
  }
}

/**
 * Returns true if the slices together cover exactly 24h with no gaps/overlaps,
 * in clockwise order, with at most one wrap-around slice.
 *
 * Special case: a single slice with startTime === endTime === "00:00" is treated
 * as covering the full 24h (width 1440).
 */
export function isContiguous24h(slices: TimeSlice[]): boolean {
  if (slices.length === 0) return false;

  // Special case: single full-day slice
  if (slices.length === 1) {
    return sliceWidthMinutes(slices[0]) === 1440;
  }

  const total = slices.reduce((sum, s) => sum + sliceWidthMinutes(s), 0);
  if (total !== 1440) return false;

  // Count wrap-around slices (endMin <= startMin, excluding 00:00–00:00)
  let wrapCount = 0;
  for (const s of slices) {
    const startMin = hhmmToMinutes(s.startTime);
    const endStr = s.endTime === '24:00' ? '00:00' : s.endTime;
    const endMin = hhmmToMinutes(endStr);
    if (startMin === 0 && endMin === 0) continue; // full day single slice handled above
    if (endMin <= startMin) wrapCount++;
  }
  if (wrapCount > 1) return false;

  // Check contiguity: every slice[i].endTime === slice[i+1].startTime
  for (let i = 0; i < slices.length; i++) {
    const curr = slices[i];
    const next = slices[(i + 1) % slices.length];
    const currEnd = curr.endTime === '24:00' ? '00:00' : curr.endTime;
    if (currEnd !== next.startTime) return false;
  }

  return true;
}
