import { describe, it, expect } from 'vitest';
import { SYNC_KEYS, PREFS_KEY, VIEW_KEY, LIVE_APPLY_KEYS, dataFingerprint, canonicalValue, changedSyncKeys, mergeSyncData } from '../syncData';

const K = (s: string) => `24h-circle-planner.${s}`;

describe('sync payload keys', () => {
  it('syncs content keys, floating widgets AND prefs, but never device-local theme', () => {
    for (const k of ['days', 'diary', 'memos', 'goals', 'records', 'clocktools', 'goalswidget', 'prefs']) {
      expect(SYNC_KEYS).toContain(K(k));
    }
    expect(SYNC_KEYS).not.toContain(K('theme'));
    expect(PREFS_KEY).toBe(K('prefs'));
  });

  it('applies floating-widget changes LIVE (no reload) so the seed-push is never preempted', () => {
    expect(LIVE_APPLY_KEYS).toContain(K('clocktools'));
    expect(LIVE_APPLY_KEYS).toContain(K('goalswidget'));
    // A widget-only remote change must classify as live-appliable.
    const a = { [K('days')]: 'x', [K('clocktools')]: '{"a":1}' };
    const b = { [K('days')]: 'x', [K('clocktools')]: '{"a":2}' };
    const changed = changedSyncKeys(a, b);
    expect(changed).toEqual([K('clocktools')]);
    expect(changed.every((k) => LIVE_APPLY_KEYS.includes(k))).toBe(true);
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

describe('mergeSyncData (3-way, per-key)', () => {
  const fp = dataFingerprint;

  it('THE launch bug: different keys edited on two devices BOTH survive', () => {
    const base = { [K('days')]: 'D0', [K('memos')]: 'M0' };
    const local = { [K('days')]: 'D0', [K('memos')]: 'M1' }; // phone added a memo
    const server = { [K('days')]: 'D1', [K('memos')]: 'M0' }; // PC edited the schedule
    const { merged, conflicts } = mergeSyncData(base, local, server, false);
    expect(merged[K('days')]).toBe('D1'); // PC's schedule kept
    expect(merged[K('memos')]).toBe('M1'); // phone's memo kept
    expect(conflicts).toEqual([]); // no genuine conflict — different keys
  });

  it('only local changed a key → local wins that key', () => {
    const base = { [K('goals')]: 'G0' };
    const { merged } = mergeSyncData(base, { [K('goals')]: 'G1' }, { [K('goals')]: 'G0' }, false);
    expect(merged[K('goals')]).toBe('G1');
  });

  it('only server changed a key → server wins that key', () => {
    const base = { [K('goals')]: 'G0' };
    const { merged } = mergeSyncData(base, { [K('goals')]: 'G0' }, { [K('goals')]: 'G2' }, false);
    expect(merged[K('goals')]).toBe('G2');
  });

  it('SAME key changed on both → conflict; LWW tiebreak by preferServerOnConflict', () => {
    const base = { [K('days')]: 'D0' };
    const local = { [K('days')]: 'DL' };
    const server = { [K('days')]: 'DS' };
    expect(mergeSyncData(base, local, server, false).merged[K('days')]).toBe('DL'); // prefer local
    expect(mergeSyncData(base, local, server, true).merged[K('days')]).toBe('DS'); // prefer server
    expect(mergeSyncData(base, local, server, false).conflicts).toEqual([K('days')]);
  });

  it('propagates a real deletion (present in base, deleted locally, untouched on server)', () => {
    const base = { [K('records')]: 'R0' };
    const local = {}; // deleted locally
    const server = { [K('records')]: 'R0' }; // server unchanged
    const { merged } = mergeSyncData(base, local, server, false);
    expect(merged[K('records')]).toBeUndefined(); // deletion wins
  });

  it('a NEW key on one side is adopted', () => {
    const base = {};
    const { merged } = mergeSyncData(base, { [K('records')]: 'R1' }, {}, false);
    expect(merged[K('records')]).toBe('R1');
  });

  it('KEEP_IF_ABSENT: an old cloud blob missing a widget key never wipes the local widget', () => {
    const base = { [K('clocktools')]: 'W0' };
    const local = { [K('clocktools')]: 'W0' };
    const server = {}; // old blob predates widget sync (key absent)
    const { merged } = mergeSyncData(base, local, server, false);
    expect(merged[K('clocktools')]).toBe('W0'); // widget preserved, not deleted
  });

  it('KEEP_IF_ABSENT: a widget present only on the server is adopted', () => {
    const { merged } = mergeSyncData({}, {}, { [K('goalswidget')]: 'GW1' }, false);
    expect(merged[K('goalswidget')]).toBe('GW1');
  });

  it('no common ancestor (first sync) → union, same-key conflicts by LWW', () => {
    const local = { [K('days')]: 'DL', [K('memos')]: 'ML' };
    const server = { [K('days')]: 'DS', [K('goals')]: 'GS' };
    const { merged } = mergeSyncData({}, local, server, false);
    expect(merged[K('memos')]).toBe('ML'); // only local had it
    expect(merged[K('goals')]).toBe('GS'); // only server had it
    expect(merged[K('days')]).toBe('DL'); // both had it, differ → prefer local
  });

  it('canonical equality: cosmetic re-serialization is not a conflict', () => {
    const base = { [K('prefs')]: '{"a":1,"b":2}' };
    const local = { [K('prefs')]: '{"b":2,"a":1}' }; // same, reordered
    const server = { [K('prefs')]: '{"a":1,"b":2}' };
    const { merged, conflicts } = mergeSyncData(base, local, server, false);
    expect(conflicts).toEqual([]);
    expect(canonicalValue(merged[K('prefs')])).toBe(canonicalValue('{"a":1,"b":2}'));
  });

  it('merged == server when only server moved (drives adopt-no-push)', () => {
    const base = { [K('days')]: 'D0', [K('memos')]: 'M0' };
    const local = { [K('days')]: 'D0', [K('memos')]: 'M0' };
    const server = { [K('days')]: 'D0', [K('memos')]: 'M9' };
    const { merged } = mergeSyncData(base, local, server, false);
    expect(fp(merged)).toBe(fp(server));
  });
});
