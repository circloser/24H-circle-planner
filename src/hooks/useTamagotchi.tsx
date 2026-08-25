/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';

/**
 * A tiny line-art tamagotchi that roams the app background. Self-contained:
 * stats + growth + poop + sleep + death, persisted to localStorage with
 * offline-time correction (stats catch up for the time the tab was closed).
 * Up to 3 pets. Rendered by TamagotchiLayer; controlled by the retro device UI.
 */

export type Species = 'chick' | 'duck' | 'rabbit' | 'bear' | 'puppy' | 'cat' | 'mole';
export const SPECIES: Species[] = ['chick', 'duck', 'rabbit', 'bear', 'puppy', 'cat', 'mole'];

export type Phase = 'egg' | 'amoeba' | 'baby' | 'adult' | 'dead';

export interface Poop {
  id: string;
  x: number; // viewport px
  y: number;
}

export interface Pet {
  id: string;
  species: Species; // decided when the egg is laid; shown from the baby stage
  phase: Phase;
  bornAt: number; // egg laid (ms epoch)
  hatchAt: number; // egg → amoeba (bornAt + 1h)
  hatchedAt: number | null; // when it became an amoeba (growth clock start)
  x: number;
  y: number;
  heading: number; // radians, for wandering
  hunger: number; // 0–100
  happiness: number;
  hygiene: number;
  energy: number;
  sleeping: boolean;
  poops: Poop[];
  lastPoopAt: number; // ms
  hungerZeroSince: number | null; // death timer
}

interface Stored {
  version: 1;
  on: boolean;
  pets: Pet[];
  selectedId: string | null;
  savedAt: number;
}

const KEY = '24h-tamagotchi';
export const MAX_PETS = 3;

// ── Timings (ms) ────────────────────────────────────────────────────────────
export const HATCH_MS = 60 * 60 * 1000; // egg → amoeba: 1 hour (spec)
const AMOEBA_MS = 20 * 60 * 1000; // amoeba → baby
const BABY_MS = 2 * 60 * 60 * 1000; // baby → adult
const POOP_EVERY = 3 * 60 * 1000; // 3 min → poop (-20 hygiene)
const DEATH_AFTER = 30 * 60 * 1000; // hunger 0 sustained → dead
const TICK = 1000; // ms

// ── Rates (per ms) ──────────────────────────────────────────────────────────
const HUNGER_RATE = 2 / 60000; // -2 / min
const HAPPY_RATE = 1 / 60000; // -1 / min
const ENERGY_RECOVER = 2 / 1000; // +2 / s while sleeping

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const uid = () => Math.random().toString(36).slice(2, 9);

function spawnXY() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  return { x: rand(120, Math.max(160, w - 160)), y: rand(120, Math.max(180, h - 160)) };
}

export function newEgg(): Pet {
  const now = Date.now();
  const { x, y } = spawnXY();
  return {
    id: uid(),
    species: SPECIES[Math.floor(Math.random() * SPECIES.length)],
    phase: 'egg',
    bornAt: now,
    hatchAt: now + HATCH_MS,
    hatchedAt: null,
    x, y,
    heading: rand(0, Math.PI * 2),
    hunger: 80,
    happiness: 80,
    hygiene: 100,
    energy: 100,
    sleeping: false,
    poops: [],
    lastPoopAt: now,
    hungerZeroSince: null,
  };
}

/** Advance one pet by `dt` ms of real time (used live + for offline catch-up). */
function advance(pet: Pet, now: number, dt: number): Pet {
  if (pet.phase === 'dead') return pet;
  const p = { ...pet };

  // Egg: only hatch, no stats yet.
  if (p.phase === 'egg') {
    if (now >= p.hatchAt) {
      p.phase = 'amoeba';
      p.hatchedAt = now;
      p.lastPoopAt = now;
    }
    return p;
  }

  // Growth transitions (from hatch clock).
  const age = p.hatchedAt ? now - p.hatchedAt : 0;
  if (p.phase === 'amoeba' && age >= AMOEBA_MS) p.phase = 'baby';
  if (p.phase === 'baby' && age >= BABY_MS) p.phase = 'adult';

  // Stat decay.
  p.hunger = clamp(p.hunger - HUNGER_RATE * dt);
  p.happiness = clamp(p.happiness - HAPPY_RATE * dt);
  if (p.sleeping) p.energy = clamp(p.energy + ENERGY_RECOVER * dt);

  // Poop generation (discrete, catches up across long gaps but caps count).
  while (now - p.lastPoopAt >= POOP_EVERY) {
    p.lastPoopAt += POOP_EVERY;
    if (p.poops.length < 6) {
      p.poops = [...p.poops, { id: uid(), x: p.x + rand(-26, 26), y: p.y + rand(18, 40) }];
      p.hygiene = clamp(p.hygiene - 20);
    }
  }

  // Death: hunger at 0 for DEATH_AFTER.
  if (p.hunger <= 0) {
    if (p.hungerZeroSince == null) p.hungerZeroSince = now;
    else if (now - p.hungerZeroSince >= DEATH_AFTER) p.phase = 'dead';
  } else {
    p.hungerZeroSince = null;
  }

  return p;
}

