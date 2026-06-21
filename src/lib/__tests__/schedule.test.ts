import { describe, it, expect } from 'vitest';
import {
  splitSliceAt,
  mergeSlices,
  resizeBoundary,
  replaceSlice,
  applyPalette,
  pickSimilarColor,
  ContiguityError,
} from '../schedule';
import { isContiguous24h, sliceWidthMinutes } from '../time-utils';
import type { Schedule } from '@/types/schedule';
import type { TimeSlice } from '@/types/time-slice';
import { v4 as uuid } from 'uuid';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSlice(
  startTime: string,
  endTime: string,
  overrides: Partial<TimeSlice> = {},
): TimeSlice {
  return {
    id: uuid(),
    label: 'Test',
    startTime,
    endTime,
    color: '#3B82F6',
    icon: '',
    textPosition: 'inside',
    ...overrides,
  };
}

function makeSchedule(slices: TimeSlice[]): Schedule {
  return {
    id: uuid(),
    version: 1,
    name: '테스트',
    slices,
    updatedAt: new Date().toISOString(),
    presetSource: null,
  };
}

/** Build a simple 4-slice schedule: 00–06, 06–12, 12–18, 18–00 */
function makeFourQuarters(): Schedule {
  return makeSchedule([
    makeSlice('00:00', '06:00', { label: 'A' }),
    makeSlice('06:00', '12:00', { label: 'B' }),
    makeSlice('12:00', '18:00', { label: 'C' }),
    makeSlice('18:00', '00:00', { label: 'D' }),
  ]);
}

// ─── pickSimilarColor ────────────────────────────────────────────────────────

