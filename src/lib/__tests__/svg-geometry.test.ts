import { describe, it, expect } from 'vitest';
import {
  RING,
  polarToCartesian,
  slicePath,
  boundaryHandlePosition,
  labelAnchorInside,
  labelAnchorOutside,
  truncateLabel,
} from '../svg-geometry';
import type { TimeSlice } from '@/types/time-slice';

function makeSlice(
  startTime: string,
  endTime: string,
  overrides: Partial<TimeSlice> = {},
): TimeSlice {
  return {
    id: 'test',
    label: 'Test',
    startTime,
    endTime,
    color: '#3B82F6',
    icon: '',
    textPosition: 'inside',
    ...overrides,
  };
}

// ─── RING constants ──────────────────────────────────────────────────────────

describe('RING', () => {
  it('has pizza geometry constants (T11: innerR=100 hub, outerR=460 rim)', () => {
    expect(RING.innerR).toBe(100);
    expect(RING.outerR).toBe(460);
    expect(RING.cx).toBe(500);
    expect(RING.cy).toBe(500);
  });
});

// ─── polarToCartesian ────────────────────────────────────────────────────────

describe('polarToCartesian', () => {
  it('0° points right from center', () => {
    const { x, y } = polarToCartesian(500, 500, 100, 0);
    expect(x).toBeCloseTo(600);
    expect(y).toBeCloseTo(500);
  });

  it('90° points down in SVG coordinates', () => {
    const { x, y } = polarToCartesian(500, 500, 100, 90);
    expect(x).toBeCloseTo(500);
    expect(y).toBeCloseTo(600);
  });

  it('-90° points up (00:00 position)', () => {
    const { x, y } = polarToCartesian(500, 500, 460, -90);
    expect(x).toBeCloseTo(500);
    expect(y).toBeCloseTo(40); // 500 - 460
  });
});

// ─── slicePath ───────────────────────────────────────────────────────────────

describe('slicePath', () => {
  it('produces a path string starting with M for a quarter-day slice', () => {
    const slice = makeSlice('00:00', '06:00'); // 6h = 90° arc
    const d = slicePath(slice);
    expect(d).toMatch(/^M /);
    expect(d).toContain('A');
    expect(d).toContain('L');
    expect(d).toContain('Z');
  });

  it('contains exactly two arc commands (A) for a normal slice', () => {
    const slice = makeSlice('06:00', '12:00');
    const d = slicePath(slice);
    const arcMatches = d.match(/\bA\b/g);
    expect(arcMatches).toHaveLength(2);
  });

  it('sets large-arc-flag=1 for slices wider than 180°', () => {
    // 12 hours = 180°, so let's use 13 hours
    const slice = makeSlice('00:00', '13:00');
    const d = slicePath(slice);
    // large-arc-flag is the 4th parameter of the A command: "A rx ry rot laf sf x y"
    // We expect "1 1" (largeArc=1, sweep=1) somewhere in the outer arc
    expect(d).toContain('0 1 1');
  });

  it('sets large-arc-flag=0 for slices <= 180°', () => {
    const slice = makeSlice('06:00', '12:00'); // exactly 6h = 90°
    const d = slicePath(slice);
    expect(d).toContain('0 0 1');
  });

  it('produces a path for a midnight-wrap slice', () => {
    // 23:00 to 01:00 = 2h = 30° — wrap slice, endTime < startTime
    const slice = makeSlice('23:00', '01:00');
    const d = slicePath(slice);
    expect(d).toMatch(/^M /);
    expect(d).toContain('Z');
  });

  it('produces a full-circle path for a single full-day slice (00:00–00:00)', () => {
    const slice = makeSlice('00:00', '00:00');
    const d = slicePath(slice);
    // 1440 min = 360° → large-arc-flag = 1
    expect(d).toContain('0 1 1');
  });

  it('uses RING geometry defaults', () => {
    const slice = makeSlice('00:00', '06:00');
    const d = slicePath(slice);
    // outerR = 460 should appear in the A command radii
    expect(d).toContain('460 460');
  });
});

// ─── boundaryHandlePosition ──────────────────────────────────────────────────

