// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { Env } from '../index';
import {
  MARKETING_CONSENT_VERSION,
  SQL,
  buildOptInCsv,
  csvCell,
  handleMarketingRoute,
  newUnsubToken,
  unsubscribeUrl,
} from '../marketing';
import { MARKETING_CONSENT_VERSION as CLIENT_VERSION } from '../../src/lib/marketing';

// ── A D1 fake that understands exactly the statements marketing.ts runs ─────
function fakeDb() {
  const rows = new Map<string, { opted_in: number; version: string; decided_at: number; unsub_token: string }>();
  const users = new Map<string, string | null>();
  const db = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          args = a;
          return stmt;
        },
        async first() {
          if (sql === SQL.state) return rows.get(args[0] as string) ?? null;
          if (sql === SQL.counts) {
            let yes = 0;
            let no = 0;
            for (const r of rows.values()) {
              if (r.opted_in === 1) yes++;
              else no++;
            }
            return { yes, no };
          }
          if (sql === SQL.users) return { n: users.size };
          throw new Error(`unexpected first(): ${sql}`);
        },
        async run() {
          if (sql === SQL.upsert) {
            const [id, opted, version, decided, token] = args as [string, number, string, number, string];
            const prev = rows.get(id);
            // ON CONFLICT DO UPDATE leaves unsub_token alone.
            rows.set(id, { opted_in: opted, version, decided_at: decided, unsub_token: prev?.unsub_token ?? token });
            return { meta: { changes: 1 } };
          }
          if (sql === SQL.unsubscribe) {
            const [decided, token] = args as [number, string];
            let changes = 0;
            for (const r of rows.values()) {
              if (r.unsub_token === token) {
                r.opted_in = 0;
                r.decided_at = decided;
                changes++;
              }
            }
            return { meta: { changes } };
          }
          throw new Error(`unexpected run(): ${sql}`);
        },
        async all() {
          if (sql === SQL.exportOptIns) {
            const results = [...rows.entries()]
              .filter(([id, r]) => r.opted_in === 1 && users.get(id))
              .map(([id, r]) => ({ email: users.get(id)!, decided_at: r.decided_at, unsub_token: r.unsub_token }))
              .sort((a, b) => a.decided_at - b.decided_at);
            return { results };
          }
          throw new Error(`unexpected all(): ${sql}`);
        },
      };
      return stmt;
    },
  };
  return { env: { DB: db } as unknown as Env, rows, users };
}

/** Any database access at all is a test failure. */
const untouchable = { DB: { prepare() { throw new Error('database touched'); } } } as unknown as Env;

