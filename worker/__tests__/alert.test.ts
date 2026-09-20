import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALERT_EVERY_MS, alertBody, cleanDevices, forgetDevices, keepDevices, newAlertState,
  opsDevices, postAlert, pushOps, shouldAlert, shouldClear,
} from '../alert';

const sendWebPush = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/webpush', () => ({ sendWebPush }));

const device = (n: number) => ({ endpoint: `https://push.test/${n}`, p256dh: `k${n}`, auth: `a${n}` });
const vapid = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:x@y.z' };

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

/**
 * The devices an alert reaches when the database is the thing that is down.
 * There is no Cache API here, so these cover the isolate's own copy — the part
 * that has to work before any cache can help.
 */
describe('the admin devices kept out of the database', () => {
  beforeEach(() => {
    forgetDevices();
    sendWebPush.mockReset();
  });

  it('keeps only whole subscriptions, once each', () => {
    expect(cleanDevices([device(1), device(1), { endpoint: 'https://push.test/2' }, device(3)]))
      .toEqual([device(1), device(3)]);
  });

  it('remembers what a healthy read found, and hands it back', async () => {
    expect(await opsDevices()).toEqual([]);
    await keepDevices([device(1), device(2)]);
    expect(await opsDevices()).toEqual([device(1), device(2)]);
  });

  it('never throws away the copy for an empty read', async () => {
    await keepDevices([device(1)]);
    await keepDevices([]);
    expect(await opsDevices()).toEqual([device(1)]);
  });

  it('pushes to every device and says whether any took it', async () => {
    await keepDevices([device(1), device(2)]);
    sendWebPush.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(201);
    expect(await pushOps(vapid, 'title', 'body')).toBe(true);
    expect(sendWebPush).toHaveBeenCalledTimes(2);
    const payload = JSON.parse(sendWebPush.mock.calls[0][1] as string);
    expect(payload).toEqual({ title: 'title', body: 'body', tag: 'ops' });
  });

  it('drops a device the push service says is gone', async () => {
    await keepDevices([device(1), device(2)]);
    sendWebPush.mockResolvedValueOnce(410).mockResolvedValueOnce(201);
    await pushOps(vapid, 't', 'b');
    expect(await opsDevices()).toEqual([device(2)]);
  });

  it('says nothing when there is no key, or no device', async () => {
    await keepDevices([device(1)]);
    expect(await pushOps({}, 't', 'b')).toBe(false);
    forgetDevices();
    expect(await pushOps(vapid, 't', 'b')).toBe(false);
    expect(sendWebPush).not.toHaveBeenCalled();
  });
});
