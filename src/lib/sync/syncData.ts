/**
 * Pro cross-device sync — payload shaping (design §4-1).
 *
 * Only *content* keys travel between devices. Device-local settings (theme,
 * prefs like font/background/timelines, the onboarded flag) are intentionally
 * NOT synced in v1 — they can legitimately differ per device.
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

/** Stable fingerprint of a data map (sorted keys) for change detection. */
export function dataFingerprint(data: Record<string, string>): string {
  return JSON.stringify(Object.keys(data).sort().map((k) => [k, data[k]]));
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
