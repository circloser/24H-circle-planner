import { afterEach, describe, expect, it, vi } from 'vitest';
import { feedUrl, handleIcalFetch } from '../ical';
import type { Env } from '../index';

const env = {} as Env;
/** The address travels in the body, never in the URL. */
const get = (url: string) => new Request('https://24houring.com/api/ical', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ url }),
});
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

  it('keeps the address out of the request URL', async () => {
    const req = get(FEED);
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://24houring.com/api/ical');
    expect(req.url).not.toContain('private-');
  });

  it('refuses a body that is not JSON, or carries no address', async () => {
    const bare = new Request('https://24houring.com/api/ical', { method: 'POST', body: 'not json' });
    expect((await handleIcalFetch(bare, env, user, true)).status).toBe(400);
    const empty = new Request('https://24houring.com/api/ical', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    expect((await handleIcalFetch(empty, env, user, true)).status).toBe(400);
  });

  it('rejects a non-Google address before fetching anything', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await handleIcalFetch(get('https://evil.test/x.ics'), env, user, true);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_url' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('hands the feed over exactly as Google sent it', async () => {
    // Nothing is parsed or cut here — that would cost more CPU than the free
    // plan allows on a long-lived calendar. The app trims it instead.
    const old = ['BEGIN:VEVENT', 'UID:old', 'DTSTART;VALUE=DATE:20190105', 'END:VEVENT'];
    const now = ['BEGIN:VEVENT', 'UID:now', 'DTSTART;VALUE=DATE:20260920', 'END:VEVENT'];
    const whole = ['BEGIN:VCALENDAR', 'X-WR-CALNAME:mine', ...old, ...now, 'END:VCALENDAR'].join(String.fromCharCode(13, 10));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(whole, { status: 200, headers: { 'content-type': 'text/calendar; charset=UTF-8' } }),
    );
    const res = await handleIcalFetch(get(FEED), env, user, true);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(whole);
  });

  it('labels the answer so the edge compresses it, and keeps it private', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('BEGIN:VCALENDAR', { status: 200, headers: { 'content-type': 'text/calendar' } }),
    );
    const res = await handleIcalFetch(get(FEED), env, user, true);
    expect(res.headers.get('content-type')).toContain('text/plain');
    // One person's calendar: never cached by anything shared.
    expect(res.headers.get('cache-control')).toContain('private');
  });

  it('refuses a feed that declares itself too large', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('BEGIN:VCALENDAR', {
        status: 200,
        headers: { 'content-type': 'text/calendar', 'content-length': String(9_000_000) },
      }),
    );
    expect((await handleIcalFetch(get(FEED), env, user, true)).status).toBe(413);
  });

  it('tells a reset address apart from a broken feed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no', { status: 404 }));
    expect((await handleIcalFetch(get(FEED), env, user, true)).status).toBe(404);

    // A page that is not a calendar is told apart by its type, without reading it.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>hi</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    );
    expect((await handleIcalFetch(get(FEED), env, user, true)).status).toBe(422);

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    expect((await handleIcalFetch(get(FEED), env, user, true)).status).toBe(502);
  });
});