const alice = { id: 'u-alice', email: 'alice@example.com' };
const URL_BASE = 'https://24houring.com';
const req = (path: string, init?: RequestInit) => new Request(`${URL_BASE}${path}`, init);
const put = (body: unknown) =>
  req('/api/marketing', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('consent notice version', () => {
  it('is the same on the worker and in the app', () => {
    // The app sends the version it displayed; a mismatch makes every choice a 409.
    expect(CLIENT_VERSION).toBe(MARKETING_CONSENT_VERSION);
  });
});

describe('csv export', () => {
  it('neutralises spreadsheet formulas and quotes per RFC 4180', () => {
    expect(csvCell('plain@example.com')).toBe('plain@example.com');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe(`'+1`);
    expect(csvCell('@cmd')).toBe(`'@cmd`);
    expect(csvCell('a,b')).toBe('"a,b"');
  });

  it('carries a working unsubscribe link for every recipient', () => {
    const csv = buildOptInCsv([{ email: 'a@example.com', decided_at: Date.UTC(2026, 8, 11), unsub_token: 'T'.repeat(24) }]);
    expect(csv.startsWith('\uFEFFemail,agreed_at,unsubscribe_url\r\n')).toBe(true);
    expect(csv).toContain(`a@example.com,2026-09-11T00:00:00.000Z,${unsubscribeUrl('T'.repeat(24))}`);
  });

  it('mints unguessable 24-char tokens', () => {
    const t = newUnsubToken();
    expect(t).toMatch(/^[A-Za-z0-9]{24}$/);
    expect(newUnsubToken()).not.toBe(t);
  });
});

describe('routing and validation', () => {
  it('ignores paths that are not its own', async () => {
    expect(await handleMarketingRoute(req('/api/me'), untouchable, '/api/me', 'GET', alice, false)).toBeNull();
    expect(await handleMarketingRoute(req('/api/marketing'), untouchable, '/api/marketing', 'DELETE', alice, false)).toBeNull();
  });

  it('requires a signed-in user to read or record a choice', async () => {
    expect((await handleMarketingRoute(req('/api/marketing'), untouchable, '/api/marketing', 'GET', null, false))!.status).toBe(401);
    expect((await handleMarketingRoute(put({ optIn: true, version: MARKETING_CONSENT_VERSION }), untouchable, '/api/marketing', 'PUT', null, false))!.status).toBe(401);
  });

  it('rejects a malformed choice before touching the database', async () => {
    for (const body of [{}, { optIn: 'yes', version: MARKETING_CONSENT_VERSION }, { optIn: 1, version: MARKETING_CONSENT_VERSION }]) {
      const res = await handleMarketingRoute(put(body), untouchable, '/api/marketing', 'PUT', alice, false);
      expect(res!.status).toBe(400);
    }
  });

  it('refuses a choice made against an older notice', async () => {
    const res = await handleMarketingRoute(put({ optIn: true, version: '2020-01-01' }), untouchable, '/api/marketing', 'PUT', alice, false);
    expect(res!.status).toBe(409);
    expect(await res!.json()).toMatchObject({ error: 'stale_notice', version: MARKETING_CONSENT_VERSION });
  });

  it('keeps the list and the counts to admins', async () => {
    const path = '/api/admin/marketing';
    expect((await handleMarketingRoute(req(path), untouchable, path, 'GET', null, false))!.status).toBe(401);
    expect((await handleMarketingRoute(req(path), untouchable, path, 'GET', alice, false))!.status).toBe(403);
    expect((await handleMarketingRoute(req(`${path}?format=csv`), untouchable, path, 'GET', alice, false))!.status).toBe(403);
  });

  it('never renders an unvalidated token into the page', async () => {
    const path = '/api/marketing/unsubscribe';
    const evil = encodeURIComponent('"><script>alert(1)</script>');
    const res = await handleMarketingRoute(req(`${path}?t=${evil}`), untouchable, path, 'GET', null, false);
    expect(res!.status).toBe(400);
    expect(await res!.text()).not.toContain('<script>alert');
  });
});

describe('consent lifecycle', () => {
  it('starts undecided, which is not consent', async () => {
    const { env } = fakeDb();
    const res = await handleMarketingRoute(req('/api/marketing'), env, '/api/marketing', 'GET', alice, false);
    expect(await res!.json()).toEqual({ decided: false, optIn: false, version: MARKETING_CONSENT_VERSION, decidedAt: null });
  });

  it('records a yes with the notice version and time, then a change of mind keeps the same token', async () => {
    const { env, rows } = fakeDb();
    const yes = await handleMarketingRoute(put({ optIn: true, version: MARKETING_CONSENT_VERSION }), env, '/api/marketing', 'PUT', alice, false);
    const state = await yes!.json();
    expect(state).toMatchObject({ decided: true, optIn: true, version: MARKETING_CONSENT_VERSION });
    expect(typeof state.decidedAt).toBe('number');
    const token = rows.get(alice.id)!.unsub_token;

    await handleMarketingRoute(put({ optIn: false, version: MARKETING_CONSENT_VERSION }), env, '/api/marketing', 'PUT', alice, false);
    expect(rows.get(alice.id)).toMatchObject({ opted_in: 0, unsub_token: token });
  });

  it('unsubscribes with one POST and no login, while a GET only asks', async () => {
    const { env, rows } = fakeDb();
    await handleMarketingRoute(put({ optIn: true, version: MARKETING_CONSENT_VERSION }), env, '/api/marketing', 'PUT', alice, false);
    const token = rows.get(alice.id)!.unsub_token;
    const path = '/api/marketing/unsubscribe';

    const peek = await handleMarketingRoute(req(`${path}?t=${token}`), env, path, 'GET', null, false);
    expect(peek!.status).toBe(200);
    expect(await peek!.text()).toContain('method="post"');
    expect(rows.get(alice.id)!.opted_in).toBe(1); // a mail scanner's pre-fetch changes nothing

    const done = await handleMarketingRoute(req(`${path}?t=${token}`, { method: 'POST', body: 'List-Unsubscribe=One-Click' }), env, path, 'POST', null, false);
    expect(done!.status).toBe(200);
    expect(rows.get(alice.id)!.opted_in).toBe(0);

    const unknown = await handleMarketingRoute(req(`${path}?t=${'x'.repeat(24)}`, { method: 'POST' }), env, path, 'POST', null, false);
    expect(unknown!.status).toBe(404);
  });

  it('exports only people who said yes, and counts the rest honestly', async () => {
    const { env, users } = fakeDb();
    users.set('u-alice', 'alice@example.com');
    users.set('u-bob', 'bob@example.com');
    users.set('u-carol', 'carol@example.com');
    await handleMarketingRoute(put({ optIn: true, version: MARKETING_CONSENT_VERSION }), env, '/api/marketing', 'PUT', { id: 'u-alice', email: 'alice@example.com' }, false);
    await handleMarketingRoute(put({ optIn: false, version: MARKETING_CONSENT_VERSION }), env, '/api/marketing', 'PUT', { id: 'u-bob', email: 'bob@example.com' }, false);

    const path = '/api/admin/marketing';
    const counts = await handleMarketingRoute(req(path), env, path, 'GET', alice, true);
    expect(await counts!.json()).toEqual({ optedIn: 1, declined: 1, undecided: 1, version: MARKETING_CONSENT_VERSION });

    const csv = await handleMarketingRoute(req(`${path}?format=csv`), env, path, 'GET', alice, true);
    expect(csv!.headers.get('content-type')).toContain('text/csv');
    const text = await csv!.text();
    expect(text).toContain('alice@example.com');
    expect(text).not.toContain('bob@example.com');
    expect(text).not.toContain('carol@example.com');
  });
});
