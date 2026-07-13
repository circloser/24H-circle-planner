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
 *  2. Adopting a remote change that touches ONLY live-appliable keys (prefs, and
 *     the diary `view` cursor) is applied live (see useSync) via a *_SYNC_EVENT
 *     instead of reloading the page.
 *
 * The `view` key is a tiny {diaryDate} cursor so entering/leaving a diary on one
 * device follows live on the others. Loading a diary changes no synced *content*
 * (see the schedule note below), so only this signal travels — no reload, no loop.
 *
 * The legacy single-`schedule` key is intentionally NOT synced. `days` is
 * authoritative (the store skips its own restore whenever a days envelope
 * exists), while `schedule` merely mirrors the transient `present` — which
 * becomes a LOADED DIARY's schedule. Syncing it made loading a diary on one
 * device oscillate against `days` on another, looping apply→reload forever.
 * Loading a diary is a view state, not a data change, so it now syncs nothing.
 */

import { CLOCKTOOLS_KEY, GOALSWIDGET_KEY, isWidgetKey } from './widgetSync';

const PREFIX = '24h-circle-planner.';

/** localStorage keys included in the synced blob. */
export const SYNC_KEYS: readonly string[] = [
  'days',
  'diary',
  'memos',
  'rimmemos',
  'user-presets',
  'goals',
  'records',
  // Floating widgets. Loop-safe because they are LIVE-APPLIED (no reload),
  // KEPT when absent from an old cloud blob (never wiped/regenerated), and their
  // positions travel centre-relative (see widgetSync) so re-saving an applied
  // value reproduces byte-identical wire data. All three are what a naive add
  // lacked — that version looped on login.
  'clocktools',
  'goalswidget',
  'prefs',
  'view',
].map((k) => PREFIX + k);

/** The synced preferences key — applied live (no reload) when it alone changes. */
export const PREFS_KEY = PREFIX + 'prefs';

/** The synced diary-view cursor ({diaryDate}) — applied live (no reload). */
export const VIEW_KEY = PREFIX + 'view';

/** localStorage keys the sync engine applies LIVE (via events) instead of reloading.
 *  The floating widgets are here so a remote widget change never reloads the page —
 *  which is what preempted the seed-push and caused the login loop. useClockTools /
 *  GoalsWidget re-read their state on the events below. */
export const LIVE_APPLY_KEYS: readonly string[] = [PREFS_KEY, VIEW_KEY, CLOCKTOOLS_KEY, GOALSWIDGET_KEY];

/** Window event fired after applying a prefs-only cloud change (re-read live). */
export const PREFS_SYNC_EVENT = '24h:prefs-synced';

/** Window event fired after applying a diary-view change (enter/leave live). */
export const VIEW_SYNC_EVENT = '24h:view-synced';

export interface SyncEnvelope {
  v: 1;
  /** Content modification time (epoch ms). Drives last-write-wins reconciliation. */
  modifiedAt: number;
  /** localStorage key → raw string value. */
  data: Record<string, string>;
}

import type { EncBlock } from './e2ee';

/** Wire format when E2EE is on: the server sees only `enc` (ciphertext) plus a
 *  cleartext `modifiedAt` used for last-write-wins. Decrypted into a SyncEnvelope
 *  at the transport boundary (syncClient) before the engine ever sees it. */
export interface EncryptedEnvelope {
  v: 2;
  modifiedAt: number;
  enc: EncBlock;
}

/** A parsed wire envelope: either plaintext (v1, engine-ready) or encrypted (v2). */
export type WireEnvelope =
  | { kind: 'plain'; envelope: SyncEnvelope }
  | { kind: 'enc'; modifiedAt: number; enc: EncBlock };

function isEncBlock(o: unknown): o is EncBlock {
  const b = o as Record<string, unknown> | null;
  return !!b && typeof b.salt === 'string' && typeof b.iv === 'string' && typeof b.ct === 'string' && typeof b.check === 'string';
}

/** Validate + classify a stored blob as a plaintext (v1) or encrypted (v2) envelope. */
export function parseWire(raw: unknown): WireEnvelope | null {
  try {
    const o = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown> | null;
    if (!o || typeof o !== 'object') return null;
    if (o['v'] === 2 && isEncBlock(o['enc'])) {
      return { kind: 'enc', modifiedAt: typeof o['modifiedAt'] === 'number' ? (o['modifiedAt'] as number) : 0, enc: o['enc'] };
    }
    const env = parseEnvelope(o);
    return env ? { kind: 'plain', envelope: env } : null;
  } catch {
    return null;
  }
}

/** Snapshot the synced content keys currently in localStorage. Widget positions
 *  are stored centre-relative already, so every value ships verbatim. */
export function collectSyncData(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of SYNC_KEYS) {
    const v = localStorage.getItem(key);
    if (v !== null) data[key] = v;
  }
  return data;
}

/**
 * Overwrite the synced content keys from `data` (verbatim — widget positions
 * are centre offsets on every device, no re-basing). A non-widget key absent
 * from `data` is removed so deletions propagate; a WIDGET key absent is KEPT —
 * an old cloud blob predating widget sync must not wipe local widgets, and
 * keeping it (rather than removing→regenerating a default) is what stops the
 * login apply→reload loop. Device-local keys are never touched.
 */
export function applySyncData(data: Record<string, string>): void {
  for (const key of SYNC_KEYS) {
    const v = data[key];
    if (typeof v === 'string') {
      localStorage.setItem(key, v);
    } else if (!isWidgetKey(key)) {
      localStorage.removeItem(key);
    }
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
