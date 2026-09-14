import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PreferencesProvider } from '@/hooks/usePreferences';
import { MemoProvider, useMemos } from '@/hooks/useMemos';
import { marginSpawn, MARGIN_SLOT_SIZE } from '@/components/ClockTools/clock-utils';
import { CLOCKTOOLS_SYNC_EVENT, NEWS_SYNC_EVENT, NEWS_WINDOWS_KEY } from '@/lib/sync/widgetSync';
import { useSwitchChartLayout } from '../useSwitchChartLayout';

const CLOCKTOOLS_KEY = '24h-circle-planner.clocktools';
const PREFS_KEY = '24h-circle-planner.prefs';
const PROFILES_KEY = '24h-circle-planner.pos-profiles';

const size = { innerWidth: window.innerWidth, innerHeight: window.innerHeight };
beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
});
afterAll(() => {
  Object.defineProperty(window, 'innerWidth', { value: size.innerWidth, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: size.innerHeight, configurable: true });
});

const spot = (slot: keyof typeof MARGIN_SLOT_SIZE, layout: 'center' | 'left' = 'center') =>
  marginSpawn(slot, ...MARGIN_SLOT_SIZE[slot], layout);

function Probe() {
  const switchLayout = useSwitchChartLayout();
  const { memos, addMemo } = useMemos();
  return (
    <>
      <button onClick={() => addMemo(spot('memo'))}>memo at its spot</button>
      <button onClick={() => addMemo({ x: 10, y: 10 })}>memo dragged</button>
      <button onClick={() => switchLayout('left')}>left</button>
      <output data-testid="memos">{JSON.stringify(memos.map((m) => ({ x: m.x, y: m.y })))}</output>
    </>
  );
}

const stored = (key: string) => JSON.parse(localStorage.getItem(key) ?? 'null');
let events: string[] = [];
const record = (e: Event) => events.push(e.type);

beforeEach(() => {
  localStorage.clear();
  events = [];
  window.addEventListener(CLOCKTOOLS_SYNC_EVENT, record);
  window.addEventListener(NEWS_SYNC_EVENT, record);
  localStorage.setItem(PREFS_KEY, JSON.stringify({ version: 1, prefs: { language: 'ko' } }));
  localStorage.setItem(CLOCKTOOLS_KEY, JSON.stringify({
    version: 1,
    state: {
      clocks: [{ id: 'c1', mode: 'analog', pos: spot('clock'), tz: null }],
      calendar: { on: true, pos: spot('calendar') },
      weathers: [{ id: 'w1', pos: { x: -100, y: 50 }, place: null }], // user dragged it
    },
  }));
  localStorage.setItem(NEWS_WINDOWS_KEY, JSON.stringify([{ id: 'n1', q: '', country: 'KR', intervalH: 24, pos: spot('news') }]));
});
afterEach(() => {
  cleanup();
  window.removeEventListener(CLOCKTOOLS_SYNC_EVENT, record);
  window.removeEventListener(NEWS_SYNC_EVENT, record);
});

describe('useSwitchChartLayout', () => {
  it('saves the layout and moves only the widgets still on their margin spots', () => {
    render(<PreferencesProvider><MemoProvider><Probe /></MemoProvider></PreferencesProvider>);
    fireEvent.click(screen.getByText('memo at its spot'));
    fireEvent.click(screen.getByText('memo dragged'));
    fireEvent.click(screen.getByText('left'));

    expect(stored(PREFS_KEY).prefs.chartLayout).toBe('left');

    const tools = stored(CLOCKTOOLS_KEY).state;
    expect(tools.clocks[0].pos).toEqual(spot('clock', 'left'));
    expect(tools.calendar.pos).toEqual(spot('calendar', 'left'));
    expect(tools.weathers[0].pos).toEqual({ x: -100, y: 50 });
    expect(stored(NEWS_WINDOWS_KEY)[0].pos).toEqual(spot('news', 'left'));

    expect(JSON.parse(screen.getByTestId('memos').textContent ?? '[]')).toEqual([spot('memo', 'left'), { x: 10, y: 10 }]);
    // Live widget instances are told to re-read their stores.
    expect(events.sort()).toEqual([CLOCKTOOLS_SYNC_EVENT, NEWS_SYNC_EVENT].sort());
  });

  it('judges and moves by where this screen shows a widget (its size profile)', () => {
    // The live clock tools copy every position into a per-resolution profile,
    // and that profile wins on load — the case that sent widgets straight back.
    localStorage.setItem(CLOCKTOOLS_KEY, JSON.stringify({
      version: 1,
      state: {
        clocks: [{ id: 'c1', mode: 'analog', pos: { x: 0, y: 0 }, tz: null }], // another screen's value
        calendar: { on: true, pos: spot('calendar') },
        weathers: [],
      },
    }));
    localStorage.setItem(PROFILES_KEY, JSON.stringify({
      '1280x800': { 'ct.clock.c1': spot('clock'), 'ct.calendar': { x: 30, y: 30 } }, // calendar was dragged here
    }));
    render(<PreferencesProvider><MemoProvider><Probe /></MemoProvider></PreferencesProvider>);
    fireEvent.click(screen.getByText('left'));

    const profile = stored(PROFILES_KEY)['1280x800'];
    expect(profile['ct.clock.c1']).toEqual(spot('clock', 'left'));
    expect(stored(CLOCKTOOLS_KEY).state.clocks[0].pos).toEqual(spot('clock', 'left'));
    expect(profile['ct.calendar']).toEqual({ x: 30, y: 30 });
    expect(stored(CLOCKTOOLS_KEY).state.calendar.pos).toEqual(spot('calendar'));
  });

  it('does nothing extra when the layout is picked again', () => {
    render(<PreferencesProvider><MemoProvider><Probe /></MemoProvider></PreferencesProvider>);
    fireEvent.click(screen.getByText('left'));
    events = [];
    const before = localStorage.getItem(CLOCKTOOLS_KEY);
    fireEvent.click(screen.getByText('left'));
    expect(localStorage.getItem(CLOCKTOOLS_KEY)).toBe(before);
    expect(events).toEqual([]);
  });

  it('leaves widgets in place when a store is unreadable', () => {
    localStorage.setItem(CLOCKTOOLS_KEY, '{broken');
    render(<PreferencesProvider><MemoProvider><Probe /></MemoProvider></PreferencesProvider>);
    fireEvent.click(screen.getByText('left'));
    expect(localStorage.getItem(CLOCKTOOLS_KEY)).toBe('{broken');
    expect(stored(PREFS_KEY).prefs.chartLayout).toBe('left');
  });
});
