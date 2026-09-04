/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import {
  TAMA_SYNC_EVENT,
  mergeCheckpointPets,
  readTamaCheckpoint,
  tamaSignature,
  toTamaCheckpoint,
  writeTamaCheckpoint,
} from '@/lib/sync/tamaSync';

/**
 * A tiny line-art tamagotchi that roams the app background. Self-contained:
 * stats + growth + poop + sleep + death, persisted to localStorage with
 * offline-time correction (stats catch up for the time the tab was closed).
 * Up to 3 pets. Rendered by TamagotchiLayer; controlled by the retro device UI.
 */

export type Species = 'chick' | 'duck' | 'rabbit' | 'bear' | 'puppy' | 'cat' | 'mole';
export const SPECIES: Species[] = ['chick', 'duck', 'rabbit', 'bear', 'puppy', 'cat', 'mole'];

export type Phase = 'egg' | 'amoeba' | 'baby' | 'adult' | 'super' | 'dead';

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
  energy: number;
  sleeping: boolean;
  /** Total play interactions (taps + drags) — drives evolution (EVOLVE_PLAYS). */
  plays: number;
  /** Stage-5 badge: naming a coloured (super) pet shows this under it as it roams. */
  name: string | null;
  lastPoopAt: number; // ms — this pet's own poop timer (poops go to the shared pile)
  /** ms until the NEXT poop (random POOP_MIN..POOP_MAX, re-rolled per drop).
   *  Optional: older saves default a fresh roll in poopStep. */
  nextPoopIn?: number;
  hungerZeroSince: number | null; // death timer
  bloat: number; // 0..MAX_BLOAT — temporary size bump from overfeeding, decays
  boostUntil: number; // ms — dashes away faster until this time (play reaction)
}

interface Stored {
  version: 1;
  on: boolean;
  pets: Pet[];
  selectedId: string | null;
  hygiene: number; // SHARED across all pets (0–100)
  poops: Poop[]; // SHARED pile — any pet drops into it; each poop lowers hygiene
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
/** Play-driven evolution: TOTAL plays (taps + drags) to reach each stage.
 *  amoeba(1) → baby(2) at 100 · → adult(3) at 300 · → super/coloured(4) at 500.
 *  Stage 5 = naming a super pet (see rename). Time no longer evolves pets. */
export const EVOLVE_PLAYS = { baby: 100, adult: 300, super: 500 } as const;
const POOP_MIN = 60 * 60 * 1000; // poops come no closer than 1h apart…
const POOP_MAX = 150 * 60 * 1000; // …and up to 2.5h — interval re-rolled each time
const DEATH_AFTER = 3 * 24 * 60 * 60 * 1000; // hunger 0 sustained 3 days → dead
const TICK = 1000; // ms

// ── Rates (per ms) ──────────────────────────────────────────────────────────
const HUNGER_RATE = 2 / 60000; // -2 / min
const HAPPY_RATE = 1 / 60000; // -1 / min
const ENERGY_RECOVER = 2 / 1000; // +2 / s while sleeping
const LOW_ENERGY = 20; // below this → auto-nap (+ ⚡); recharges to 100 → auto-wake

/** How much one feeding restores. */
const FEED_AMOUNT = 10;
/**
 * A pet at or above this refuses food. Hunger drains continuously, so it sits at
 * exactly 100 for only one tick — without a band, a visibly FULL pet could still
 * be fed over and over, and because feeding also counts as a play interaction
 * that let the evolution counter be farmed by mashing the food button. At
 * -2/min the gauge takes ~2.5 min to fall back under the band, so every feed
 * that does go through restores a real amount.
 */
export const FULL_HUNGER = 100 - FEED_AMOUNT / 2;

/**
 * Whether a pet will accept food right now. Shared by the feed action and the
 * feed button so the button can never offer a feeding the action would drop
 * (a silent no-op reads as a broken button).
 */
export function canFeed(p: Pick<Pet, 'phase' | 'sleeping' | 'hunger'> | undefined): boolean {
  if (!p) return false;
  return p.phase !== 'egg' && p.phase !== 'dead' && !p.sleeping && p.hunger < FULL_HUNGER;
}

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
    energy: 100,
    sleeping: false,
    plays: 0,
    name: null,
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

