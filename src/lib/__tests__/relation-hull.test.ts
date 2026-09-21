import { describe, expect, it } from 'vitest';
import { boundaryOf, drawBoundary, hullOf, type Point } from '../relation-hull';

/** Is the point inside the shape (ray casting)? */
const inside = (shape: readonly Point[], x: number, y: number): boolean => {
  let on = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const [xi, yi] = shape[i];
    const [xj, yj] = shape[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) on = !on;
  }
  return on;
};

describe('the ring round a set of points', () => {
  it('is the corners, and not the middle', () => {
    const square: Point[] = [[0, 0], [10, 0], [10, 10], [0, 10], [5, 5]];
    const hull = hullOf(square);
    expect(hull).toHaveLength(4);
    expect(hull.some(([x, y]) => x === 5 && y === 5)).toBe(false);
  });

  it('hands back what it was given when there is no shape to make', () => {
    expect(hullOf([])).toEqual([]);
    expect(hullOf([[1, 2]])).toEqual([[1, 2]]);
    expect(hullOf([[1, 2], [3, 4]])).toEqual([[1, 2], [3, 4]]);
  });
});

describe('the boundary round a group', () => {
  it('holds every circle in it, with room to spare', () => {
    const spots = [{ x: 0, y: 0, r: 12 }, { x: 80, y: 20, r: 9 }, { x: 30, y: 90, r: 14 }];
    const shape = boundaryOf(spots, 16);
    for (const s of spots) {
      // The circle's own edge, all the way round it, is inside the boundary.
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        expect(inside(shape, s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r)).toBe(true);
      }
    }
  });

  it('makes a shape for a group of one', () => {
    const shape = boundaryOf([{ x: 5, y: 5, r: 10 }], 12);
    expect(shape.length).toBeGreaterThan(4);
    expect(inside(shape, 5, 5)).toBe(true);
    expect(inside(shape, 90, 90)).toBe(false);
  });

  it('is nothing at all for nobody', () => {
    expect(boundaryOf([])).toEqual([]);
  });

  it('draws a closed path with no corners left in it', () => {
    const calls: string[] = [];
    const ctx = {
      beginPath: () => calls.push('begin'),
      moveTo: () => calls.push('move'),
      lineTo: () => calls.push('line'),
      arcTo: () => calls.push('arc'),
      closePath: () => calls.push('close'),
    };
    drawBoundary(ctx, boundaryOf([{ x: 0, y: 0, r: 10 }, { x: 60, y: 0, r: 10 }]));
    expect(calls[0]).toBe('begin');
    expect(calls.at(-1)).toBe('close');
    expect(calls.filter((c) => c === 'arc').length).toBeGreaterThan(3);
    expect(calls).not.toContain('line');
  });

  it('draws nothing for a shape that is not one', () => {
    const calls: string[] = [];
    const ctx = {
      beginPath: () => calls.push('begin'), moveTo: () => {}, lineTo: () => {},
      arcTo: () => {}, closePath: () => {},
    };
    drawBoundary(ctx, [[0, 0], [1, 1]]);
    expect(calls).toEqual([]);
  });
});