function load(): Stored {
  const base: Stored = { version: 1, on: false, pets: [], selectedId: null, savedAt: Date.now() };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const s = JSON.parse(raw) as Stored;
    if (!s || s.version !== 1 || !Array.isArray(s.pets)) return base;
    // Offline correction: advance every pet by the elapsed closed time.
    const now = Date.now();
    const dt = Math.max(0, now - (s.savedAt || now));
    const pets = s.pets.map((pet) => advance(pet, now, dt));
    return { ...s, pets, savedAt: now };
  } catch {
    return base;
  }
}

interface TamagotchiApi {
  on: boolean;
  pets: Pet[];
  selectedId: string | null;
  toggle: () => void;
  select: (id: string) => void;
  addEgg: () => void;
  release: (id: string) => void;
  feed: (id: string) => void;
  play: (id: string) => void;
  clean: (id: string) => void;
  toggleSleep: (id: string) => void;
  moveTo: (id: string, x: number, y: number) => void;
  setDragging: (id: string, on: boolean) => void;
}

const Ctx = createContext<TamagotchiApi | null>(null);

export function TamagotchiProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Stored>(load);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Skip the wander step on the tick right after a user drag so it doesn't fight.
  const draggingRef = useRef<Set<string>>(new Set());

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
    } catch {
      /* storage full/unavailable */
    }
  }, [state]);

  // Live tick: decay + growth + wander, only while ON.
  useEffect(() => {
    if (!state.on) return;
    const bounds = () => ({ w: window.innerWidth, h: window.innerHeight });
    const timer = setInterval(() => {
      const now = Date.now();
      setState((s) => {
        const { w, h } = bounds();
        const pets = s.pets.map((pet) => {
          let p = advance(pet, now, TICK);
          // Wander: adults/babies/amoebas drift; eggs, sleepers, dead, dragged stay put.
          const canMove = p.phase !== 'egg' && p.phase !== 'dead' && !p.sleeping && !draggingRef.current.has(p.id);
          if (canMove) {
            if (Math.random() < 0.15) p.heading = rand(0, Math.PI * 2);
            const speed = p.phase === 'amoeba' ? 8 : 13;
            let nx = p.x + Math.cos(p.heading) * speed;
            let ny = p.y + Math.sin(p.heading) * speed;
            const minX = 60, maxX = Math.max(80, w - 90), minY = 90, maxY = Math.max(120, h - 90);
            if (nx < minX || nx > maxX) { p.heading = Math.PI - p.heading; nx = Math.max(minX, Math.min(maxX, nx)); }
            if (ny < minY || ny > maxY) { p.heading = -p.heading; ny = Math.max(minY, Math.min(maxY, ny)); }
            p = { ...p, x: nx, y: ny };
          }
          return p;
        });
        return { ...s, pets };
      });
    }, TICK);
    return () => clearInterval(timer);
  }, [state.on]);

  const mutate = useCallback((id: string, fn: (p: Pet) => Pet) => {
    setState((s) => ({ ...s, pets: s.pets.map((p) => (p.id === id ? fn(p) : p)) }));
  }, []);

  const api: TamagotchiApi = {
    on: state.on,
    pets: state.pets,
    selectedId: state.selectedId,
    toggle: useCallback(() => setState((s) => ({ ...s, on: !s.on })), []),
    select: useCallback((id) => setState((s) => ({ ...s, selectedId: id })), []),
    addEgg: useCallback(() => setState((s) => {
      if (s.pets.length >= MAX_PETS) return s;
      const egg = newEgg();
      return { ...s, pets: [...s.pets, egg], selectedId: egg.id, on: true };
    }), []),
    release: useCallback((id) => setState((s) => {
      const pets = s.pets.filter((p) => p.id !== id);
      return { ...s, pets, selectedId: s.selectedId === id ? (pets[0]?.id ?? null) : s.selectedId };
    }), []),
    feed: useCallback((id) => mutate(id, (p) => (p.phase === 'egg' || p.phase === 'dead' || p.sleeping ? p : { ...p, hunger: clamp(p.hunger + 25) })), [mutate]),
    play: useCallback((id) => mutate(id, (p) => (p.phase === 'egg' || p.phase === 'dead' || p.sleeping || p.energy < 10 ? p : { ...p, happiness: clamp(p.happiness + 20), energy: clamp(p.energy - 10) })), [mutate]),
    clean: useCallback((id) => mutate(id, (p) => ({ ...p, hygiene: 100, poops: [] })), [mutate]),
    toggleSleep: useCallback((id) => mutate(id, (p) => (p.phase === 'egg' || p.phase === 'dead' ? p : { ...p, sleeping: !p.sleeping })), [mutate]),
    moveTo: useCallback((id, x, y) => mutate(id, (p) => ({ ...p, x, y })), [mutate]),
    setDragging: useCallback((id, dragging) => {
      if (dragging) draggingRef.current.add(id);
      else draggingRef.current.delete(id);
    }, []),
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useTamagotchi(): TamagotchiApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTamagotchi must be used within TamagotchiProvider');
  return ctx;
}
