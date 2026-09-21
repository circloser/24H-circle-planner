import { describe, expect, it } from 'vitest';
import { ease, flyLevels, flyStep, turnTo } from '../place-fly';

const seoul = { lng: 127, lat: 37.5, zoom: 4 };
const paris = { lng: 2.35, lat: 48.86, zoom: 4 };

describe('going somewhere', () => {
  it('starts where it started and ends where it was going', () => {
    expect(flyStep(seoul, paris, 0)).toEqual(seoul);
    const end = flyStep(seoul, paris, 1);
    expect(end.lng).toBeCloseTo(paris.lng, 6);
    expect(end.lat).toBeCloseTo(paris.lat, 6);
    expect(end.zoom).toBeCloseTo(paris.zoom, 6);
  });

  it('pulls back on the way and comes in again', () => {
    const middle = flyStep(seoul, paris, 0.5);
    expect(middle.zoom).toBeLessThan(seoul.zoom * 0.6);
    expect(flyStep(seoul, paris, 0.1).zoom).toBeGreaterThan(middle.zoom);
    expect(flyStep(seoul, paris, 0.9).zoom).toBeGreaterThan(middle.zoom);
  });

  it('moves without a jump anywhere along the way', () => {
    let prev = flyStep(seoul, paris, 0);
    for (let t = 0.02; t <= 1.0001; t += 0.02) {
      const now = flyStep(seoul, paris, t);
      expect(Math.abs(now.lat - prev.lat)).toBeLessThan(2);
      expect(Math.abs(now.zoom - prev.zoom)).toBeLessThan(0.5);
      prev = now;
    }
  });

  it('slows at both ends', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5, 6);
    expect(ease(0.1)).toBeLessThan(0.1);
    expect(ease(0.9)).toBeGreaterThan(0.9);
  });
});

describe('the shorter way round', () => {
  it('crosses the date line rather than going the long way', () => {
    // 170°E to 170°W is twenty degrees, not three hundred and forty.
    const half = turnTo(170, -170, 0.5);
    expect(Math.abs(half)).toBeGreaterThan(175);
    expect(turnTo(170, -170, 1)).toBeCloseTo(-170, 6);
  });

  it('always answers a longitude', () => {
    for (const [a, b] of [[0, 179], [-179, 179], [90, -90], [10, 10]]) {
      for (let t = 0; t <= 1.0001; t += 0.1) {
        const at = turnTo(a, b, t);
        expect(at).toBeGreaterThanOrEqual(-180);
        expect(at).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe('a tile map, counted in levels', () => {
  it('takes levels off in the middle and puts them back', () => {
    const from = { lng: 0, lat: 0, zoom: 12 };
    const to = { lng: 20, lat: 10, zoom: 12 };
    expect(flyLevels(from, to, 0.5).zoom).toBeCloseTo(12 - 2.5, 6);
    expect(flyLevels(from, to, 1).zoom).toBeCloseTo(12, 6);
  });

  it('never drops below the map\'s own first stop', () => {
    const from = { lng: 0, lat: 0, zoom: 6.5 };
    const to = { lng: 20, lat: 10, zoom: 6.5 };
    for (let t = 0; t <= 1.0001; t += 0.05) {
      expect(flyLevels(from, to, t, 2.5, 6)).toHaveProperty('zoom');
      expect(flyLevels(from, to, t, 2.5, 6).zoom).toBeGreaterThanOrEqual(6);
    }
  });
});
