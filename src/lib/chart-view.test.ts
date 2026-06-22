import { describe, it, expect } from 'vitest';
import {
  viewSpec,
  angleForMin,
  minForAngle,
  isInWindow,
  visibleSegments,
} from './chart-view';
import { hhmmToAngle } from './time-utils';

const M = (h: number, m = 0) => h * 60 + m;

describe('viewSpec', () => {
  it('full spans 24h from the top, 12h windows seam at the bottom', () => {
    expect(viewSpec('full')).toMatchObject({ startMin: 0, spanMin: 1440, startAngleDeg: -90 });
    expect(viewSpec('day')).toMatchObject({ startMin: 360, spanMin: 720, startAngleDeg: 90 });
    expect(viewSpec('night')).toMatchObject({ startMin: 1080, spanMin: 720, startAngleDeg: 90 });
  });
});

describe('angleForMin', () => {
  it('full view matches the legacy hhmmToAngle mapping exactly', () => {
    const full = viewSpec('full');
    for (const min of [0, 360, 720, 1080, 1430]) {
      expect(angleForMin(min, full)).toBeCloseTo(hhmmToAngle(
        `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`,
      ));
    }
  });

  it('day view: 06/18 at the bottom (90°), noon at the top (270°)', () => {
    const day = viewSpec('day');
    expect(angleForMin(M(6), day)).toBeCloseTo(90); // bottom seam
    expect(angleForMin(M(9), day)).toBeCloseTo(180); // left
    expect(angleForMin(M(12), day)).toBeCloseTo(270); // top
    expect(angleForMin(M(15), day) % 360).toBeCloseTo(0); // right
    expect(angleForMin(M(18), day) % 360).toBeCloseTo(90); // bottom seam (wrap)
  });

  it('night view: 18/06 at the bottom, midnight at the top', () => {
    const night = viewSpec('night');
    expect(angleForMin(M(18), night)).toBeCloseTo(90); // bottom seam
    expect(angleForMin(M(0), night)).toBeCloseTo(270); // top (midnight)
    expect(angleForMin(M(6), night) % 360).toBeCloseTo(90); // bottom seam (wrap)
  });
});

describe('minForAngle round-trips angleForMin within the window', () => {
  for (const view of ['full', 'day', 'night'] as const) {
    it(view, () => {
      const spec = viewSpec(view);
      for (const min of [M(0), M(7), M(12), M(19), M(23, 50)]) {
        if (!isInWindow(min, spec)) continue;
        expect(minForAngle(angleForMin(min, spec), spec)).toBe(min);
      }
    });
  }
});

describe('isInWindow', () => {
  it('day includes [06:00, 18:00), excludes the rest', () => {
    const day = viewSpec('day');
    expect(isInWindow(M(6), day)).toBe(true);
    expect(isInWindow(M(12), day)).toBe(true);
    expect(isInWindow(M(18), day)).toBe(false); // window end is exclusive
    expect(isInWindow(M(20), day)).toBe(false);
    expect(isInWindow(M(0), day)).toBe(false);
  });
  it('full is always in-window', () => {
    expect(isInWindow(M(3), viewSpec('full'))).toBe(true);
  });
});

describe('visibleSegments', () => {
  const day = viewSpec('day');

  it('full view returns the whole slice', () => {
    const segs = visibleSegments(M(5), 180, viewSpec('full'));
    expect(segs).toEqual([{ startMin: M(5), endMin: M(8), widthMin: 180 }]);
  });

  it('clips a slice straddling the day window start (05–08 → 06–08)', () => {
    const segs = visibleSegments(M(5), 180, day);
    expect(segs).toEqual([{ startMin: M(6), endMin: M(8), widthMin: 120 }]);
  });

  it('drops a slice fully outside the window (20–22 → none)', () => {
    expect(visibleSegments(M(20), 120, day)).toEqual([]);
  });

  it('splits a slice covering both window ends into two segments (17→07)', () => {
    const width = 1440 - M(17) + M(7); // 840
    const segs = visibleSegments(M(17), width, day);
    expect(segs).toEqual([
      { startMin: M(17), endMin: M(18), widthMin: 60 },
      { startMin: M(6), endMin: M(7), widthMin: 60 },
    ]);
  });

  it('keeps a fully-in-window slice intact (09–11)', () => {
    expect(visibleSegments(M(9), 120, day)).toEqual([
      { startMin: M(9), endMin: M(11), widthMin: 120 },
    ]);
  });
});