  // Growth is PLAY-driven, not time-driven: evolving takes attention (taps +
  // drags accumulate pet.plays; thresholds in EVOLVE_PLAYS).
  const plays = p.plays ?? 0;
  if (p.phase === 'amoeba' && plays >= EVOLVE_PLAYS.baby) p.phase = 'baby';
  if (p.phase === 'baby' && plays >= EVOLVE_PLAYS.adult) p.phase = 'adult';
  if (p.phase === 'adult' && plays >= EVOLVE_PLAYS.super) p.phase = 'super';

  // Stat decay.
  p.hunger = clamp(p.hunger - HUNGER_RATE * dt);
  p.happiness = clamp(p.happiness - HAPPY_RATE * dt);
  if (p.sleeping) p.energy = clamp(p.energy + ENERGY_RECOVER * dt);
  // Auto sleep when exhausted (stops moving, shows ⚡), auto-wake once fully
  // recharged → resumes activity.
  // Exhausted → auto-nap. It recharges to full but STAYS asleep until the user
  // taps it awake (no auto-wake).
  if (!p.sleeping && p.energy < LOW_ENERGY) p.sleeping = true;
  // Overfeed bloat eases back toward normal size (live + offline catch-up).
  if ((p.bloat ?? 0) > 0) p.bloat = Math.max(0, (p.bloat ?? 0) - BLOAT_DECAY * dt);

  // (Poop + hygiene are SHARED — handled by poopStep, not per pet.)

  // Death: hunger at 0 for DEATH_AFTER.
  if (p.hunger <= 0) {
    if (p.hungerZeroSince == null) p.hungerZeroSince = now;
    else if (now - p.hungerZeroSince >= DEATH_AFTER) p.phase = 'dead';
  } else {
    p.hungerZeroSince = null;
  }

  return p;
}

const POOP_CAP = 8; // shared pile cap

/** SHARED poop generation: each awake pet drops into the ONE shared pile on its
 *  own ~3min timer, and every poop lowers the ONE shared hygiene. Runs live and
 *  for offline catch-up. Returns updated pets (lastPoopAt) + shared hygiene/poops. */
function poopStep(pets: Pet[], hygiene: number, poops: Poop[], now: number): { pets: Pet[]; hygiene: number; poops: Poop[] } {
  let h = hygiene;
  let pp = poops;
  const next = pets.map((pet) => {
    if (pet.phase === 'egg' || pet.phase === 'dead') return pet;
    // Sleeping pets don't poop — digestion pauses: keep the timer pinned to
    // `now` while asleep, so waking starts a fresh countdown (and an offline
    // catch-up over a sleeping pet drops nothing).
    if (pet.sleeping) return pet.lastPoopAt === now ? pet : { ...pet, lastPoopAt: now };
    let lastPoopAt = pet.lastPoopAt;
    let nextIn = pet.nextPoopIn ?? rand(POOP_MIN, POOP_MAX);
    while (now - lastPoopAt >= nextIn) {
      lastPoopAt += nextIn;
      nextIn = rand(POOP_MIN, POOP_MAX);
      if (pp.length < POOP_CAP) {
        pp = [...pp, { id: uid(), x: pet.x + rand(-26, 26), y: pet.y + rand(18, 40) }];
        h = clamp(h - 20);
      }
    }
    // Persist the roll too, or every step would re-roll it (and a per-tick
    // re-roll would skew intervals toward POOP_MIN).
    return lastPoopAt === pet.lastPoopAt && nextIn === pet.nextPoopIn ? pet : { ...pet, lastPoopAt, nextPoopIn: nextIn };
  });
  return { pets: next, hygiene: h, poops: pp };
}

