import { afterEach, describe, expect, it } from 'vitest';
import { CHART_LAYOUTS, chartCentreLeft, effectiveChartLayout, isChartLayout, readStoredChartLayout } from '../chart-layout';
import type { ChartView } from '../chart-view';

const desk = { isMobile: false, chartView: 'full' as ChartView, tutorialOpen: false };
const savePrefs = (prefs: object) =>
  localStorage.setItem('24h-circle-planner.prefs', JSON.stringify({ version: 1, prefs }));

describe('chart layout', () => {
  it('knows exactly the four layouts', () => {
    expect([...CHART_LAYOUTS]).toEqual(['center', 'left', 'right', 'hidden']);
    expect(isChartLayout('left')).toBe(true);
    expect(isChartLayout('top')).toBe(false);
    expect(isChartLayout(undefined)).toBe(false);
  });

  it('renders the chosen layout on a desktop circle view', () => {
    for (const layout of CHART_LAYOUTS) expect(effectiveChartLayout(layout, desk)).toBe(layout);
    expect(effectiveChartLayout('left', { ...desk, chartView: 'day' })).toBe('left');
    expect(effectiveChartLayout('right', { ...desk, chartView: 'night' })).toBe('right');
  });

  it('keeps phones, the table and the record view centred', () => {
    expect(effectiveChartLayout('left', { ...desk, isMobile: true })).toBe('center');
    expect(effectiveChartLayout('hidden', { ...desk, isMobile: true })).toBe('center');
    expect(effectiveChartLayout('hidden', { ...desk, chartView: 'table' })).toBe('center');
    expect(effectiveChartLayout('right', { ...desk, chartView: 'record' })).toBe('center');
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

  it('centres fixed overlays over the chart', () => {
    expect(chartCentreLeft('center')).toBe('50%');
    expect(chartCentreLeft('hidden')).toBe('50%');
    expect(chartCentreLeft('left')).toMatch(/^calc\(40px \+ min\(720px/);
    expect(chartCentreLeft('right')).toMatch(/^calc\(100vw - 40px - min\(720px/);
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
