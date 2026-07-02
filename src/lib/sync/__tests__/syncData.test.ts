import { describe, it, expect } from 'vitest';
import { SYNC_KEYS, PREFS_KEY, VIEW_KEY, LIVE_APPLY_KEYS, dataFingerprint, canonicalValue, changedSyncKeys } from '../syncData';

const K = (s: string) => `24h-circle-planner.${s}`;

describe('sync payload keys', () => {
  it('syncs content keys AND prefs, but never device-local theme', () => {
    for (const k of ['days', 'diary', 'memos', 'goals', 'records', 'prefs']) {
      expect(SYNC_KEYS).toContain(K(k));
    }
    expect(SYNC_KEYS).not.toContain(K('theme'));
    expect(PREFS_KEY).toBe(K('prefs'));
  });

  it('does NOT sync the legacy `schedule` key (days is authoritative; it mirrors transient present → diary-load loop)', () => {
    expect(SYNC_KEYS).not.toContain(K('schedule'));
  });

  it('a changed `schedule` value does not affect the fingerprint (loading a diary syncs nothing)', () => {
    const base = { [K('days')]: '{"activeId":"d1"}', [K('diary')]: '{}' };
    const withDiarySchedule = { ...base, [K('schedule')]: '{"version":1,"schedule":{"id":"x","slices":[1,2]}}' };
    expect(dataFingerprint(withDiarySchedule)).toBe(dataFingerprint(base));
  });
});

describe('canonicalValue', () => {
  it('is order-independent for objects (the prefs reload-loop fix)', () => {
    const a = '{"version":1,"prefs":{"showIcons":false,"language":"ko","fontScale":1}}';
    const b = '{"prefs":{"fontScale":1,"language":"ko","showIcons":false},"version":1}';
    expect(canonicalValue(a)).toBe(canonicalValue(b));
  });
  it('preserves array order (slice/day order is meaningful)', () => {
    expect(canonicalValue('[1,2,3]')).not.toBe(canonicalValue('[3,2,1]'));
  });
  it('reflects a real value change', () => {
    expect(canonicalValue('{"showIcons":true}')).not.toBe(canonicalValue('{"showIcons":false}'));
  });
});

describe('dataFingerprint', () => {
  it('is unchanged when prefs is only re-serialized (different key order)', () => {
    const base = { [K('days')]: '{"a":1}' };
    const prefsA = { ...base, [K('prefs')]: '{"version":1,"prefs":{"showIcons":false,"fontScale":1}}' };
    const prefsB = { ...base, [K('prefs')]: '{"prefs":{"fontScale":1,"showIcons":false},"version":1}' };
    // Same settings, different serialization → SAME fingerprint (no loop).
    expect(dataFingerprint(prefsA)).toBe(dataFingerprint(prefsB));
  });
  it('ignores keys outside SYNC_KEYS', () => {
    const base = { [K('days')]: '{"a":1}' };
    expect(dataFingerprint({ ...base, [K('theme')]: 'dark' })).toBe(dataFingerprint(base));
  });
  it('changes when a synced value actually changes', () => {
    expect(dataFingerprint({ [K('prefs')]: '{"showIcons":true}' }))
      .not.toBe(dataFingerprint({ [K('prefs')]: '{"showIcons":false}' }));
  });
  it('is order-independent across map key ordering', () => {
    const a = { [K('days')]: 'x', [K('diary')]: 'y' };
    const b = { [K('diary')]: 'y', [K('days')]: 'x' };
    expect(dataFingerprint(a)).toBe(dataFingerprint(b));
  });
});

describe('changedSyncKeys', () => {
  it('reports no change when prefs is only re-serialized', () => {
    const a = { [K('prefs')]: '{"a":1,"b":2}' };
    const b = { [K('prefs')]: '{"b":2,"a":1}' };
    expect(changedSyncKeys(a, b)).toEqual([]);
  });
  it('reports prefs alone when only settings changed (drives live-apply, no reload)', () => {
    const a = { [K('days')]: 'x', [K('prefs')]: '{"showIcons":true}' };
    const b = { [K('days')]: 'x', [K('prefs')]: '{"showIcons":false}' };
    expect(changedSyncKeys(a, b)).toEqual([PREFS_KEY]);
  });
  it('reports a content key when the schedule changed (forces reload path)', () => {
    const a = { [K('days')]: 'x' };
    const b = { [K('days')]: 'y' };
    expect(changedSyncKeys(a, b)).toEqual([K('days')]);
  });
});

describe('diary view sync', () => {
  it('syncs the view cursor and marks it live-appliable (with prefs)', () => {
    expect(SYNC_KEYS).toContain(K('view'));
    expect(VIEW_KEY).toBe(K('view'));
    expect(LIVE_APPLY_KEYS).toContain(K('view'));
    expect(LIVE_APPLY_KEYS).toContain(K('prefs'));
  });

  it('a view-only change is live-appliable → no reload', () => {
    const a = { [K('days')]: '{"activeId":"d1"}', [K('view')]: '{"diaryDate":null}' };
    const b = { [K('days')]: '{"activeId":"d1"}', [K('view')]: '{"diaryDate":"2026-07-15"}' };
    const changed = changedSyncKeys(a, b);
    expect(changed).toEqual([K('view')]);
    expect(changed.every((k) => LIVE_APPLY_KEYS.includes(k))).toBe(true);
  });

  it('a content change alongside a view change is NOT live-only → reload path', () => {
    const a = { [K('days')]: '{"activeId":"d1"}', [K('view')]: '{"diaryDate":null}' };
    const b = { [K('days')]: '{"activeId":"d2"}', [K('view')]: '{"diaryDate":"2026-07-15"}' };
    expect(changedSyncKeys(a, b).every((k) => LIVE_APPLY_KEYS.includes(k))).toBe(false);
  });
});