function load(): Stored {
  const base: Stored = { version: 1, on: false, pets: [], selectedId: null, hygiene: 100, poops: [], savedAt: Date.now() };
  try {
    const raw = localStorage.getItem(KEY);
    // No stored state (first visit): quiet start — no auto egg, the pet stays
    // off until the visitor opens the 🐣 console and adds one themselves.
    if (!raw) return base;
    const s = JSON.parse(raw) as Stored;
    if (!s || s.version !== 1 || !Array.isArray(s.pets)) return base;
    const now = Date.now();
    const dt = Math.max(0, now - (s.savedAt || now));
    // Migrate legacy per-pet hygiene/poops (old storage shape) → shared globals.
    const legacy = s.pets as Array<Pet & { hygiene?: number; poops?: Poop[] }>;
    const hygiene0 = typeof s.hygiene === 'number' ? s.hygiene
      : (legacy.length ? Math.round(legacy.reduce((a, p) => a + (p.hygiene ?? 100), 0) / legacy.length) : 100);
    const poops0 = Array.isArray(s.poops) ? s.poops : legacy.flatMap((p) => p.poops ?? []);
    // Older saves predate plays/name — default them before advancing.
    const advanced = s.pets.map((pet) => advance({ ...pet, plays: pet.plays ?? 0, name: pet.name ?? null }, now, dt));
    const stepped = poopStep(advanced, hygiene0, poops0.slice(0, POOP_CAP), now);
    return { version: 1, on: !!s.on, selectedId: s.selectedId ?? null, pets: stepped.pets, hygiene: stepped.hygiene, poops: stepped.poops, savedAt: now };
  } catch {
    return base;
  }
}

interface TamagotchiApi {
  on: boolean;
  /** Whether the control console popup is open (transient UI, not persisted). */
  menuOpen: boolean;
  pets: Pet[];
  /** Shared across all pets — one hygiene level, one poop pile. */
  hygiene: number;
  poops: Poop[];
  selectedId: string | null;
  toggle: () => void;
  toggleMenu: () => void;
  closeMenu: () => void;
  select: (id: string) => void;
  addEgg: () => void;
  release: (id: string) => void;
  feed: (id: string) => void;
  play: (id: string) => void;
  /** Count a drag/throw as play (evolution progress) without the play reaction. */
  notePlay: (id: string) => void;
  /** Stage 5: name a super (coloured) pet — shown in tiny text as it roams. */
  rename: (id: string, name: string) => void;
  /** Remove one poop from the shared pile (tap-to-clean) → shared hygiene +20. */
  removePoop: (poopId: string) => void;
  toggleSleep: (id: string) => void;
  moveTo: (id: string, x: number, y: number) => void;
  setDragging: (id: string, on: boolean) => void;
  /** Constrain roaming to a small w×h box (mobile: pets live inside the LCD),
   *  or null for the full browser window (desktop). */
  setWorld: (world: { w: number; h: number } | null) => void;
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
  // null = roam the full browser window (desktop). Otherwise a small {w,h} box
  // the pets are confined to — mobile keeps them inside the console LCD.
  const worldRef = useRef<{ w: number; h: number } | null>(null);
  // Cross-device sync: the DISCRETE signature we last checkpointed. Seeded from
  // the loaded state (opening the app is not itself a change), then compared on
  // every state change so the once-a-second tick never writes a checkpoint.
  const lastSigRef = useRef<string>('');
  // Set while adopting a cloud checkpoint — that apply must not write one back.
  const adoptingRef = useRef(false);

  // Seed the signature BEFORE the persist effect below runs for the first time
  // (effects fire in declaration order), so a plain page load pushes nothing.
  useEffect(() => {
    lastSigRef.current = tamaSignature(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every change — the full local blob (positions included).
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
    } catch {
      /* storage full/unavailable */
    }

    // Cross-device checkpoint: written ONLY when something discrete happened
    // (pet added/released/renamed, fed or played with, hatched, evolved, died,
    // fell asleep, pooped, pile cleaned). Time passing rewrites the blob above
    // every second but must never touch this key — that is what keeps the pet
    // from pushing to the cloud on every tick. See lib/sync/tamaSync.
    const sig = tamaSignature(state);
    const adopting = adoptingRef.current;
    adoptingRef.current = false;
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;
    if (adopting) return; // this change CAME from the cloud — don't bounce it back
    writeTamaCheckpoint(toTamaCheckpoint(state, Date.now()));
  }, [state]);

