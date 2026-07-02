/**
 * Pro cross-device sync — payload shaping (design §4-1).
 *
 * Only *content* keys travel between devices. Device-local settings (theme,
 * `prefs`, the onboarded flag) are intentionally NOT synced. In particular the
 * prefs envelope is re-normalized (defaults merged in) on every load, so its
 * serialized string isn't byte-stable — syncing it caused an apply→reload loop
 * after each cloud adopt. The fingerprint below is scoped to SYNC_KEYS so a
 * leftover non-synced key on the server (e.g. a prefs blob written by an earlier
 * build) can't cause a perpetual mismatch either.
 */

const PREFIX = '24h-circle-planner.';

/** localStorage keys included in the synced blob. */
export const SYNC_KEYS: readonly string[] = [
  'schedule',
  'days',
  'diary',
  'memos',
  'rimmemos',
  'user-presets',
  'goals',
  'records',
].map((k) => PREFIX + k);

export interface SyncEnvelope {
  v: 1;
  /** Content modification time (epoch ms). Drives last-write-wins reconciliation. */
  modifiedAt: number;
  /** localStorage key → raw string value. */
  data: Record<string, string>;
}

/** Snapshot the synced content keys currently in localStorage. */
export function collectSyncData(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of SYNC_KEYS) {
    const v = localStorage.getItem(key);
    if (v !== null) data[key] = v;
  }
  return data;
}

/**
 * Overwrite the synced content keys from `data`. Keys absent from `data` are
 * removed so deletions propagate. Device-local keys are never touched.
 */
export function applySyncData(data: Record<string, string>): void {
  for (const key of SYNC_KEYS) {
    const v = data[key];
    if (typeof v === 'string') localStorage.setItem(key, v);
    else localStorage.removeItem(key);
  }
}

/** Stable fingerprint over the SYNCED keys only (sorted) for change detection.
 *  Scoping to SYNC_KEYS means any extra key in `data` (e.g. a stale prefs blob a
 *  previous build wrote to the server) is ignored, so it can't create a diff that
 *  never resolves — which otherwise loops applyRemote→reload forever. */
export function dataFingerprint(data: Record<string, string>): string {
  const keys = [...SYNC_KEYS].sort();
  return JSON.stringify(keys.filter((k) => typeof data[k] === 'string').map((k) => [k, data[k]]));
}

/** Validate + normalise a stored blob string into an envelope (or null). */
export function parseEnvelope(raw: unknown): SyncEnvelope | null {
  try {
    const o = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown> | null;
    if (o && typeof o === 'object' && o['v'] === 1 && o['data'] && typeof o['data'] === 'object') {
      return {
        v: 1,
        modifiedAt: typeof o['modifiedAt'] === 'number' ? (o['modifiedAt'] as number) : 0,
        data: o['data'] as Record<string, string>,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}
