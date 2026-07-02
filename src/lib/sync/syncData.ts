/**
 * Pro cross-device sync — payload shaping (design §4-1).
 *
 * Content keys AND user `prefs` travel between devices so settings (show-icons,
 * font, background, language, …) stay unified. Theme (light/dark) and the
 * onboarded flag stay device-local.
 *
 * Two rules keep prefs from re-introducing the old apply→reload loop:
 *  1. Fingerprints compare a CANONICAL (order-independent) form of each value, so
 *     the prefs envelope being re-serialized on load (defaults merged in, keys
 *     reordered) is NOT seen as a change.
 *  2. Adopting a remote change that touches ONLY prefs is applied live (see
 *     useSync) via PREFS_SYNC_EVENT instead of reloading the page.
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
  'prefs',
].map((k) => PREFIX + k);

/** The synced preferences key — applied live (no reload) when it alone changes. */
export const PREFS_KEY = PREFIX + 'prefs';

/** Window event the sync engine fires after applying a prefs-only cloud change,
 *  so the preferences layer can re-read them without a full page reload. */
export const PREFS_SYNC_EVENT = '24h:prefs-synced';

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

/** Order-independent serialization of a JSON value: objects get sorted keys
 *  (recursively); arrays keep their order (order is meaningful for slices/days).
 *  Non-JSON strings pass through unchanged. */
function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/** Canonical (semantic) form of a stored value, so re-serializing the same data
 *  with a different key order — as the prefs envelope does on every load — is not
 *  seen as a change. This is what stops prefs sync from looping applyRemote→reload. */
export function canonicalValue(raw: string | null | undefined): string {
  if (raw == null) return '';
  try {
    return stableStringify(JSON.parse(raw));
  } catch {
    return raw;
  }
}

/** Fingerprint over the SYNCED keys only, using each value's CANONICAL form.
 *  Scoped to SYNC_KEYS so any extra key on the server is ignored; canonical so
 *  byte-level re-serialization never registers as a diff. */
export function dataFingerprint(data: Record<string, string>): string {
  const keys = [...SYNC_KEYS].sort();
  return JSON.stringify(keys.filter((k) => typeof data[k] === 'string').map((k) => [k, canonicalValue(data[k])]));
}

/** Synced keys whose canonical value differs between two snapshots. */
export function changedSyncKeys(a: Record<string, string>, b: Record<string, string>): string[] {
  return SYNC_KEYS.filter((k) => canonicalValue(a[k]) !== canonicalValue(b[k]));
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
