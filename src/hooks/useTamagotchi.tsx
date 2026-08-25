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
  bloat: number; // 0..MAX_BLOAT — temporary size bump from overfeeding, decays
  boostUntil: number; // ms — dashes away faster until this time (play reaction)
}

interface Stored {
  version: 1;
  on: boolean;
  pets: Pet[];
  selectedId: string | null;
  savedAt: number;
}

const KEY = '24h-tamagotchi';
export const MAX_PETS = 6;
/** A new egg can only be laid once every existing egg has hatched. */
export const hasUnhatchedEgg = (pets: Pet[]): boolean => pets.some((p) => p.phase === 'egg');

// ── Timings (ms) ────────────────────────────────────────────────────────────
/** Egg → amoeba delay by birth order — progressively longer for later pets
 *  (1min · 10min · 1h · 3h · 6h · 12h). A new egg can only be laid once the
 *  previous one has hatched, so the list only needs MAX_PETS entries. */
export const HATCH_DELAYS = [
  60 * 1000,
  10 * 60 * 1000,
  60 * 60 * 1000,
  3 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
];
const AMOEBA_MS = 20 * 60 * 1000; // amoeba → baby
const BABY_MS = 2 * 60 * 60 * 1000; // baby → adult
const POOP_EVERY = 3 * 60 * 1000; // 3 min → poop (-20 hygiene)
const DEATH_AFTER = 3 * 24 * 60 * 60 * 1000; // hunger 0 sustained 3 days → dead
const TICK = 1000; // ms

// ── Rates (per ms) ──────────────────────────────────────────────────────────
const HUNGER_RATE = 2 / 60000; // -2 / min
const HAPPY_RATE = 1 / 60000; // -1 / min
const ENERGY_RECOVER = 2 / 1000; // +2 / s while sleeping

// ── Overfeed "bloat" (temporary size bump) ───────────────────────────────────
const MAX_BLOAT = 0.3; // up to +30% size when very full
const BLOAT_PER_FEED = 0.06; // each feeding puffs up a little…
const BLOAT_DECAY = MAX_BLOAT / (12 * 60 * 1000); // …and eases back over ~12 min

// ── Flocking (boids-lite): pets herd together as they roam ───────────────────
const NEIGHBOR_R = 200; // consider pets within this radius
const SEP_R = 54; // but push apart when closer than this
const COH_W = 0.35; // cohesion — steer toward the group centre
const ALI_W = 0.5; // alignment — match the group heading
const SEP_W = 1.4; // separation — avoid crowding (strongest)

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const uid = () => Math.random().toString(36).slice(2, 9);

function spawnXY() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  // Spawn anywhere across the whole viewport (small edge margin).
  return { x: rand(50, Math.max(80, w - 50)), y: rand(80, Math.max(120, h - 50)) };
}

