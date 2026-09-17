import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushMetrics, track, trackOnce } from '../track';
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
