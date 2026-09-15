import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TamagotchiProvider, useTamagotchi } from '../useTamagotchi';
import { TAMA_KEY, markCheckpointSeen } from '@/lib/sync/tamaSync';

const LIVE_KEY = '24h-tamagotchi';
const minuteAgo = () => Date.now() - 60_000;

/** A pet as the checkpoint carries it (no position — that stays device-local). */
const cloudPet = (over: Record<string, unknown> = {}) => ({
  id: 'p1', species: 'blob', phase: 'baby', bornAt: 1, hatchAt: 1, hatchedAt: 1,
  hunger: 90, happiness: 70, energy: 80, sleeping: false, plays: 40, name: null,
  lastPoopAt: Date.now(), nextPoopIn: 9_000_000, hungerZeroSince: null, ...over,
});
const checkpoint = (over: Record<string, unknown> = {}) => ({
  v: 1 as const, savedAt: minuteAgo(), on: true, hygiene: 90, poops: 0, pets: [cloudPet()], ...over,
});
/** This device's own saved state: the same pet, standing at x=100, barely played with. */
const localState = (over: Record<string, unknown> = {}) => ({
  version: 1, on: true, selectedId: 'p1', hygiene: 100, poops: [], savedAt: Date.now(),
  pets: [{ ...cloudPet({ hunger: 20, plays: 5 }), x: 100, y: 100, heading: 0, bloat: 0, boostUntil: 0 }],
  ...over,
});

function Probe() {
  const { pets } = useTamagotchi();
  return <output data-testid="pets">{JSON.stringify(pets.map((p) => ({ id: p.id, plays: p.plays, hunger: Math.round(p.hunger), x: p.x })))}</output>;
}
const mount = () => render(<TamagotchiProvider><Probe /></TamagotchiProvider>);
const shown = () => JSON.parse(screen.getByTestId('pets').textContent ?? '[]') as Array<{ id: string; plays: number; hunger: number; x: number }>;

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('the pet takes up a cloud checkpoint when the app starts', () => {
  it('adopts what another device did, keeping this screen’s position', () => {
    localStorage.setItem(LIVE_KEY, JSON.stringify(localState()));
    localStorage.setItem(TAMA_KEY, JSON.stringify(checkpoint()));

    mount();

    const [p] = shown();
    expect(p.plays).toBe(40); // the other device's play count, not this device's 5
    expect(p.hunger).toBeGreaterThan(80); // fed to 90 there, a minute of decay replayed
    expect(p.hunger).toBeLessThan(90);
    expect(p.x).toBe(100); // …while this screen keeps where the pet stands
  });

  it('brings the pet to a device that has none yet', () => {
    localStorage.setItem(TAMA_KEY, JSON.stringify(checkpoint()));
    mount();
    expect(shown().map((p) => p.id)).toEqual(['p1']);
  });

  it('ignores a checkpoint it already took up, so local play is not undone', () => {
    const cp = checkpoint();
    localStorage.setItem(TAMA_KEY, JSON.stringify(cp));
    markCheckpointSeen(cp);
    localStorage.setItem(LIVE_KEY, JSON.stringify(localState({
      pets: [{ ...cloudPet({ hunger: 30, plays: 99 }), x: 100, y: 100, heading: 0, bloat: 0, boostUntil: 0 }],
    })));

    mount();

    expect(shown()[0].plays).toBe(99);
  });

  it('marks a freshly adopted checkpoint as seen', () => {
    const cp = checkpoint();
    localStorage.setItem(TAMA_KEY, JSON.stringify(cp));
    mount();
    expect(localStorage.getItem('24h-tamagotchi.seen')).toBe(String(cp.savedAt));
  });
});
