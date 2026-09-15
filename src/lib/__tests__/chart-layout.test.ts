import { afterEach, describe, expect, it } from 'vitest';
import {
  CHART_LAYOUTS, CHART_WIDTH, chartCentreLeft, effectiveChartLayout, isChartLayout, readStoredChartLayout, viewWidth,
} from '../chart-layout';

const desk = { isMobile: false, tutorialOpen: false };
const savePrefs = (prefs: object) =>
  localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs }));

describe('chart layout', () => {
  it('knows exactly the four layouts', () => {
    expect([...CHART_LAYOUTS]).toEqual(['center', 'left', 'right', 'hidden']);
    expect(isChartLayout('left')).toBe(true);
    expect(isChartLayout('top')).toBe(false);
    expect(isChartLayout(undefined)).toBe(false);
  });

  it('renders the chosen layout on desktop', () => {
    for (const layout of CHART_LAYOUTS) expect(effectiveChartLayout(layout, desk)).toBe(layout);
  });

  it('keeps phones centred', () => {
    expect(effectiveChartLayout('left', { ...desk, isMobile: true })).toBe('center');
    expect(effectiveChartLayout('hidden', { ...desk, isMobile: true })).toBe('center');
  });

  it('shows a hidden chart while the tutorial points at it', () => {
    expect(effectiveChartLayout('hidden', { ...desk, tutorialOpen: true })).toBe('center');
    // A side layout still shows the chart, so the tutorial can use it where it is.
    expect(effectiveChartLayout('left', { ...desk, tutorialOpen: true })).toBe('left');
  });

  it('treats an unknown saved value as centre', () => {
    expect(effectiveChartLayout('diagonal', desk)).toBe('center');
    expect(effectiveChartLayout(undefined, desk)).toBe('center');
  });

  it('sizes the column to each view', () => {
    expect(viewWidth('full')).toBe(CHART_WIDTH);
    expect(viewWidth('day')).toBe(CHART_WIDTH);
    expect(viewWidth('night')).toBe(CHART_WIDTH);
    expect(viewWidth('table')).toBe('min(560px, 100%)');
    expect(viewWidth('record')).toBe('min(720px, 100%)');
    // Only the circle is capped by the window height; the table and record scroll.
    expect(CHART_WIDTH).toContain('100dvh');
    expect(viewWidth('table')).not.toContain('100dvh');
  });

  it('centres fixed overlays over the current view', () => {
    expect(chartCentreLeft('center')).toBe('50%');
    expect(chartCentreLeft('hidden', 'table')).toBe('50%');
    expect(chartCentreLeft('left')).toMatch(/^calc\(40px \+ min\(720px/);
    expect(chartCentreLeft('right')).toMatch(/^calc\(100vw - 40px - min\(720px/);
    expect(chartCentreLeft('left', 'table')).toBe('calc(40px + min(560px, calc(100vw - 80px)) / 2)');
    expect(chartCentreLeft('right', 'record')).toBe('calc(100vw - 40px - min(720px, calc(100vw - 80px)) / 2)');
  });

  describe('readStoredChartLayout', () => {
    afterEach(() => localStorage.clear());

    it('reads the saved preference', () => {
      savePrefs({ language: 'ko', chartLayout: 'right' });
      expect(readStoredChartLayout()).toBe('right');
    });

    it('falls back to centre for missing, unknown or corrupt data', () => {
      expect(readStoredChartLayout()).toBe('center');
      savePrefs({ chartLayout: 'upside-down' });
      expect(readStoredChartLayout()).toBe('center');
      localStorage.setItem('24h-circle-planner.prefs', '{not json');
      expect(readStoredChartLayout()).toBe('center');
    });
  });
});