export function newEgg(order = 0): Pet {
  const now = Date.now();
  const { x, y } = spawnXY();
  const delay = HATCH_DELAYS[order] ?? HATCH_DELAYS[HATCH_DELAYS.length - 1];
  return {
    id: uid(),
    species: SPECIES[Math.floor(Math.random() * SPECIES.length)],
    phase: 'egg',
    bornAt: now,
    hatchAt: now + delay,
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
    bloat: 0,
    boostUntil: 0,
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
  // Overfeed bloat eases back toward normal size (live + offline catch-up).
  if ((p.bloat ?? 0) > 0) p.bloat = Math.max(0, (p.bloat ?? 0) - BLOAT_DECAY * dt);

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
  /** Whether the control console popup is open (transient UI, not persisted). */
  menuOpen: boolean;
  pets: Pet[];
  selectedId: string | null;
  toggle: () => void;
  toggleMenu: () => void;
  closeMenu: () => void;
  select: (id: string) => void;
  addEgg: () => void;
  release: (id: string) => void;
  feed: (id: string) => void;
  play: (id: string) => void;
  /** Remove one poop (tap-to-clean) and nudge hygiene back up. */
  removePoop: (petId: string, poopId: string) => void;
  toggleSleep: (id: string) => void;
  moveTo: (id: string, x: number, y: number) => void;
  setDragging: (id: string, on: boolean) => void;
}

const Ctx = createContext<TamagotchiApi | null>(null);

export function TamagotchiProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Stored>(load);
  // Console popup visibility — transient UI, deliberately NOT persisted so the
  // menu never reopens itself on reload; the roaming pets (state.on) do persist.
  const [menuOpen, setMenuOpen] = useState(false);
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

  // Live tick: decay + growth + flocking wander, only while ON.
  useEffect(() => {
    if (!state.on) return;
    const canMove = (p: Pet) => p.phase !== 'egg' && p.phase !== 'dead' && !p.sleeping && !draggingRef.current.has(p.id);
    const timer = setInterval(() => {
      const now = Date.now();
      // Movement pauses entirely while the tab is hidden — no drifting or big
      // straight-line "catch-up" jump when you come back. Stats still advance.
      const moving = typeof document === 'undefined' || !document.hidden;
      const w = window.innerWidth, h = window.innerHeight;
      setState((s) => {
        const flock = s.pets.filter(canMove); // pre-step positions for the herd
        const pets = s.pets.map((pet) => {
          const p = advance(pet, now, TICK);
          if (!moving || !canMove(p)) return p;
          // ── Flocking: steer by nearby pets (cohesion + alignment + separation) ──
          let hx = Math.cos(p.heading), hy = Math.sin(p.heading);
          let cohX = 0, cohY = 0, aliX = 0, aliY = 0, sepX = 0, sepY = 0, n = 0, sn = 0;
          for (const o of flock) {
            if (o.id === p.id) continue;
            const dx = o.x - p.x, dy = o.y - p.y;
            const d = Math.hypot(dx, dy);
            if (d < NEIGHBOR_R) {
              cohX += o.x; cohY += o.y; aliX += Math.cos(o.heading); aliY += Math.sin(o.heading); n++;
              if (d > 0 && d < SEP_R) { sepX -= dx / d; sepY -= dy / d; sn++; }
            }
          }
          if (n > 0) {
            const cx = cohX / n - p.x, cy = cohY / n - p.y, cl = Math.hypot(cx, cy) || 1;
            const al = Math.hypot(aliX, aliY) || 1;
            hx += (cx / cl) * COH_W + (aliX / al) * ALI_W;
            hy += (cy / cl) * COH_W + (aliY / al) * ALI_W;
          }
          if (sn > 0) { const sl = Math.hypot(sepX, sepY) || 1; hx += (sepX / sl) * SEP_W; hy += (sepY / sl) * SEP_W; }
          hx += (Math.random() - 0.5) * 0.35; hy += (Math.random() - 0.5) * 0.35; // wander jitter
          let heading = Math.atan2(hy, hx);
          const speed = (p.phase === 'amoeba' ? 8 : 13) * (now < (p.boostUntil ?? 0) ? 2.4 : 1);
          let nx = p.x + Math.cos(heading) * speed;
          let ny = p.y + Math.sin(heading) * speed;
          // Roam the whole browser window (edge margins clear the sticky header + edges).
          const minX = 36, maxX = Math.max(60, w - 36), minY = 70, maxY = Math.max(110, h - 36);
          if (nx < minX || nx > maxX) { heading = Math.PI - heading; nx = Math.max(minX, Math.min(maxX, nx)); }
          if (ny < minY || ny > maxY) { heading = -heading; ny = Math.max(minY, Math.min(maxY, ny)); }
          return { ...p, x: nx, y: ny, heading };
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
    menuOpen,
    pets: state.pets,
    selectedId: state.selectedId,
    toggle: useCallback(() => setState((s) => ({ ...s, on: !s.on })), []),
    toggleMenu: useCallback(() => setMenuOpen((o) => !o), []),
    closeMenu: useCallback(() => setMenuOpen(false), []),
    select: useCallback((id) => setState((s) => ({ ...s, selectedId: id })), []),
    addEgg: useCallback(() => setState((s) => {
      // Only one egg at a time: must wait for the current egg to hatch.
      if (s.pets.length >= MAX_PETS || hasUnhatchedEgg(s.pets)) return s;
      const egg = newEgg(s.pets.length); // birth order → hatch delay (1min/10min/1h…)
      return { ...s, pets: [...s.pets, egg], selectedId: egg.id, on: true };
    }), []),
    release: useCallback((id) => setState((s) => {
      const pets = s.pets.filter((p) => p.id !== id);
      return { ...s, pets, selectedId: s.selectedId === id ? (pets[0]?.id ?? null) : s.selectedId };
    }), []),
    feed: useCallback((id) => mutate(id, (p) => (p.phase === 'egg' || p.phase === 'dead' || p.sleeping ? p : { ...p, hunger: clamp(p.hunger + 25), bloat: Math.min(MAX_BLOAT, (p.bloat ?? 0) + BLOAT_PER_FEED) })), [mutate]),
    // Playing also makes the pet dash off to the side for a moment (boostUntil +
    // a fresh random heading) — the "runs away happily" reaction.
    play: useCallback((id) => mutate(id, (p) => (p.phase === 'egg' || p.phase === 'dead' || p.sleeping || p.energy < 10 ? p : { ...p, happiness: clamp(p.happiness + 20), energy: clamp(p.energy - 10), heading: rand(0, Math.PI * 2), boostUntil: Date.now() + 1400 })), [mutate]),
    removePoop: useCallback((petId, poopId) => mutate(petId, (p) => ({
      ...p,
      poops: p.poops.filter((q) => q.id !== poopId),
      hygiene: clamp(p.hygiene + 20), // each poop cost 20 → tapping it restores 20
    })), [mutate]),
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
