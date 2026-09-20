import { describe, expect, it } from 'vitest';
import { MAX_STEP, atRest, bowOf, sagOf, springAt, stepSpring } from '../relation-spring';

const settle = (steps = 400, dt = 1 / 60) => {
  let s = springAt(0, 0);
  for (let i = 0; i < steps; i++) s = stepSpring(s, 100, 0, dt);
  return s;
};

describe('the give in the map', () => {
  it('goes to where the finger is, and stops there', () => {
    const s = settle();
    expect(s.x).toBeCloseTo(100, 1);
    expect(s.y).toBeCloseTo(0, 1);
    expect(atRest(s, 100, 0)).toBe(true);
  });

  it('takes a moment about it, rather than arriving at once', () => {
    let s = springAt(0, 0);
    s = stepSpring(s, 100, 0, 1 / 60);
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(40);
    expect(atRest(s, 100, 0)).toBe(false);
  });

  it('overshoots a little, and only a little', () => {
    let s = springAt(0, 0);
    let furthest = 0;
    for (let i = 0; i < 200; i++) {
      s = stepSpring(s, 100, 0, 1 / 60);
      furthest = Math.max(furthest, s.x);
    }
    expect(furthest).toBeGreaterThan(100);
    expect(furthest).toBeLessThan(115);
  });

  it('survives a tab coming back after a minute', () => {
    // One enormous step must not throw the node off the map: it is clamped.
    const long = stepSpring(springAt(0, 0), 100, 0, 60);
    const clamped = stepSpring(springAt(0, 0), 100, 0, MAX_STEP);
    expect(long).toEqual(clamped);
    expect(Number.isFinite(long.x)).toBe(true);
    expect(Math.abs(long.x)).toBeLessThan(200);
  });

  it('does nothing at all for a step of no time', () => {
    const s = springAt(3, 4);
    expect(stepSpring(s, 100, 0, 0)).toBe(s);
    expect(stepSpring(s, 100, 0, -1)).toBe(s);
  });
});

describe('a line that is being stretched', () => {
  it('is straight at its resting length, and never bows past its limit', () => {
    expect(sagOf(100, 100)).toBe(0);
    expect(sagOf(50, 100)).toBe(0);
    expect(sagOf(0, 0)).toBe(0);
    expect(sagOf(200, 100)).toBeGreaterThan(0);
    expect(sagOf(1e6, 100, 26)).toBeLessThanOrEqual(26);
  });

  it('bows further the further it is pulled', () => {
    expect(sagOf(300, 100)).toBeGreaterThan(sagOf(150, 100));
  });

  it('puts the bow to one side of the middle, always the same side', () => {
    const straight = bowOf(0, 0, 100, 0, 0);
    expect(straight).toEqual({ x: 50, y: 0 });
    const bowed = bowOf(0, 0, 100, 0, 10);
    expect(bowed.x).toBeCloseTo(50, 6);
    expect(bowed.y).toBeCloseTo(20, 6);
    // The same line drawn the other way round bows the other way, which is
    // the same curve on screen.
    const back = bowOf(100, 0, 0, 0, 10);
    expect(back.y).toBeCloseTo(-20, 6);
  });
});
