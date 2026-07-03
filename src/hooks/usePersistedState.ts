import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Shared localStorage persistence primitive — extracts the pattern every data
 * hook (diary/goals/memos/records) repeated: parse-with-validation on init,
 * fall back on corrupt/missing/unavailable storage, and re-serialize the exact
 * versioned envelope on every change.
 *
 * IMPORTANT: `encode` defines the on-disk format. It must keep producing the
 * SAME envelope shape the hook always wrote (e.g. `{version: 1, entries}`) —
 * cross-device sync ships these strings verbatim (see lib/sync/syncData.ts),
 * so older clients must keep parsing them. Codec byte-compatibility is pinned
 * by tests in __tests__/usePersistedState.test.tsx.
 *
 * Not used by: useDays (custom first-run seeding + two-piece state),
 * usePreferences (live sync-event reload + document side effects),
 * useUserPresets (delegates to lib/user-presets), useTheme (raw string).
 */
export interface PersistedCodec<T> {
  /** Turn the parsed JSON into state, or null to reject (→ fallback). */
  decode: (parsed: unknown) => T | null;
  /** Build the JSON-serializable envelope — the exact stored format. */
  encode: (value: T) => unknown;
  /** Initial state for missing/corrupt/unavailable storage. */
  fallback: () => T;
}

/** One-shot load: parse + validate + fall back. Safe outside React. */
export function loadPersisted<T>(key: string, codec: PersistedCodec<T>): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const decoded = codec.decode(JSON.parse(raw));
      if (decoded !== null) return decoded;
    }
  } catch {
    // corrupt JSON or storage unavailable — fall through
  }
  return codec.fallback();
}

/**
 * useState backed by localStorage: initialises via loadPersisted and writes
 * `codec.encode(value)` back on every change (best-effort; quota/unavailable
 * storage never throws). The codec must be a module-level constant — it is
 * captured on first render.
 */
export function usePersistedState<T>(
  key: string,
  codec: PersistedCodec<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const codecRef = useRef(codec);
  // The initializer runs once on first render, so using the param directly is
  // equivalent to the ref (and refs must not be read during render).
  const [value, setValue] = useState<T>(() => loadPersisted(key, codec));

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(codecRef.current.encode(value)));
    } catch {
      // storage unavailable — the state simply won't persist
    }
  }, [key, value]);

  return [value, setValue];
}
