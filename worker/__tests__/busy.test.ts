// @vitest-environment node
import { describe, it, expect } from 'vitest';
import worker, { type Env } from '../index';
import { busyResponse, isDbUnavailable, secondsToUtcMidnight } from '../busy';

const LIMIT = new Error("D1_ERROR: Your account has exceeded D1's free tier daily row read limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue.");

/** A database that refuses every query, as D1 does past the daily limit. */
const refusingDb = () => ({
  prepare() {
    const stmt = {
      bind: () => stmt,
      first: async () => { throw LIMIT; },
      all: async () => { throw LIMIT; },
      run: async () => { throw LIMIT; },
    };
    return stmt;
  },
  batch: async () => { throw LIMIT; },
}) as unknown as D1Database;

describe('when the database is not answering', () => {
  it('recognises D1 limit and outage errors, and nothing else', () => {
    expect(isDbUnavailable(LIMIT)).toBe(true);
    expect(isDbUnavailable(new Error('D1_ERROR: D1 DB is overloaded'))).toBe(true);
    expect(isDbUnavailable(new TypeError('x is undefined'))).toBe(false);
  });

  it('counts down to midnight UTC for the daily limit', () => {
    expect(secondsToUtcMidnight(Date.UTC(2026, 8, 18, 23, 0, 0))).toBe(3600);
    expect(secondsToUtcMidnight(Date.UTC(2026, 8, 18, 23, 59, 30))).toBe(60);
  });

  it('answers API calls 503 server_busy with Retry-After', async () => {
    const res = busyResponse('/api/sync', 'https://24houring.com/api/sync', LIMIT, Date.UTC(2026, 8, 18, 15, 0, 0));
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe(String(9 * 3600));
    expect(await res.json()).toEqual({ error: 'server_busy', retryAfter: 9 * 3600 });
  });

  it('sends a sign-in back to the app instead of an error page', () => {
    const res = busyResponse('/api/auth/google/callback', 'https://24houring.com/api/auth/google/callback?code=x', LIMIT);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://24houring.com/?login=busy');
  });

  it('is what the Worker returns when a route hits the refused database', async () => {
    const env = { DB: refusingDb(), ASSETS: { fetch: async () => new Response('app') } } as unknown as Env;
    // A signed-in device syncing, and asking who it is.
    for (const path of ['/api/sync', '/api/me']) {
      const res = await worker.fetch(new Request(`https://24houring.com${path}`, { headers: { cookie: 'sid=abc' } }), env);
      expect(res.status, path).toBe(503);
      expect((await res.json()).error).toBe('server_busy');
    }
    // Pages that never touch the database are unaffected.
    expect(await (await worker.fetch(new Request('https://24houring.com/'), env)).text()).toBe('app');
  });
});
