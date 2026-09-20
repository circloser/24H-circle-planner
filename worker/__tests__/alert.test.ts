import { describe, expect, it, vi } from 'vitest';
import { ALERT_EVERY_MS, alertBody, newAlertState, postAlert, shouldAlert, shouldClear } from '../alert';

describe('operator alerts', () => {
  it('reports a kind once per window, however often it happens', () => {
    const s = newAlertState();
    const t0 = 1_000_000;
    expect(shouldAlert(s, 'db', t0)).toBe(true);
    expect(shouldAlert(s, 'db', t0 + 60_000)).toBe(false);
    expect(shouldAlert(s, 'db', t0 + ALERT_EVERY_MS)).toBe(true);
  });

  it('keeps kinds apart', () => {
    const s = newAlertState();
    expect(shouldAlert(s, 'db', 0)).toBe(true);
    expect(shouldAlert(s, 'cron', 0)).toBe(true);
  });

  it('says "back again" only after it said something was wrong', () => {
    const s = newAlertState();
    expect(shouldClear(s, 'db')).toBe(false);
    shouldAlert(s, 'db', 0);
    expect(shouldClear(s, 'db')).toBe(true);
    expect(shouldClear(s, 'db')).toBe(false);
    // …and the next trouble is reported at once, not after the window.
    expect(shouldAlert(s, 'db', 1000)).toBe(true);
  });

  it('speaks what Slack and Discord both read', () => {
    expect(JSON.parse(alertBody('x'))).toEqual({ text: 'x', content: 'x' });
  });

  it('does nothing without a webhook, and never throws when one fails', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await postAlert(undefined, 'x')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    expect(await postAlert('https://example.test/hook', 'x')).toBe(false);
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await postAlert('https://example.test/hook', 'x')).toBe(true);
    fetchSpy.mockRestore();
  });
});
