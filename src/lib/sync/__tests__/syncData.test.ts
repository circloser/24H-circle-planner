import { describe, it, expect } from 'vitest';
import { SYNC_KEYS, dataFingerprint } from '../syncData';

const K = (s: string) => `24h-circle-planner.${s}`;

describe('sync payload keys', () => {
  it('does NOT sync device-local prefs (re-normalized on load → reload loop)', () => {
    expect(SYNC_KEYS).not.toContain(K('prefs'));
    expect(SYNC_KEYS).not.toContain(K('theme'));
  });

  it('syncs the content keys', () => {
    for (const k of ['schedule', 'days', 'diary', 'memos', 'goals', 'records']) {
      expect(SYNC_KEYS).toContain(K(k));
    }
  });
});

describe('dataFingerprint', () => {
  it('ignores keys outside SYNC_KEYS (e.g. a stale server prefs blob)', () => {
    const base = { [K('days')]: '{"a":1}', [K('diary')]: '{"b":2}' };
    const withStalePrefs = { ...base, [K('prefs')]: '{"prefs":{"showIcons":false}}' };
    // A leftover prefs blob on the server must NOT change the fingerprint, or the
    // client would forever see a diff and loop applyRemote→reload.
    expect(dataFingerprint(withStalePrefs)).toBe(dataFingerprint(base));
  });

  it('changes when a synced content key changes', () => {
    const a = { [K('days')]: '{"a":1}' };
    const b = { [K('days')]: '{"a":2}' };
    expect(dataFingerprint(a)).not.toBe(dataFingerprint(b));
  });

  it('is order-independent (stable across map key ordering)', () => {
    const a = { [K('days')]: 'x', [K('diary')]: 'y' };
    const b = { [K('diary')]: 'y', [K('days')]: 'x' };
    expect(dataFingerprint(a)).toBe(dataFingerprint(b));
  });
});
