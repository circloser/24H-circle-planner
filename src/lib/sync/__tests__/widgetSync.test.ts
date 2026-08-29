import { describe, it, expect, beforeEach } from 'vitest';
import { CLOCKTOOLS_KEY, GOALSWIDGET_KEY } from '../widgetSync';
import { collectSyncData, applySyncData } from '../syncData';
import { toStored, anchoredStyle, migrateLegacyPos, dragFloor } from '@/components/ClockTools/clock-utils';

function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true, writable: true });
}

describe('centre-offset position space (clock-utils)', () => {
  beforeEach(() => localStorage.clear());

  it('toStored maps a viewport point to a centre offset; anchoredStyle renders it back', () => {
    setViewport(1600, 900);
    expect(toStored(900, 450)).toEqual({ x: 100, y: 0 }); // 100px right of centre
    expect(anchoredStyle(100, 0)).toEqual({ position: 'absolute', left: 'calc(50vw + 100px)', top: 'calc(50vh + 0px)' });
  });

  it('an offset means the same chart-relative spot on ANY viewport (no re-basing)', () => {
    setViewport(1600, 900);
    const stored = toStored(900, 450);
    setViewport(1000, 700);
    // Same stored value renders 100px right of THIS viewport's centre too.
    expect(anchoredStyle(stored.x, stored.y).left).toBe('calc(50vw + 100px)');
  });

  it('migrateLegacyPos re-expresses a legacy ABSOLUTE position using the persisted origin', () => {
    localStorage.setItem('24h-circle-planner.layout-origin', JSON.stringify({ cx: 960, cy: 540 }));
    expect(migrateLegacyPos({ x: 1060, y: 540 })).toEqual({ x: 100, y: 0 });
  });

  it('migrateLegacyPos falls back to the live centre when no origin was persisted', () => {
    setViewport(1200, 800);
    expect(migrateLegacyPos({ x: 700, y: 400 })).toEqual({ x: 100, y: 0 });
  });

  it('dragFloor keeps the top-left on screen in offset space', () => {
    setViewport(1200, 800);
    expect(dragFloor()).toEqual({ minX: 4 - 600, minY: 4 - 400 });
  });

  it('clampOffset enforces on-screen on DESKTOP but is a byte-stable pass-through on MOBILE (regression: a phone tab squeezed and synced every position)', async () => {
    const { clampOffset } = await import('@/components/ClockTools/clock-utils');
    const far = { x: -920, y: -420 };
    setViewport(1280, 950);
    const clamped = clampOffset(far, 300, 300);
    expect(clamped.x).toBeGreaterThanOrEqual(8 - 640);
    expect(clamped.y).toBeGreaterThanOrEqual(8 - 475);
    // Mobile viewport → positions are inline-rendered, value must NOT change.
    setViewport(390, 844);
    expect(clampOffset(far, 300, 300)).toEqual(far);
    expect(clampOffset({ x: 640, y: 300 }, 200, 160)).toEqual({ x: 640, y: 300 });
  });
});

describe('sync wire is a byte-identical pass-through (the anti-drift invariant)', () => {
  beforeEach(() => localStorage.clear());

  it('collect ships the stored widget strings VERBATIM', () => {
    const ct = JSON.stringify({ version: 1, coords: 'centre', state: { clocks: [{ id: 'c1', pos: { x: -340, y: -40 } }] } });
    const gw = JSON.stringify({ x: 40, y: 120, c: 1 });
    localStorage.setItem(CLOCKTOOLS_KEY, ct);
    localStorage.setItem(GOALSWIDGET_KEY, gw);
    const data = collectSyncData();
    expect(data[CLOCKTOOLS_KEY]).toBe(ct);
    expect(data[GOALSWIDGET_KEY]).toBe(gw);
  });

  it('push→apply round-trips byte-identically EVEN ACROSS A RESIZE (regression: positions drifted per sync cycle)', () => {
    setViewport(1600, 900);
    const ct = JSON.stringify({ version: 1, coords: 'centre', state: { calendar: { on: true, pos: { x: -360, y: -210 } } } });
    localStorage.setItem(CLOCKTOOLS_KEY, ct);
    localStorage.setItem('24h-circle-planner.days', 'D');
    const wire = collectSyncData();
    // The window is resized between the push and the pull — the old transform
    // re-based against the live centre here and shifted every position.
    setViewport(1100, 700);
    applySyncData(wire);
    expect(localStorage.getItem(CLOCKTOOLS_KEY)).toBe(ct);
    // …and repeated cycles stay fixed too.
    setViewport(1400, 1000);
    applySyncData(collectSyncData());
    expect(localStorage.getItem(CLOCKTOOLS_KEY)).toBe(ct);
  });

  it('KEEPS a local widget key when the cloud blob omits it (no wipe → no login loop)', () => {
    localStorage.setItem(CLOCKTOOLS_KEY, JSON.stringify({ version: 1, coords: 'centre', state: { clocks: [] } }));
    applySyncData({ '24h-circle-planner.days': 'X' }); // an old, pre-widget-sync blob
    expect(localStorage.getItem(CLOCKTOOLS_KEY)).not.toBeNull();
  });

  it('KEEPS the time palette when an old cloud blob omits it (user-authored, never wiped)', () => {
    localStorage.setItem('24h-circle-planner.palette', JSON.stringify({ version: 1, items: [{ id: 'p1', label: '수면', color: '#c4b5fd', icon: '🌙' }] }));
    applySyncData({ '24h-circle-planner.days': 'X' });
    expect(localStorage.getItem('24h-circle-planner.palette')).not.toBeNull();
  });

  it('REMOVES a non-widget key when the cloud blob omits it (deletion still propagates)', () => {
    localStorage.setItem('24h-circle-planner.memos', 'M');
    applySyncData({ '24h-circle-planner.days': 'X' });
    expect(localStorage.getItem('24h-circle-planner.memos')).toBeNull();
  });
});