  // A checkpoint arrived from another device (Pro sync applied it to storage) —
  // adopt it live: keep this screen's positions, replay the time since it was
  // written, and materialise the shared poop pile at local coordinates.
  useEffect(() => {
    const onSync = () => {
      const cp = readTamaCheckpoint();
      if (!cp) return;
      adoptingRef.current = true;
      setState((s) => {
        const now = Date.now();
        const dt = Math.max(0, now - cp.savedAt);
        // A pet arriving from another device lands inside the ACTIVE world (the
        // mobile terrarium, else the window) — same rule as a freshly laid egg.
        const world = worldRef.current;
        const spawn = () => ({
          ...(world ? { x: rand(20, world.w - 20), y: rand(20, world.h - 20) } : spawnXY()),
          heading: rand(0, Math.PI * 2),
        });
        // Strings come from our own writer, so the unions are safe here.
        const merged = mergeCheckpointPets(cp, s.pets, spawn) as unknown as Pet[];
        const pets = merged.map((p) => advance(p, now, dt));
        const spot = () => {
          const p = pets[Math.floor(Math.random() * pets.length)];
          return p ? { x: p.x + rand(-26, 26), y: p.y + rand(18, 40) } : spawnXY();
        };
        // Poops travel as a COUNT (their coordinates are this screen's pixels):
        // keep the ones already drawn, then trim or top up to match.
        const poops = cp.poops <= s.poops.length
          ? s.poops.slice(0, cp.poops)
          : [...s.poops, ...Array.from({ length: cp.poops - s.poops.length }, () => ({ id: uid(), ...spot() }))];
        const selectedId = pets.some((p) => p.id === s.selectedId) ? s.selectedId : (pets[0]?.id ?? null);
        return { ...s, on: cp.on, hygiene: cp.hygiene, pets, poops, selectedId, savedAt: now };
      });
    };
    window.addEventListener(TAMA_SYNC_EVENT, onSync);
    return () => window.removeEventListener(TAMA_SYNC_EVENT, onSync);
  }, []);