describe('pickSimilarColor', () => {
  it('returns a valid hex that differs from the input (a sibling shade)', () => {
    for (const c of ['#93c5fd', '#fca5a5', '#d1d5db', '#6ee7b7']) {
      const out = pickSimilarColor(c);
      expect(out).toMatch(/^#[0-9a-f]{6}$/i);
      expect(out.toLowerCase()).not.toBe(c.toLowerCase());
    }
  });

  it('keeps the same hue family (close in RGB, unlike a contrasting colour)', () => {
    const out = pickSimilarColor('#93c5fd'); // pastel blue
    const n = parseInt(out.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    // Blue should remain the dominant channel for a same-hue sibling.
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g - 1);
  });

  it('falls back gracefully for an unparseable colour', () => {
    expect(pickSimilarColor('not-a-color')).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

// ─── applyPalette ────────────────────────────────────────────────────────────

describe('applyPalette', () => {
  it('recolours every slice, cycling through the palette', () => {
    const result = applyPalette(makeFourQuarters(), ['#111111', '#222222']);
    expect(result.slices.map((s) => s.color)).toEqual([
      '#111111', '#222222', '#111111', '#222222',
    ]);
    expect(isContiguous24h(result.slices)).toBe(true);
  });

  it('preserves times/labels and stays contiguous', () => {
    const before = makeFourQuarters();
    const result = applyPalette(before, ['#abcdef']);
    result.slices.forEach((s, i) => {
      expect(s.startTime).toBe(before.slices[i].startTime);
      expect(s.label).toBe(before.slices[i].label);
      expect(s.color).toBe('#abcdef');
    });
  });

  it('returns the schedule unchanged for an empty palette', () => {
    const before = makeFourQuarters();
    expect(applyPalette(before, []).slices).toEqual(before.slices);
  });
});

// ─── splitSliceAt ────────────────────────────────────────────────────────────

describe('splitSliceAt', () => {
  it('simple split: 06:00–12:00 split at 09:00 → two 3h slices', () => {
    const schedule = makeFourQuarters();
    const result = splitSliceAt(schedule, '09:00');
    expect(result.slices).toHaveLength(5);
    expect(isContiguous24h(result.slices)).toBe(true);
    const bIdx = result.slices.findIndex((s) => s.label === 'B');
    expect(result.slices[bIdx].endTime).toBe('09:00');
    expect(result.slices[bIdx + 1].startTime).toBe('09:00');
    expect(result.slices[bIdx + 1].endTime).toBe('12:00');
    expect(result.slices[bIdx + 1].label).toBe('');
  });

  it("newSlotSide='after' (default) makes the later half the new empty slot", () => {
    const result = splitSliceAt(makeFourQuarters(), '09:00', 'after');
    const earlier = result.slices.find((s) => s.startTime === '06:00' && s.endTime === '09:00')!;
    const later = result.slices.find((s) => s.startTime === '09:00' && s.endTime === '12:00')!;
    expect(earlier.label).toBe('B'); // parent content stays in the earlier half
    expect(later.label).toBe(''); // new empty slot in the later half
  });

  it("newSlotSide='before' makes the earlier half the new empty slot (content keeps later half)", () => {
    const result = splitSliceAt(makeFourQuarters(), '09:00', 'before');
    expect(result.slices).toHaveLength(5);
    expect(isContiguous24h(result.slices)).toBe(true);
    const earlier = result.slices.find((s) => s.startTime === '06:00' && s.endTime === '09:00')!;
    const later = result.slices.find((s) => s.startTime === '09:00' && s.endTime === '12:00')!;
    expect(earlier.label).toBe(''); // new empty slot, adjacent to the 06:00 boundary
    expect(later.label).toBe('B'); // parent content moved to the later half
  });

  it("newSlotSide='smaller' empties the SMALLER half; the larger keeps the name", () => {
    // Split B (06:00–12:00) at 10:00 → earlier 4h, later 2h. Larger = earlier.
    const result = splitSliceAt(makeFourQuarters(), '10:00', 'smaller');
    const earlier = result.slices.find((s) => s.startTime === '06:00' && s.endTime === '10:00')!;
    const later = result.slices.find((s) => s.startTime === '10:00' && s.endTime === '12:00')!;
    expect(earlier.label).toBe('B'); // larger half keeps the original name
    expect(later.label).toBe(''); // smaller half becomes empty
  });

  it("newSlotSide='smaller' empties the earlier half when the later half is larger", () => {
    // Split B (06:00–12:00) at 08:00 → earlier 2h, later 4h. Larger = later.
    const result = splitSliceAt(makeFourQuarters(), '08:00', 'smaller');
    const earlier = result.slices.find((s) => s.startTime === '06:00' && s.endTime === '08:00')!;
    const later = result.slices.find((s) => s.startTime === '08:00' && s.endTime === '12:00')!;
    expect(earlier.label).toBe(''); // smaller half becomes empty
    expect(later.label).toBe('B'); // larger half keeps the original name
  });

  it("newSlotSide='smaller' colours the empty half a sibling shade of the parent (theme-respecting)", () => {
    const schedule = makeFourQuarters();
    const parentColor = schedule.slices[1].color; // B
    const result = splitSliceAt(schedule, '10:00', 'smaller');
    const empty = result.slices.find((s) => s.startTime === '10:00' && s.endTime === '12:00')!;
    expect(empty.label).toBe('');
    expect(empty.color.toLowerCase()).not.toBe(parentColor.toLowerCase());
  });

  it('new slice gets a sibling colour (different from parent), empty label/icon, textPosition inside', () => {
    const schedule = makeFourQuarters();
    const parentColor = schedule.slices[0].color;
    const result = splitSliceAt(schedule, '03:00');
    const newSlice = result.slices[1]; // after first slice split
    // A sibling shade of the parent — harmonious, but still distinguishable.
    expect(newSlice.color.toLowerCase()).not.toBe(parentColor.toLowerCase());
    expect(newSlice.label).toBe('');
    expect(newSlice.icon).toBe('');
    expect(newSlice.textPosition).toBe('inside');
  });

  it('throws if split would create <10-min left slice (slice starts at 00:00, split at 00:00 snaps to 00:00 → left=0)', () => {
    // A slice 00:00–00:10 split at 00:00: left=0 minutes → throws
    const schedule = makeSchedule([
      makeSlice('00:00', '00:10', { label: 'A' }),
      makeSlice('00:10', '00:00', { label: 'B' }),
    ]);
    // Split at 00:00 gives left width=0 (startTime == splitPoint)
    expect(() => splitSliceAt(schedule, '00:00')).toThrow(ContiguityError);
  });

  it('throws if split would create <10-min right slice (slice ends at 00:20, split at 00:10 snaps to 00:10 → right=10 min — valid; use 00:10–00:20 split at boundary)', () => {
    // A 20min slice 00:00–00:20 split at 00:10 gives both halves = 10min — valid.
    // For <10 right, need split point 10min from end: 00:00–00:20 split at 00:20 snaps to 00:20 → right=0 → throws
    const schedule = makeSchedule([
      makeSlice('00:00', '00:20', { label: 'A' }),
      makeSlice('00:20', '00:00', { label: 'B' }),
    ]);
    expect(() => splitSliceAt(schedule, '00:20')).toThrow(ContiguityError);
  });

  it('preserves contiguity after split', () => {
    const schedule = makeFourQuarters();
    const result = splitSliceAt(schedule, '15:00');
    expect(isContiguous24h(result.slices)).toBe(true);
  });

  it('midnight-wrap split: 23:00–01:00 split at 00:00', () => {
    // Build a schedule with a wrap slice properly
    const wrapSchedule = makeSchedule([
      makeSlice('01:00', '23:00', { label: 'day' }),
      makeSlice('23:00', '01:00', { label: 'night' }), // wraps midnight, 2h wide
    ]);
    const result = splitSliceAt(wrapSchedule, '00:00');
    expect(result.slices).toHaveLength(3);
    expect(isContiguous24h(result.slices)).toBe(true);
    // The wrap slice 23:00–01:00 should be split at 00:00 into 23:00–00:00 and 00:00–01:00
    const nightIdx = result.slices.findIndex((s) => s.label === 'night');
    expect(result.slices[nightIdx].endTime).toBe('00:00');
    expect(result.slices[(nightIdx + 1) % result.slices.length].startTime).toBe('00:00');
  });
});

// ─── mergeSlices ─────────────────────────────────────────────────────────────

describe('mergeSlices', () => {
  it('simple merge: two adjacent slices', () => {
    const schedule = makeFourQuarters();
    const [a, b] = schedule.slices;
    const result = mergeSlices(schedule, b.id, a.id);
    expect(result.slices).toHaveLength(3);
    expect(isContiguous24h(result.slices)).toBe(true);
    const merged = result.slices.find((s) => s.id === a.id);
    expect(merged?.startTime).toBe('00:00');
    expect(merged?.endTime).toBe('12:00');
    expect(merged?.label).toBe('A'); // CCW wins
  });

  it('throws for non-adjacent slices', () => {
    const schedule = makeFourQuarters();
    const [a, , c] = schedule.slices;
    expect(() => mergeSlices(schedule, c.id, a.id)).toThrow(ContiguityError);
  });

  it('preserves contiguity after merge', () => {
    const schedule = makeFourQuarters();
    const [a, b] = schedule.slices;
    const result = mergeSlices(schedule, b.id, a.id);
    expect(isContiguous24h(result.slices)).toBe(true);
  });

  it('keeps the WIDER side content/colour when the CW (later) slice is wider', () => {
    const a = makeSlice('00:00', '04:00', { label: 'A', color: '#aaaaaa' }); // 4h
    const b = makeSlice('04:00', '12:00', { label: 'B', color: '#bbbbbb' }); // 8h (wider)
    const c = makeSlice('12:00', '00:00', { label: 'C' });
    const result = mergeSlices(makeSchedule([a, b, c]), b.id, a.id);
    const merged = result.slices.find((s) => s.startTime === '00:00' && s.endTime === '12:00')!;
    expect(merged.label).toBe('B'); // wider (later) side wins
    expect(merged.color).toBe('#bbbbbb');
    expect(merged.id).toBe(b.id);
  });

  it('keeps the WIDER side content/colour when the CCW (earlier) slice is wider', () => {
    const a = makeSlice('00:00', '08:00', { label: 'A', color: '#aaaaaa' }); // 8h (wider)
    const b = makeSlice('08:00', '12:00', { label: 'B', color: '#bbbbbb' }); // 4h
    const c = makeSlice('12:00', '00:00', { label: 'C' });
    const result = mergeSlices(makeSchedule([a, b, c]), b.id, a.id);
    const merged = result.slices.find((s) => s.startTime === '00:00' && s.endTime === '12:00')!;
    expect(merged.label).toBe('A'); // wider (earlier) side wins
    expect(merged.color).toBe('#aaaaaa');
  });
});

// ─── resizeBoundary ──────────────────────────────────────────────────────────

describe('resizeBoundary', () => {
  it('simple boundary resize CW: boundary 0 (06:00) moved to 08:00', () => {
    const schedule = makeFourQuarters();
    // boundary 0 is between slices[0] (00–06) and slices[1] (06–12)
    const result = resizeBoundary(schedule, 0, '08:00');
    expect(isContiguous24h(result.slices)).toBe(true);
    expect(result.slices).toHaveLength(4);
    expect(result.slices[0].endTime).toBe('08:00');
    expect(result.slices[1].startTime).toBe('08:00');
  });

  it('simple boundary resize CCW: boundary 0 (06:00) moved to 04:00', () => {
    const schedule = makeFourQuarters();
    const result = resizeBoundary(schedule, 0, '04:00');
    expect(isContiguous24h(result.slices)).toBe(true);
    expect(result.slices).toHaveLength(4);
    expect(result.slices[0].endTime).toBe('04:00');
    expect(result.slices[1].startTime).toBe('04:00');
  });

  it('single-collapse drag CW: resize past one narrow neighbor', () => {
    // slices: 00–06, 06–06:10, 06:10–12, 12–00
    const narrow = makeSlice('06:00', '06:10', { label: 'narrow' });
    const schedule = makeSchedule([
      makeSlice('00:00', '06:00', { label: 'A' }),
      narrow,
      makeSlice('06:10', '12:00', { label: 'C' }),
      makeSlice('12:00', '00:00', { label: 'D' }),
    ]);
    // Move boundary 0 (at 06:00) CW past narrow slice (06:10) to 07:00
    const result = resizeBoundary(schedule, 0, '07:00');
    expect(isContiguous24h(result.slices)).toBe(true);
    expect(result.slices).toHaveLength(3); // narrow absorbed
    expect(result.slices.find((s) => s.id === narrow.id)).toBeUndefined();
  });

  it('multi-collapse drag CW: resize past two narrow neighbors', () => {
    // slices: 00–06, 06–06:10, 06:10–06:20, 06:20–12, 12–00
    const narrow1 = makeSlice('06:00', '06:10', { label: 'n1' });
    const narrow2 = makeSlice('06:10', '06:20', { label: 'n2' });
    const schedule = makeSchedule([
      makeSlice('00:00', '06:00', { label: 'A' }),
      narrow1,
      narrow2,
      makeSlice('06:20', '12:00', { label: 'C' }),
      makeSlice('12:00', '00:00', { label: 'D' }),
    ]);
    const result = resizeBoundary(schedule, 0, '08:00');
    expect(isContiguous24h(result.slices)).toBe(true);
    expect(result.slices).toHaveLength(3); // both narrow absorbed
    expect(result.slices.find((s) => s.id === narrow1.id)).toBeUndefined();
    expect(result.slices.find((s) => s.id === narrow2.id)).toBeUndefined();
  });

  it('survivor-collapse rejection: throw ContiguityError if survivor would also collapse', () => {
    // [A(00–06:00), B(06:00–06:10), C(06:10–06:20), D(06:20–00:00)]
    // boundary 0 (at 06:00) CW to 06:15 → snaps to 06:20.
    // B(06:00–06:10): cwEndDelta=10, snappedDelta=20, isOvertaken → absorb B.
    // Check C (next survivor): hypo C.start=06:20, C.end=06:20 → width=0 < 10 → THROW.
    const schedule = makeSchedule([
      makeSlice('00:00', '06:00', { label: 'A' }),
      makeSlice('06:00', '06:10', { label: 'B' }),
      makeSlice('06:10', '06:20', { label: 'C' }),
      makeSlice('06:20', '00:00', { label: 'D' }),
    ]);
    expect(() => resizeBoundary(schedule, 0, '06:15')).toThrow(ContiguityError);
  });

  it('preserves contiguity after boundary resize', () => {
    const schedule = makeFourQuarters();
    const result = resizeBoundary(schedule, 1, '15:00');
    expect(isContiguous24h(result.slices)).toBe(true);
  });

  it('multi-collapse drag CCW: resize past two narrow predecessors', () => {
    // [A(00–12), n1(12–12:10), n2(12:10–12:20), B(12:20–00)]
    // boundary 2 between n2(CCW, slices[2]) and B(CW, slices[3]), moved CCW to 11:00.
    // n2(12:10–12:20): startMin=730 > snappedMin=660 → overtaken → absorb n2 into B (B.startTime=12:10)
    // n1(12:00–12:10): startMin=720 > snappedMin=660 → overtaken → absorb n1 into B (B.startTime=12:00)
    // A(00:00–12:00): startMin=0 < snappedMin=660, hypoWidth=660 ≥ 10 → stop
    // Commit: A.endTime=11:00, B.startTime=11:00
    // Result: [A(00–11), B(11–00)]
    const nA = makeSlice('00:00', '12:00', { label: 'A' });
    const nN1 = makeSlice('12:00', '12:10', { label: 'n1' });
    const nN2 = makeSlice('12:10', '12:20', { label: 'n2' });
    const nB = makeSlice('12:20', '00:00', { label: 'B' });
    const sched2 = makeSchedule([nA, nN1, nN2, nB]);
    const result = resizeBoundary(sched2, 2, '11:00');
    expect(isContiguous24h(result.slices)).toBe(true);
    expect(result.slices).toHaveLength(2);
    expect(result.slices.find((s) => s.id === nA.id)?.endTime).toBe('11:00');
  });
});

// ─── replaceSlice ─────────────────────────────────────────────────────────────

describe('replaceSlice', () => {
  it('patches label and color without touching times', () => {
    const schedule = makeFourQuarters();
    const [a] = schedule.slices;
    const result = replaceSlice(schedule, a.id, { label: 'Morning', color: '#FF0000' });
    const patched = result.slices.find((s) => s.id === a.id)!;
    expect(patched.label).toBe('Morning');
    expect(patched.color).toBe('#FF0000');
    expect(patched.startTime).toBe('00:00');
    expect(patched.endTime).toBe('06:00');
    expect(isContiguous24h(result.slices)).toBe(true);
  });

  it('patches textPosition', () => {
    const schedule = makeFourQuarters();
    const [a] = schedule.slices;
    const result = replaceSlice(schedule, a.id, { textPosition: 'outside' });
    expect(result.slices.find((s) => s.id === a.id)?.textPosition).toBe('outside');
  });

  it('preserves contiguity after replace', () => {
    const schedule = makeFourQuarters();
    const [a] = schedule.slices;
    const result = replaceSlice(schedule, a.id, { label: 'X' });
    expect(isContiguous24h(result.slices)).toBe(true);
  });
});

// ─── Width computation for midnight-wrap slices ──────────────────────────────

describe('midnight-wrap slice width in context', () => {
  it('23:50–00:10 wrap slice has width 20', () => {
    const s = makeSlice('23:50', '00:10');
    expect(sliceWidthMinutes(s)).toBe(20);
  });

  it('combined with 00:10–23:50 sibling passes isContiguous24h', () => {
    const s1 = makeSlice('00:10', '23:50');
    const s2 = makeSlice('23:50', '00:10');
    expect(isContiguous24h([s1, s2])).toBe(true);
    expect(sliceWidthMinutes(s1) + sliceWidthMinutes(s2)).toBe(1440);
  });
});
