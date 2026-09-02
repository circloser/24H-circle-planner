import { describe, it, expect, beforeEach } from 'vitest';
import {
  TAMA_KEY,
  mergeCheckpointPets,
  parseTamaCheckpoint,
  readTamaCheckpoint,
  tamaSignature,
  toTamaCheckpoint,
  writeTamaCheckpoint,
  type TamaPetLike,
  type TamaStateLike,
} from '../tamaSync';
import { SYNC_KEYS, collectSyncData, applySyncData } from '../syncData';

const pet = (over: Partial<TamaPetLike> = {}): TamaPetLike => ({
  id: 'p1',
  species: 'chick',
  phase: 'baby',
  bornAt: 1000,
  hatchAt: 2000,
  hatchedAt: 2000,
  hunger: 80,
  happiness: 70,
  energy: 60,
  sleeping: false,
  plays: 12,
  name: null,
  lastPoopAt: 5000,
  nextPoopIn: 90 * 60_000,
  hungerZeroSince: null,
  ...over,
});

const state = (over: Partial<TamaStateLike> = {}): TamaStateLike => ({
  on: true,
  hygiene: 100,
  pets: [pet()],
  poops: [],
  ...over,
});

describe('tamaSignature — what counts as a real change', () => {
  it('ignores the continuously decaying stats (the once-a-second tick)', () => {
    const before = state();
    const ticked = state({ pets: [pet({ hunger: 79.9, happiness: 69.95, energy: 59.8 })] });
    expect(tamaSignature(ticked)).toBe(tamaSignature(before));
  });

  it('changes when the pet is played with (plays), fed being a play too', () => {
    expect(tamaSignature(state({ pets: [pet({ plays: 13 })] }))).not.toBe(tamaSignature(state()));
  });

  it.each([
    ['phase (hatch/evolve/death)', pet({ phase: 'adult' })],
    ['name (stage 5)', pet({ name: 'Coco' })],
    ['sleep', pet({ sleeping: true })],
    ['poop timer', pet({ lastPoopAt: 9999 })],
    ['starvation clock', pet({ hungerZeroSince: 123 })],
  ])('changes on %s', (_label, changed) => {
    expect(tamaSignature(state({ pets: [changed] }))).not.toBe(tamaSignature(state()));
  });

  it('changes when a pet is added or released, or the poop pile changes', () => {
    expect(tamaSignature(state({ pets: [pet(), pet({ id: 'p2' })] }))).not.toBe(tamaSignature(state()));
    expect(tamaSignature(state({ pets: [] }))).not.toBe(tamaSignature(state()));
    expect(tamaSignature(state({ poops: [{ id: 'a' }] }))).not.toBe(tamaSignature(state()));
    expect(tamaSignature(state({ hygiene: 80 }))).not.toBe(tamaSignature(state()));
  });

  it('changes when roaming is switched off', () => {
    expect(tamaSignature(state({ on: false }))).not.toBe(tamaSignature(state()));
  });
});

describe('checkpoint round-trip', () => {
  beforeEach(() => localStorage.clear());

  it('carries the durable fields and the moment it was taken', () => {
    const cp = toTamaCheckpoint(state({ poops: [{ id: 'a' }, { id: 'b' }] }), 1234);
    expect(cp).toMatchObject({ v: 1, savedAt: 1234, on: true, hygiene: 100, poops: 2 });
    expect(cp.pets[0]).toMatchObject({ id: 'p1', phase: 'baby', plays: 12, hunger: 80 });
    // Positions are viewport pixels — they must NOT travel.
    expect(Object.keys(cp.pets[0])).not.toContain('x');
    expect(Object.keys(cp.pets[0])).not.toContain('y');
  });

  it('write → read returns an equal checkpoint', () => {
    const cp = toTamaCheckpoint(state(), 555);
    writeTamaCheckpoint(cp);
    expect(readTamaCheckpoint()).toEqual(cp);
  });

  it('rejects corrupt / foreign / absent values instead of throwing', () => {
    expect(parseTamaCheckpoint(null)).toBeNull();
    expect(parseTamaCheckpoint('{oops')).toBeNull();
    expect(parseTamaCheckpoint(JSON.stringify({ v: 2, pets: [] }))).toBeNull();
    expect(parseTamaCheckpoint(JSON.stringify({ v: 1 }))).toBeNull();
  });
});

describe('mergeCheckpointPets — positions stay device-local', () => {
  const spawn = () => ({ x: 500, y: 400, heading: 1 });

  it('keeps where a pet already stands on THIS screen', () => {
    const cp = toTamaCheckpoint(state({ pets: [pet({ plays: 99 })] }), 1);
    const merged = mergeCheckpointPets(cp, [{ id: 'p1', x: 120, y: 240, heading: 2, bloat: 0.1, boostUntil: 7 }], spawn);
    expect(merged[0]).toMatchObject({ x: 120, y: 240, heading: 2, bloat: 0.1, boostUntil: 7, plays: 99 });
  });

  it('spawns a pet arriving on this device for the first time', () => {
    const cp = toTamaCheckpoint(state({ pets: [pet({ id: 'newbie' })] }), 1);
    expect(mergeCheckpointPets(cp, [], spawn)[0]).toMatchObject({ id: 'newbie', x: 500, y: 400 });
  });

  it('drops pets released on the other device', () => {
    const cp = toTamaCheckpoint(state({ pets: [pet({ id: 'kept' })] }), 1);
    const merged = mergeCheckpointPets(cp, [{ id: 'kept' }, { id: 'gone' }], spawn);
    expect(merged.map((p) => p.id)).toEqual(['kept']);
  });
});

describe('sync payload wiring', () => {
  beforeEach(() => localStorage.clear());

  it('the checkpoint key rides in the synced blob', () => {
    expect(SYNC_KEYS).toContain(TAMA_KEY);
    writeTamaCheckpoint(toTamaCheckpoint(state(), 42));
    expect(collectSyncData()[TAMA_KEY]).toBeTruthy();
  });

  it('the live once-a-second blob does NOT', () => {
    expect(SYNC_KEYS).not.toContain('24h-tamagotchi');
  });

  it('an older cloud blob without the key leaves the local pet alone', () => {
    const cp = toTamaCheckpoint(state(), 42);
    writeTamaCheckpoint(cp);
    applySyncData({ '24h-circle-planner.days': '{}' });
    expect(readTamaCheckpoint()).toEqual(cp);
  });
});