describe('boundaryHandlePosition', () => {
  it('returns mid-radius position for start boundary', () => {
    const slice = makeSlice('00:00', '06:00');
    const { x, y, angleDeg } = boundaryHandlePosition(slice, 'start');
    const midR = (RING.innerR + RING.outerR) / 2; // (100+460)/2 = 280
    // At 00:00 → -90°: x = 500, y = 500 - 280 = 220
    expect(x).toBeCloseTo(500);
    expect(y).toBeCloseTo(500 - midR);
    expect(angleDeg).toBeCloseTo(-90);
  });

  it('returns mid-radius position for end boundary', () => {
    const slice = makeSlice('00:00', '06:00'); // ends at 06:00 = 0°
    const { x, y, angleDeg } = boundaryHandlePosition(slice, 'end');
    const midR = (RING.innerR + RING.outerR) / 2; // 280
    expect(x).toBeCloseTo(500 + midR);
    expect(y).toBeCloseTo(500);
    expect(angleDeg).toBeCloseTo(0);
  });
});

// ─── labelAnchorInside ───────────────────────────────────────────────────────

describe('labelAnchorInside', () => {
  it('places label at 55% band depth, mid-angle of slice (T11 pizza geometry)', () => {
    // Slice from 00:00 to 12:00 → spans -90° to +90°, mid = 0°
    const slice = makeSlice('00:00', '12:00');
    const { x, y, angleDeg } = labelAnchorInside(slice);
    // label radius = innerR + (outerR - innerR) * 0.55 = 100 + 360*0.55 = 298
    const labelR = RING.innerR + (RING.outerR - RING.innerR) * 0.55;
    // midAngle = 0° → x = 500 + labelR, y = 500
    expect(x).toBeCloseTo(500 + labelR);
    expect(y).toBeCloseTo(500);
    expect(angleDeg).toBeCloseTo(0);
  });

  it('rotation is angleDeg + 90', () => {
    const slice = makeSlice('06:00', '18:00'); // mid at 90°
    const { rotation, angleDeg } = labelAnchorInside(slice);
    expect(rotation).toBeCloseTo(angleDeg + 90);
  });
});

// ─── labelAnchorOutside ──────────────────────────────────────────────────────

describe('labelAnchorOutside', () => {
  it('places text beyond outerR + 22', () => {
    const slice = makeSlice('00:00', '06:00'); // mid at -45°
    const { x, y, leader } = labelAnchorOutside(slice);
    // midAngle = -90 + 45 = -45°
    // text is at outerR + 22 = 482
    const dist = Math.sqrt((x - 500) ** 2 + (y - 500) ** 2);
    expect(dist).toBeCloseTo(482, 0);
    expect(leader).toHaveLength(2);
  });

  it('leader start is closer to center than leader end', () => {
    const slice = makeSlice('06:00', '12:00');
    const { leader } = labelAnchorOutside(slice);
    const [start, end] = leader;
    const d0 = Math.sqrt((start.x - 500) ** 2 + (start.y - 500) ** 2);
    const d1 = Math.sqrt((end.x - 500) ** 2 + (end.y - 500) ** 2);
    expect(d0).toBeLessThan(d1);
  });
});

// ─── truncateLabel ───────────────────────────────────────────────────────────

describe('truncateLabel', () => {
  it('returns short strings unchanged', () => {
    expect(truncateLabel('아침')).toBe('아침');
    expect(truncateLabel('Morning routine')).toBe('Morning routine');
  });

  it('truncates Korean text exceeding maxKrChars graphemes', () => {
    // 13 Korean chars → should truncate to 11 + '…'
    const long = '가나다라마바사아자차카타파';
    const result = truncateLabel(long, 12);
    expect(result.endsWith('…')).toBe(true);
    expect([...result].length).toBeLessThanOrEqual(13); // ≤ maxKrChars + 1 char for '…'
  });

  it('truncates English text exceeding maxEnChars characters', () => {
    const long = 'This is a very long label that exceeds the limit';
    const result = truncateLabel(long, 12, 24);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(24);
  });

  it('returns empty string unchanged', () => {
    expect(truncateLabel('')).toBe('');
  });

  it('does not truncate exactly at the limit', () => {
    // 12 Korean chars — exactly at limit
    const exact = '가나다라마바사아자차카타';
    const result = truncateLabel(exact, 12);
    expect(result).toBe(exact);
  });
});
