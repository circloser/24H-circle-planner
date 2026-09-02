/**
 * Tamagotchi cross-device sync — the CHECKPOINT key.
 *
 * The pet's live state (`24h-tamagotchi`) is rewritten every second: positions,
 * headings and the continuously decaying stats all move on the tick. Syncing
 * that blob directly would push to the cloud once a second and ping-pong
 * forever, so it stays device-local and a separate, much smaller CHECKPOINT
 * (`24h-tamagotchi.sync`) is what travels:
 *
 *  - It holds only what a pet IS (identity, phase, plays, name, sleep, the
 *    stats + `savedAt` at the moment of writing) — never where it happens to be
 *    standing on this screen. Positions are viewport-specific and each device
 *    keeps its own (existing pets stay put, new ones spawn locally).
 *  - It is written ONLY when the DISCRETE signature changes (see
 *    `tamaSignature`): a pet added/released/renamed, fed or played with (plays),
 *    hatched/evolved/died, fell asleep, pooped, or the pile was cleaned. Time
 *    passing alone never writes it — which is exactly what keeps this loop-free
 *    (the same role byte-stability plays for the other synced widget keys).
 *  - Reading it back replays the elapsed time (`now - savedAt`) through the same
 *    offline catch-up the local load already does, so a pet fed on the phone is
 *    correctly hungrier by the time the laptop shows it.
 *
 * Two tabs open at once can each drop a poop before the other's checkpoint
 * lands, so the pile can briefly double-count; last write wins and it settles.
 * That is a deliberate trade — a pet toy does not warrant CRDT machinery.
 */

/** The synced checkpoint key (its own namespace, like `24h-news.windows`). */
export const TAMA_KEY = '24h-tamagotchi.sync';
/** Fired after a checkpoint arrives from the cloud (adopted live, no reload). */
export const TAMA_SYNC_EVENT = '24h:tama-synced';

/** The per-pet fields that travel (structurally satisfied by the hook's `Pet`). */
export interface TamaPetLike {
  id: string;
  species: string;
  phase: string;
  bornAt: number;
  hatchAt: number;
  hatchedAt: number | null;
  hunger: number;
  happiness: number;
  energy: number;
  sleeping: boolean;
  plays: number;
  name: string | null;
  lastPoopAt: number;
  nextPoopIn?: number;
  hungerZeroSince: number | null;
}

/** The shared state the checkpoint is derived from (the hook's `Stored`). */
export interface TamaStateLike {
  on: boolean;
  hygiene: number;
  pets: readonly TamaPetLike[];
  /** Only the COUNT travels — poop coordinates are viewport pixels. */
  poops: readonly unknown[];
}

export interface TamaCheckpoint {
  v: 1;
  /** When this checkpoint was taken; elapsed time is replayed on the receiver. */
  savedAt: number;
  on: boolean;
  hygiene: number;
  poops: number;
  pets: TamaPetLike[];
}

/**
 * The DISCRETE part of the state — everything that does not drift with time.
 * A change here means something actually happened, and only then is a new
 * checkpoint written. Positions and the continuously decaying stats (hunger,
 * happiness, energy) are deliberately absent: they move every tick, and their
 * current values ride along in the checkpoint whenever a discrete change fires.
 */
export function tamaSignature(s: TamaStateLike): string {
  return JSON.stringify([
    s.on,
    Math.round(s.hygiene),
    s.poops.length,
    s.pets.map((p) => [
      p.id,
      p.phase,
      p.plays ?? 0,
      p.name ?? '',
      p.sleeping ? 1 : 0,
      p.lastPoopAt,
      p.nextPoopIn ?? 0,
      p.hungerZeroSince ?? 0,
    ]),
  ]);
}

export function toTamaCheckpoint(s: TamaStateLike, now: number = Date.now()): TamaCheckpoint {
  return {
    v: 1,
    savedAt: now,
    on: s.on,
    hygiene: s.hygiene,
    poops: s.poops.length,
    pets: s.pets.map((p) => ({
      id: p.id,
      species: p.species,
      phase: p.phase,
      bornAt: p.bornAt,
      hatchAt: p.hatchAt,
      hatchedAt: p.hatchedAt ?? null,
      hunger: p.hunger,
      happiness: p.happiness,
      energy: p.energy,
      sleeping: !!p.sleeping,
      plays: p.plays ?? 0,
      name: p.name ?? null,
      lastPoopAt: p.lastPoopAt,
      nextPoopIn: p.nextPoopIn,
      hungerZeroSince: p.hungerZeroSince ?? null,
    })),
  };
}

/** Parse a stored checkpoint, or null when absent/corrupt/foreign. */
export function parseTamaCheckpoint(raw: string | null): TamaCheckpoint | null {
  if (!raw) return null;
  try {
    const cp = JSON.parse(raw) as TamaCheckpoint;
    if (!cp || cp.v !== 1 || !Array.isArray(cp.pets)) return null;
    return {
      v: 1,
      savedAt: Number(cp.savedAt) || Date.now(),
      on: !!cp.on,
      hygiene: typeof cp.hygiene === 'number' ? cp.hygiene : 100,
      poops: Math.max(0, Math.floor(Number(cp.poops) || 0)),
      pets: cp.pets.filter((p) => p && typeof p.id === 'string'),
    };
  } catch {
    return null;
  }
}

export function readTamaCheckpoint(): TamaCheckpoint | null {
  try {
    return parseTamaCheckpoint(localStorage.getItem(TAMA_KEY));
  } catch {
    return null;
  }
}

export function writeTamaCheckpoint(cp: TamaCheckpoint): void {
  try {
    localStorage.setItem(TAMA_KEY, JSON.stringify(cp));
  } catch {
    /* storage full/unavailable — the pet still works locally */
  }
}

/**
 * Rebuild the pet list from a checkpoint, keeping each device's own positions:
 * a pet already on this screen stays where it stands and only adopts the
 * checkpoint's durable fields; one arriving for the first time gets a local
 * spawn point. (Callers advance the result by `now - cp.savedAt` afterwards.)
 */
export function mergeCheckpointPets<
  L extends { id: string; x?: number; y?: number; heading?: number; bloat?: number; boostUntil?: number },
>(
  cp: TamaCheckpoint,
  local: readonly L[],
  spawn: () => { x: number; y: number; heading: number },
): Array<TamaPetLike & { x: number; y: number; heading: number; bloat: number; boostUntil: number }> {
  return cp.pets.map((p) => {
    const here = local.find((l) => l.id === p.id);
    const at = here ? { x: here.x ?? 0, y: here.y ?? 0, heading: here.heading ?? 0 } : spawn();
    return {
      ...p,
      x: at.x,
      y: at.y,
      heading: at.heading,
      bloat: here?.bloat ?? 0,
      boostUntil: here?.boostUntil ?? 0,
    };
  });
}
