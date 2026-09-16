import { describe, expect, it } from 'vitest';
import worker from '../index';
import type { Env } from '../index';

/**
 * A session that is being used must not quietly run out. The cookie is written
 * at login and nowhere else, and a phone browser routinely shortens the life of
 * a cookie set right after a cross-site redirect — which is exactly what coming
 * back from Google is. A device that falls out of its session stops syncing, so
 * /api/me pushes the session back out every time it answers.
 */
function dbWith(user: { id: string; email: string | null; provider: string } | null) {
  const updates: Array<unknown[]> = [];
  const db = {
    prepare(sql: string) {
      const bound: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) { bound.push(...args); return statement; },
        async first() {
          if (sql.includes('FROM sessions')) return user;
          return null;
        },
        async run() {
          if (sql.startsWith('UPDATE sessions')) updates.push(bound);
          return { results: [], success: true, meta: {} };
        },
        async all() { return { results: [], success: true, meta: {} }; },
      };
      return statement;
    },
    async exec() { return { count: 0, duration: 0 }; },
    async batch() { return []; },
  };
  return { db, updates };
}

const me = (cookie?: string) =>
  new Request('https://24houring.com/api/me', { headers: cookie ? { cookie } : {} });

const waiter = { waitUntil: (p: Promise<unknown>) => { void p; } };

describe('a session in use', () => {
  it('is handed back a fresh cookie, and its expiry is pushed out', async () => {
    const { db, updates } = dbWith({ id: 'u1', email: 'a@b.c', provider: 'google' });
    const env = { DB: db } as unknown as Env;
    const res = await worker.fetch(me('sid=tok123'), env, waiter);
    expect(res.status).toBe(200);

    const set = res.headers.get('set-cookie') ?? '';
    expect(set).toContain('sid=tok123');
    expect(set).toContain('HttpOnly');
    expect(set).toContain('Secure');
    expect(set).toContain('SameSite=Lax');
    // 60 days, the same life a fresh login gets.
    expect(set).toContain(`Max-Age=${60 * 24 * 60 * 60}`);
    expect(updates).toHaveLength(1);
  });

  it('gives a stranger no cookie at all', async () => {
    const { db } = dbWith(null);
    const env = { DB: db } as unknown as Env;
    for (const req of [me(), me('sid=nope')]) {
      const res = await worker.fetch(req, env, waiter);
      expect(await res.json()).toEqual({ user: null });
      expect(res.headers.get('set-cookie')).toBeNull();
    }
  });
});
