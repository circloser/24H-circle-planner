import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { clampOffset, loadPosProfile, rememberOnScreen, savePosProfile, screenPos } from '../clock-utils';
import { useClockTools } from '../useClockTools';

const PROFILES = '24h-circle-planner.pos-profiles';
const CLOCKTOOLS = '24h-circle-planner.clocktools';

const original = { innerWidth: window.innerWidth, innerHeight: window.innerHeight, screen: window.screen };
const setWindow = (w: number, h: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
};
const setScreen = (w: number, h: number) =>
  Object.defineProperty(window, 'screen', { configurable: true, value: { width: w, height: h } });

beforeEach(() => {
  localStorage.clear();
  setScreen(1600, 900);
  setWindow(1600, 860);
});
afterAll(() => {
  setWindow(original.innerWidth, original.innerHeight);
  Object.defineProperty(window, 'screen', { configurable: true, value: original.screen });
});

describe('per-screen widget layout', () => {
  it('keeps this monitor’s spot when the window is resized', () => {
    savePosProfile('k', { x: 10, y: 20 });
    setWindow(1500, 780); // resized, a bookmarks bar appeared…
    expect(loadPosProfile('k')).toEqual({ x: 10, y: 20 });
  });

  it('keeps the spot through a browser zoom (CSS screen size and pixel ratio change together)', () => {
    const dpr = (value: number) => Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value });
    try {
      dpr(1);
      savePosProfile('k', { x: 10, y: 20 });
      setScreen(1280, 720); // at 125% zoom a 1600×900 screen reports 1280×720 CSS px…
      dpr(1.25); // …at a 1.25 pixel ratio
      expect(loadPosProfile('k')).toEqual({ x: 10, y: 20 });
    } finally {
      dpr(1);
    }
  });

  it('keeps separate spots per monitor', () => {
    savePosProfile('k', { x: 10, y: 20 });
    setScreen(2560, 1440);
    expect(loadPosProfile('k')).toBeNull();
    savePosProfile('k', { x: 300, y: 40 });
    setScreen(1600, 900);
    expect(loadPosProfile('k')).toEqual({ x: 10, y: 20 });
  });

  it('still reads a spot saved under the old per-window key', () => {
    localStorage.setItem(PROFILES, JSON.stringify({ '1600x860': { k: { x: 1, y: 2 } } }));
    expect(loadPosProfile('k')).toEqual({ x: 1, y: 2 });
  });

  it('draws at this screen’s spot, kept on screen, else at the stored position', () => {
    savePosProfile('k', { x: -5000, y: 0 });
    expect(screenPos('k', { x: 100, y: 100 }, 200, 160)).toEqual(clampOffset({ x: -5000, y: 0 }, 200, 160));
    expect(screenPos('other', { x: 100, y: 100 }, 200, 160)).toEqual({ x: 100, y: 100 });
  });

  it('remembers a widget where it is first seen, and only then', () => {
    rememberOnScreen('k', { x: 1, y: 1 });
    rememberOnScreen('k', { x: 9, y: 9 }); // e.g. moved later on another device
    expect(loadPosProfile('k')).toEqual({ x: 1, y: 1 });
  });

  it('carries an old per-window spot over on first sight instead of the synced one', () => {
    localStorage.setItem(PROFILES, JSON.stringify({ '1600x860': { k: { x: 5, y: 6 } } }));
    rememberOnScreen('k', { x: 99, y: 99 });
    setWindow(1600, 800);
    expect(loadPosProfile('k')).toEqual({ x: 5, y: 6 });
  });

  it('does not remember anything on a phone (widgets render inline there)', () => {
    setWindow(390, 844);
    rememberOnScreen('k', { x: 1, y: 1 });
    expect(localStorage.getItem(PROFILES)).toBeNull();
  });
});

describe('clock tools never write this screen’s layout into the synced value', () => {
  it('loads and saves the stored positions untouched', () => {
    const env = {
      version: 1,
      coords: 'centre',
      state: { clocks: [{ id: 'c1', mode: 'analog', pos: { x: 5000, y: -5000 }, tz: null }], calendar: { on: false, pos: { x: 1, y: 2 } }, weathers: [] },
    };
    localStorage.setItem(CLOCKTOOLS, JSON.stringify(env));
    savePosProfile('ct.clock.c1', { x: -100, y: -100 });

    const { result } = renderHook(() => useClockTools());

    // Neither this screen's spot nor the on-screen clamp leaks into state…
    expect(result.current.state.clocks[0].pos).toEqual({ x: 5000, y: -5000 });
    // …or into what is saved back to the synced key…
    expect(JSON.parse(localStorage.getItem(CLOCKTOOLS)!).state.clocks[0].pos).toEqual({ x: 5000, y: -5000 });
    // …and saving doesn't overwrite this screen's remembered spot.
    expect(loadPosProfile('ct.clock.c1')).toEqual({ x: -100, y: -100 });
  });
});
