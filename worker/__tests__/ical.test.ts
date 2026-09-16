import { afterEach, describe, expect, it, vi } from 'vitest';
import { feedUrl, handleIcalFetch } from '../ical';
import type { Env } from '../index';

const env = {} as Env;
const get = (url: string) => new Request(`https://24houring.com/api/ical?url=${encodeURIComponent(url)}`);
const FEED = 'https://calendar.google.com/calendar/ical/abc%40group.calendar.google.com/private-123/basic.ics';
const user = { id: 'u1' };

afterEach(() => { vi.restoreAllMocks(); });

describe('which addresses are accepted', () => {
  it('takes a Google private feed', () => {
    expect(feedUrl(FEED)).toBe(FEED);
  });

  it('refuses anything that is not one', () => {
    // Anything else would turn this endpoint into an open fetcher — the whole
    // point of the allowlist is that it cannot be aimed at our own network.
    for (const bad of [
      null,
      '',
      'not a url',
      'http://calendar.google.com/calendar/ical/x/basic.ics', // plain http
      'https://calendar.google.com/other/path.ics',
      'https://calendar.google.com.evil.test/calendar/ical/x/basic.ics',
      'https://evil.test/calendar/ical/x/basic.ics',
      'https://127.0.0.1/calendar/ical/x/basic.ics',
      'http://169.254.169.254/latest/meta-data/',
      'file:///etc/passwd',
    ]) {
      expect(feedUrl(bad)).toBeNull();
    }
  });
});

describe('the endpoint', () => {
  it('needs a signed-in Pro account', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect((await handleIcalFetch(get(FEED), env, null, false)).status).toBe(401);
    expect((await handleIcalFetch(get(FEED), env, user, false)).status).toBe(403);
    // Neither case may reach out to Google at all.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a non-Google address before fetching anything', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await handleIcalFetch(get('https://evil.test/x.ics'), env, user, true);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_url' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('passes the calendar through when it is one', async () => {
    const body = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a\r\nEND:VEVENT\r\nEND:VCALENDAR';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { status: 200 }));
    const res = await handleIcalFetch(get(FEED), env, user, true);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/calendar');
    // One person's calendar: never cached by anything shared.
    expect(res.headers.get('cache-control')).toContain('private');
    expect(await res.text()).toBe(body);
  });

  it('tells a reset address apart from a broken feed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no', { status: 404 }));
    expect((await handleIcalFetch(get(FEED), env, user, true)).status).toBe(404);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>hi</html>', { status: 200 }));
    expect((await handleIcalFetch(get(FEED), env, user, true)).status).toBe(422);

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    expect((await handleIcalFetch(get(FEED), env, user, true)).status).toBe(502);
  });
});
