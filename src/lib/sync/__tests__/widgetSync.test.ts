import { describe, it, expect, beforeEach } from 'vitest';
import { encodeWidgetValue, decodeWidgetValue, CLOCKTOOLS_KEY, GOALSWIDGET_KEY } from '../widgetSync';
import { collectSyncData, applySyncData, canonicalValue } from '../syncData';

function setViewport(w: number, h: number) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true, writable: true });
}

describe('widgetSync centre-relative transform', () => {
  it('encode then decode on the same viewport is exact (loop-safe involution)', () => {
    setViewport(1600, 900);
    const raw = JSON.stringify({ x: 900, y: 450 });
    expect(canonicalValue(decodeWidgetValue(encodeWidgetValue(raw)))).toBe(canonicalValue(raw));
    // odd viewport too — integer centre keeps it exact
    setViewport(1365, 767);
    expect(canonicalValue(decodeWidgetValue(encodeWidgetValue(raw)))).toBe(canonicalValue(raw));
  });

  it('a position AT the centre encodes to the origin', () => {
    setViewport(1600, 900); // centre 800,450
    expect(JSON.parse(encodeWidgetValue(JSON.stringify({ x: 800, y: 450 })))).toEqual({ x: 0, y: 0 });
  });

  it('maps centre-relative across viewports (bigger screen → same offset, wider margins)', () => {
    setViewport(1600, 900); // centre 800,450
    const wire = encodeWidgetValue(JSON.stringify({ x: 900, y: 450 })); // +100,+0 from centre
    setViewport(1000, 700); // centre 500,350
    expect(JSON.parse(decodeWidgetValue(wire))).toEqual({ x: 600, y: 350 }); // still 100 right of centre
  });

  it('shifts every nested pos in a clock-tools blob but leaves non-position objects', () => {
    setViewport(1000, 800); // centre 500,400
    const raw = JSON.stringify({
      version: 1,
      state: {
        clocks: [{ id: 'c1', mode: 'analog', pos: { x: 600, y: 400 }, tz: null }],
        calendar: { on: true, pos: { x: 500, y: 400 } },
        timer: { on: false, pos: { x: 500, y: 500 }, setSec: 300, remainingSec: 300, running: false, endAt: null },
        weathers: [{ id: 'w1', pos: { x: 700, y: 400 }, place: { name: 'Seoul', lat: 37.5, lon: 127 } }],
        alarm: { on: false, pos: { x: 500, y: 300 }, time: '07:00', enabled: false },
      },
    });
    const enc = JSON.parse(encodeWidgetValue(raw));
    expect(enc.state.clocks[0].pos).toEqual({ x: 100, y: 0 });
    expect(enc.state.calendar.pos).toEqual({ x: 0, y: 0 });
    expect(enc.state.timer.pos).toEqual({ x: 0, y: 100 });
    expect(enc.state.weathers[0].pos).toEqual({ x: 200, y: 0 });
    expect(enc.state.weathers[0].place).toEqual({ name: 'Seoul', lat: 37.5, lon: 127 }); // 3-key → untouched
    expect(enc.state.timer.setSec).toBe(300); // scalar untouched
  });

  it('passes a corrupt / non-JSON value through unchanged', () => {
    expect(encodeWidgetValue('not json')).toBe('not json');
    expect(decodeWidgetValue('not json')).toBe('not json');
  });
});

describe('collectSyncData / applySyncData widget handling', () => {
  beforeEach(() => localStorage.clear());

  it('collect encodes widget positions; apply decodes them into THIS viewport', () => {
    setViewport(1600, 900);
    localStorage.setItem(GOALSWIDGET_KEY, JSON.stringify({ x: 900, y: 450 }));
    localStorage.setItem('24h-circle-planner.days', 'DAYS');
    const collected = collectSyncData();
    expect(JSON.parse(collected[GOALSWIDGET_KEY])).toEqual({ x: 100, y: 0 }); // centre-relative on the wire
    expect(collected['24h-circle-planner.days']).toBe('DAYS'); // non-widget untouched

    setViewport(1000, 700); // a different device
    applySyncData(collected);
    expect(JSON.parse(localStorage.getItem(GOALSWIDGET_KEY)!)).toEqual({ x: 600, y: 350 });
  });

  it('KEEPS a local widget key when the cloud blob omits it (no wipe → no login loop)', () => {
    localStorage.setItem(CLOCKTOOLS_KEY, JSON.stringify({ version: 1, state: { clocks: [] } }));
    applySyncData({ '24h-circle-planner.days': 'X' }); // an old, pre-widget-sync blob
    expect(localStorage.getItem(CLOCKTOOLS_KEY)).not.toBeNull();
  });

  it('REMOVES a non-widget key when the cloud blob omits it (deletion still propagates)', () => {
    localStorage.setItem('24h-circle-planner.memos', 'M');
    applySyncData({ '24h-circle-planner.days': 'X' });
    expect(localStorage.getItem('24h-circle-planner.memos')).toBeNull();
  });
});
