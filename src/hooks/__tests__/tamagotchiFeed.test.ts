import { describe, it, expect } from 'vitest';
import { canFeed, FULL_HUNGER, type Pet } from '../useTamagotchi';

/**
 * Feeding also credits a play (that is how a fed pet still progresses toward the
 * next stage), so "can this pet be fed" doubles as a guard on the evolution
 * counter: a pet whose hunger gauge already reads full must refuse, otherwise
 * mashing the food button farms plays for free.
 */
function pet(over: Partial<Pet> = {}): Pet {
  return {
    id: 'p1',
    species: 'chick',
    phase: 'baby',
    bornAt: 0,
    hatchAt: 0,
    hatchedAt: 0,
    x: 0,
    y: 0,
    heading: 0,
    hunger: 50,
    happiness: 50,
    energy: 50,
    sleeping: false,
    plays: 0,
    name: null,
    lastPoopAt: 0,
    hungerZeroSince: null,
    bloat: 0,
    boostUntil: 0,
    ...over,
  };
}

describe('canFeed', () => {
  it('accepts food while there is room in the gauge', () => {
    expect(canFeed(pet({ hunger: 0 }))).toBe(true);
    expect(canFeed(pet({ hunger: 50 }))).toBe(true);
    expect(canFeed(pet({ hunger: FULL_HUNGER - 0.1 }))).toBe(true);
  });

  it('refuses once full, including the sliver just under 100', () => {
    // Hunger drains continuously, so a "full" pet is almost never at exactly
    // 100 — this is the case that let plays be farmed before the fix.
    expect(canFeed(pet({ hunger: 99.9 }))).toBe(false);
    expect(canFeed(pet({ hunger: 100 }))).toBe(false);
    expect(canFeed(pet({ hunger: FULL_HUNGER }))).toBe(false);
  });

  it('leaves room for a feeding worth taking', () => {
    // Every accepted feed must restore something meaningful, not a rounding crumb.
    expect(100 - FULL_HUNGER).toBeGreaterThanOrEqual(5);
  });

  it('refuses for eggs, the dead, sleepers and a missing pet', () => {
    expect(canFeed(pet({ phase: 'egg', hunger: 0 }))).toBe(false);
    expect(canFeed(pet({ phase: 'dead', hunger: 0 }))).toBe(false);
    expect(canFeed(pet({ sleeping: true, hunger: 0 }))).toBe(false);
    expect(canFeed(undefined)).toBe(false);
  });
});
