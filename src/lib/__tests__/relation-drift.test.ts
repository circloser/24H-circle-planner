import { describe, expect, it } from 'vitest';
import { DRIFT, driftAt } from '../relation-drift';
import { NODE_PAD, angleOf } from '../relation-layout';

const seeds = [0, 0.13, 0.5, 0.87, 0.999, angleOf('p1'), angleOf('p2')];

describe('the float', () => {
  it('never wanders further than it promises', () => {
    for (const seed of seeds) {
      for (let t = 0; t < 400; t += 0.37) {
        const { dx, dy } = driftAt(seed, t);
        expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(DRIFT * 1.5);
      }
    }
  });

  it('stays well inside the space the layout keeps between people', () => {
    // Two people drifting towards each other must still not touch: twice the
    // furthest either goes has to be less than the clear space between them.
    let worst = 0;
    for (const seed of seeds) {
      for (let t = 0; t < 200; t += 0.29) {
        const { dx, dy } = driftAt(seed, t);
        worst = Math.max(worst, Math.hypot(dx, dy));
      }
    }
    expect(worst * 2).toBeLessThan(NODE_PAD);
  });

  it('is the same map at the same moment, whenever it is asked', () => {
    expect(driftAt(0.42, 12.5)).toEqual(driftAt(0.42, 12.5));
  });

  it('moves smoothly rather than jumping', () => {
    for (const seed of seeds) {
      for (let t = 0; t < 60; t += 1) {
        const a = driftAt(seed, t);
        const b = driftAt(seed, t + 1 / 60);
        expect(Math.hypot(b.dx - a.dx, b.dy - a.dy)).toBeLessThan(0.25);
      }
    }
  });

  it('puts nobody in step with anybody else', () => {
    const a = driftAt(angleOf('p1'), 3);
    const b = driftAt(angleOf('p2'), 3);
    expect(Math.hypot(a.dx - b.dx, a.dy - b.dy)).toBeGreaterThan(0.2);
  });

  it('does actually move', () => {
    const still = driftAt(0.31, 0);
    const later = driftAt(0.31, 4);
    expect(Math.hypot(later.dx - still.dx, later.dy - still.dy)).toBeGreaterThan(0.5);
  });
});
