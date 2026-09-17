import { afterEach, describe, expect, it, vi } from 'vitest';
import { gaWanted, isLiveSite, safePageLocation } from '../ga';
import { needsConsent } from '../../../worker/geo';

describe('Google Analytics gating', () => {
  afterEach(() => vi.restoreAllMocks());

  it('runs only on the live site', () => {
    expect(isLiveSite({ protocol: 'https:', hostname: '24houring.com' })).toBe(true);
    expect(isLiveSite({ protocol: 'https:', hostname: 'www.24houring.com' })).toBe(true);
    expect(isLiveSite({ protocol: 'http:', hostname: 'localhost' })).toBe(false);
    expect(isLiveSite({ protocol: 'file:', hostname: '' })).toBe(false);
    expect(isLiveSite({ protocol: 'https:', hostname: '24houringp.workers.dev' })).toBe(false);
    expect(isLiveSite({ protocol: 'https:', hostname: 'evil24houring.com' })).toBe(false);
  });

  it('asks first in the EEA, the UK and Switzerland — and when the country is unknown', () => {
    for (const c of ['DE', 'FR', 'IE', 'NO', 'IS', 'LI', 'GB', 'CH']) expect(needsConsent(c)).toBe(true);
    for (const c of ['KR', 'US', 'JP', 'BR', 'IN']) expect(needsConsent(c)).toBe(false);
    for (const c of [undefined, '', 'XX', 'T1', 'kr', 'KOR']) expect(needsConsent(c)).toBe(true);
  });

  it('lets the visitor’s own choice win over the region default', () => {
    expect(gaWanted(null, false)).toBe(true);
    expect(gaWanted(null, true)).toBe(false);
    expect(gaWanted('denied', false)).toBe(false);
    expect(gaWanted('granted', true)).toBe(true);
  });

  it('never sends share codes or sign-in details to Google', () => {
    expect(safePageLocation('https://24houring.com/s#d=abc')).toBe('https://24houring.com/s');
    expect(safePageLocation('https://24houring.com/?login=ok&token=x#p=zzz')).toBe('https://24houring.com/');
    expect(safePageLocation('https://24houring.com/ko/?utm_source=naver&utm_medium=social&x=1'))
      .toBe('https://24houring.com/ko/?utm_source=naver&utm_medium=social');
    expect(safePageLocation('https://24houring.com/?utm_source=' + encodeURIComponent('<script>'))).toBe('https://24houring.com/');
  });
});

describe('GA events before and after the decision', () => {
  it('queues events until GA starts, and drops them when it does not', async () => {
    vi.resetModules();
    const ga = await import('../ga');
    const w = window as unknown as { dataLayer?: unknown[] };
    delete w.dataLayer;
    ga.gaEvent('calendar_open');
    // jsdom is not the live site: the decision is "off", and nothing is sent.
    expect(await ga.startAnalytics()).toBe(false);
    ga.gaEvent('calendar_open');
    expect(w.dataLayer ?? []).toHaveLength(0);
    expect(ga.gaActive()).toBe(false);
  });
});
