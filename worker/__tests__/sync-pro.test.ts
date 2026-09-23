import { describe, expect, it } from 'vitest';
import worker from '../index';
import type { Env } from '../index';

/**
 * Sync is Pro on the server as well as in the app. The app has always switched
 * it off for a free account, but the server used to take anybody signed in —
 * so a free account could sync by calling it directly.
 */
function envFor(plan: 'free' | 'pro' | 'granted', stored: { blob: string; version: number } | null = null) {
  const writes: string[] = [];
  const db = {
    prepare(sql: string) {
      const statement = {
        bind() { return statement; },
        async first() {
          if (sql.includes('FROM sessions')) return { id: 'u1', email: 'someone@example.com', provider: 'google' };
          if (sql.includes('FROM subscriptions')) {
            return plan === 'pro' ? { status: 'active', current_period_end: Date.now() + 86_400_000 } : null;
          }
          if (sql.includes('FROM grants')) return plan === 'granted' ? { 1: 1 } : null;
          if (sql.includes('FROM sync_data')) {
            return stored ? { ...stored, updated_at: 1, device_label: null } : null;
          }
          return null;
        },
        async run() { writes.push(sql); return { results: [], success: true, meta: {} }; },
        async all() { return { results: [], success: true, meta: {} }; },
      };
      return statement;
    },
    async exec() { return { count: 0, duration: 0 }; },
    async batch() { return []; },
  };
  const env = { DB: db, ASSETS: { fetch: async () => new Response('app') } } as unknown as Env;
  return { env, writes };
}

const get = () => new Request('https://24houring.com/api/sync', { headers: { cookie: 'sid=abc' } });
const put = () => new Request('https://24houring.com/api/sync', {
  method: 'PUT',
  headers: { cookie: 'sid=abc', 'content-type': 'application/json' },
  body: JSON.stringify({ blob: '{"v":1,"data":{}}', baseVersion: 0, deviceLabel: 'test' }),
});

describe('sync is Pro on the server', () => {
  it('refuses a free account both ways, with 402, and writes nothing', async () => {
    const { env, writes } = envFor('free', { blob: 'old', version: 3 });
    const r1 = await worker.fetch(get(), env);
    expect(r1.status).toBe(402);
    expect((await r1.json()).error).toBe('pro_required');
    const r2 = await worker.fetch(put(), env);
    expect(r2.status).toBe(402);
    // Refused, not wiped: whatever was stored stays where it is.
    expect(writes.filter((s) => /sync_data/.test(s))).toEqual([]);
  });

  it('lets a subscriber through', async () => {
    const { env } = envFor('pro');
    expect((await worker.fetch(get(), env)).status).toBe(204);
    expect((await worker.fetch(put(), env)).status).toBe(200);
  });

  it('lets a coupon holder through as well', async () => {
    const { env } = envFor('granted', { blob: 'kept', version: 2 });
    const res = await worker.fetch(get(), env);
    expect(res.status).toBe(200);
    expect((await res.json()).blob).toBe('kept');
  });

  it('still says 401 to nobody at all', async () => {
    const { env } = envFor('pro');
    const res = await worker.fetch(new Request('https://24houring.com/api/sync'), env);
    expect(res.status).toBe(401);
  });
});