  // Live tick: decay + growth + flocking wander, only while ON.
  useEffect(() => {
    if (!state.on) return;
    const canMove = (p: Pet) => p.phase !== 'egg' && p.phase !== 'dead' && !p.sleeping && !draggingRef.current.has(p.id);
    const timer = setInterval(() => {
      const now = Date.now();
      // Movement pauses entirely while the tab is hidden — no drifting or big
      // straight-line "catch-up" jump when you come back. Stats still advance.
      const moving = typeof document === 'undefined' || !document.hidden;
      const world = worldRef.current; // null = full window, else a small LCD box
      const w = world ? world.w : window.innerWidth;
      const h = world ? world.h : window.innerHeight;
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
          // Wander jitter. A confined world gets far LESS of it: the same ±20°
          // per second that reads as pleasant wandering across a whole window
          // becomes visible trembling inside a 240×150 box.
          const jitter = world ? 0.1 : 0.35;
          hx += (Math.random() - 0.5) * jitter; hy += (Math.random() - 0.5) * jitter;
          let heading = Math.atan2(hy, hx);
          // Confined worlds (mobile LCD) are tiny, so pets drift slowly there —
          // a couple of px per second, which the 1s CSS transition renders as a
          // continuous glide rather than a step.
          const speed = (p.phase === 'amoeba' ? 8 : 13) * (now < (p.boostUntil ?? 0) ? 3.8 : 1) * (world ? 0.18 : 1);
          let nx = p.x + Math.cos(heading) * speed;
          let ny = p.y + Math.sin(heading) * speed;
          // Bounds: a small margin inside the LCD box, or the whole window (with
          // edge margins that clear the sticky header + screen edges) on desktop.
          const m = world ? 20 : 0;
          const minX = world ? m : 36, maxX = world ? w - m : Math.max(60, w - 36);
          const minY = world ? m : 70, maxY = world ? h - m : Math.max(110, h - 36);
          const hitX = nx < minX || nx > maxX;
          const hitY = ny < minY || ny > maxY;
          nx = Math.max(minX, Math.min(maxX, nx));
          ny = Math.max(minY, Math.min(maxY, ny));
          if (hitX || hitY) {
            if (world) {
              // In the tiny terrarium a mirror bounce lets a pet graze along the
              // wall for many steps, which at this scale looks like vibrating in
              // place. Turn it back toward the middle (with a little spread) so
              // it always leaves the edge on the next step.
              const toCx = (minX + maxX) / 2 - nx;
              const toCy = (minY + maxY) / 2 - ny;
              heading = Math.atan2(toCy, toCx) + rand(-0.4, 0.4);
            } else {
              if (hitX) heading = Math.PI - heading;
              if (hitY) heading = -heading;
            }
          }
          return { ...p, x: nx, y: ny, heading };
        });
        const stepped = poopStep(pets, s.hygiene, s.poops, now); // shared hygiene/poops
        return { ...s, pets: stepped.pets, hygiene: stepped.hygiene, poops: stepped.poops };
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
    hygiene: state.hygiene,
    poops: state.poops,
    selectedId: state.selectedId,
    toggle: useCallback(() => setState((s) => ({ ...s, on: !s.on })), []),
    toggleMenu: useCallback(() => setMenuOpen((o) => !o), []),
    closeMenu: useCallback(() => setMenuOpen(false), []),
    select: useCallback((id) => setState((s) => ({ ...s, selectedId: id })), []),
    addEgg: useCallback(() => setState((s) => {
      // Only one egg at a time: must wait for the current egg to hatch.
      if (s.pets.length >= MAX_PETS || hasUnhatchedEgg(s.pets)) return s;
      let egg = newEgg(s.pets.length); // birth order → hatch delay (1min/10min/1h…)
      const world = worldRef.current; // confined? spawn the egg inside the box
      if (world) egg = { ...egg, x: rand(20, world.w - 20), y: rand(20, world.h - 20) };
      return { ...s, pets: [...s.pets, egg], selectedId: egg.id, on: true };
    }), []),
    release: useCallback((id) => setState((s) => {
      const pets = s.pets.filter((p) => p.id !== id);
      return { ...s, pets, selectedId: s.selectedId === id ? (pets[0]?.id ?? null) : s.selectedId };
    }), []),
    // Feeding fills a modest +10 and counts as a play interaction too (evolution).
    // A pet that is already full turns the food down: no hunger, no play credit
    // and no bloat, so the evolution counter can't be farmed on a full stomach.
    feed: useCallback((id) => mutate(id, (p) => (canFeed(p) ? { ...p, hunger: clamp(p.hunger + FEED_AMOUNT), plays: (p.plays ?? 0) + 1, bloat: Math.min(MAX_BLOAT, (p.bloat ?? 0) + BLOAT_PER_FEED) } : p)), [mutate]),
    // Playing also makes the pet dash off to the side for a moment (boostUntil +
    // a fresh random heading) — the "runs away happily" reaction.
    // -3 energy per play: 100 → the LOW_ENERGY(20) auto-nap after ~26 plays.
    play: useCallback((id) => mutate(id, (p) => (p.phase === 'egg' || p.phase === 'dead' || p.sleeping || p.energy < 3 ? p : { ...p, plays: (p.plays ?? 0) + 1, happiness: clamp(p.happiness + 20), energy: clamp(p.energy - 3), heading: rand(0, Math.PI * 2), boostUntil: Date.now() + 2400 })), [mutate]),
    // A drag/throw counts toward evolution too, without the happiness/dash
    // reaction (and not while asleep — repositioning a sleeper isn't play).
    notePlay: useCallback((id) => mutate(id, (p) => (p.phase === 'egg' || p.phase === 'dead' || p.sleeping ? p : { ...p, plays: (p.plays ?? 0) + 1 })), [mutate]),
    rename: useCallback((id, name) => mutate(id, (p) => (p.phase === 'super' ? { ...p, name: name.trim().slice(0, 12) || null } : p)), [mutate]),
    removePoop: useCallback((poopId) => setState((s) => ({
      ...s,
      poops: s.poops.filter((q) => q.id !== poopId),
      hygiene: clamp(s.hygiene + 20), // each poop cost 20 shared hygiene → restore 20
    })), []),
    toggleSleep: useCallback((id) => mutate(id, (p) => (p.phase === 'egg' || p.phase === 'dead' ? p : { ...p, sleeping: !p.sleeping })), [mutate]),
    moveTo: useCallback((id, x, y) => mutate(id, (p) => ({ ...p, x, y })), [mutate]),
    setDragging: useCallback((id, dragging) => {
      if (dragging) draggingRef.current.add(id);
      else draggingRef.current.delete(id);
    }, []),
    setWorld: useCallback((world) => { worldRef.current = world; }, []),
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useTamagotchi(): TamagotchiApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTamagotchi must be used within TamagotchiProvider');
  return ctx;
}
