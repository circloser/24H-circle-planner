import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRACKED_FEATURES, TRACKED_VIEWS, flushMetrics, track, trackOnce } from '../track';
import { isMetricName, metricName } from '../metrics-events';
import { requestUpgrade, takeUpgradeSource } from '../pro';

const sent = () => {
  const beacon = vi.fn((_url: string, _body: Blob) => true);
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
  return beacon;
};
const names = async (beacon: ReturnType<typeof sent>) =>
  (await Promise.all(beacon.mock.calls.map(([, b]) => b.text()))).flatMap((t) => JSON.parse(t).e as string[]);

describe('first-party usage counts', () => {
  afterEach(() => {
    localStorage.clear();
    flushMetrics();
  });

  it('stays silent on a local build', () => {
    const beacon = sent();
    track('calendar_open');
    flushMetrics();
    expect(beacon).not.toHaveBeenCalled();
  });

  it('sends known events, tagged, in one batch', async () => {
    localStorage.setItem('24h-metrics-debug', '1');
    const beacon = sent();
    track('calendar_open');
    track('upgrade_open', { source: 'decor' });
    track('not_an_event');
    track('preset_load', { preset: '내 시간표' });
    trackOnce('app_open');
    trackOnce('app_open');
    flushMetrics();
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0][0]).toBe('/api/metrics');
    expect(await names(beacon)).toEqual(['calendar_open', 'upgrade_open:decor', 'preset_load', 'app_open']);
  });
});

describe('where the paywall was asked for', () => {
  it('is read once, and a click event is not a source', () => {
    requestUpgrade('decor');
    expect(takeUpgradeSource()).toBe('decor');
    expect(takeUpgradeSource()).toBe('direct');
    requestUpgrade(new MouseEvent('click'));
    expect(takeUpgradeSource()).toBe('other');
  });
});

describe('where people go and what they do', () => {
  it('counts every page of the app under a name the server will take', () => {
    for (const view of TRACKED_VIEWS) expect(metricName('view_open', { view })).toBe(`view_open:${view}`);
  });

  it('counts every feature under a name the server will take', () => {
    for (const f of TRACKED_FEATURES) expect(metricName('feature_use', { feature: f })).toBe(`feature_use:${f}`);
  });

  it('drops a name that is not on either list rather than storing it', () => {
    expect(metricName('view_open', { view: 'whatever' })).toBe('view_open');
    expect(isMetricName('feature_use:what_they_typed')).toBe(false);
  });
});
