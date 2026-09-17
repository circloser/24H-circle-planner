// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Env } from '../index';
import { SQL, handleMetrics, kstDay, metricsSummary, parseBatch } from '../metrics';
import { METRIC_EVENTS, isMetricName, metricName } from '../../src/lib/metrics-events';

/** A D1 fake for the three statements metrics.ts runs. */
function fakeDb() {
  const rows = new Map<string, number>();
  const prepare = (sql: string) => {
    let args: unknown[] = [];
    const stmt = {
      bind(...a: unknown[]) { args = a; return stmt; },
      async run() {
        if (sql === SQL.create) return {};
        throw new Error(`unexpected run(): ${sql}`);
      },
      async all() {
        if (sql !== SQL.since) throw new Error(`unexpected all(): ${sql}`);
        const from = args[0] as string;
        return {
          results: [...rows.entries()]
            .map(([k, n]) => { const [day, name] = k.split('|'); return { day, name, n }; })
            .filter((r) => r.day >= from),
        };
      },
      sql,
      args: () => args,
    };
    return stmt;
  };
  const db = {
    prepare,
    async batch(stmts: ReturnType<typeof prepare>[]) {
      for (const s of stmts) {
        if (s.sql !== SQL.bump) throw new Error(`unexpected batch: ${s.sql}`);
        const [day, name] = s.args() as [string, string];
        rows.set(`${day}|${name}`, (rows.get(`${day}|${name}`) ?? 0) + 1);
      }
      return [];
    },
  };
  return { db: db as unknown as D1Database, rows };
}

const post = (body: unknown) =>
  new Request('https://24houring.com/api/metrics', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });

describe('usage counts', () => {
  const NOW = Date.UTC(2026, 8, 17, 20, 0); // 18 Sep, 05:00 in Korea

  it('names events with at most one plain tag', () => {
    expect(metricName('upgrade_open', { source: 'decor' })).toBe('upgrade_open:decor');
    expect(metricName('decor_place', { kind: 'photo', other: 'x' })).toBe('decor_place:photo');
    // Free text, numbers and unknown events never become names.
    expect(metricName('preset_load', { preset: '내 시간표' })).toBe('preset_load');
    expect(metricName('day_complete', { total: 5 })).toBe('day_complete');
    expect(metricName('whatever')).toBeNull();
    expect(isMetricName('calendar_open')).toBe(true);
    expect(isMetricName('calendar_open:a:b')).toBe(false);
    expect(isMetricName('calendar_open:Hello World')).toBe(false);
    expect(isMetricName('drop table')).toBe(false);
    // A made-up tag is dropped (the event still counts) and never stored.
    expect(metricName('upgrade_open', { source: 'zzzz1234' })).toBe('upgrade_open');
    expect(isMetricName('upgrade_open:zzzz1234')).toBe(false);
  });

  it('counts only known names, capped per request', () => {
    const many = Array.from({ length: 30 }, () => 'app_open');
    expect(parseBatch({ e: many })).toHaveLength(20);
    expect(parseBatch({ e: ['app_open', 'nope', 42, 'cal_image:shared'] })).toEqual(['app_open', 'cal_image:shared']);
    expect(parseBatch({})).toEqual([]);
  });

  it('adds one per event to the Korean day, and stores nothing else', async () => {
    const { db, rows } = fakeDb();
    const env = { DB: db } as unknown as Env;
    expect((await handleMetrics(post({ e: ['calendar_open', 'calendar_open', 'upgrade_open:decor'] }), env, NOW)).status).toBe(204);
    expect(kstDay(NOW)).toBe('2026-09-18');
    expect(Object.fromEntries(rows)).toEqual({ '2026-09-18|calendar_open': 2, '2026-09-18|upgrade_open:decor': 1 });
    expect((await handleMetrics(post('not json'), env, NOW)).status).toBe(400);
    expect((await handleMetrics(post('x'.repeat(5000)), env, NOW)).status).toBe(413);
    expect((await handleMetrics(post({ e: ['nope'] }), env, NOW)).status).toBe(204);
    expect(rows.size).toBe(2);
  });

  it('sums today, 7 and 28 days for the admin', async () => {
    const { db, rows } = fakeDb();
    rows.set('2026-09-18|calendar_open', 3);
    rows.set('2026-09-14|calendar_open', 2);
    rows.set('2026-08-25|calendar_open', 5); // 25 days back: in 28, not in 7
    rows.set('2026-08-01|calendar_open', 9); // outside 28
    rows.set('2026-09-17|cal_image:shared', 1);
    expect(await metricsSummary(db, NOW)).toEqual([
      { name: 'calendar_open', today: 3, d7: 5, d28: 10 },
      { name: 'cal_image:shared', today: 0, d7: 1, d28: 1 },
    ]);
  });

  it('keeps every tag the app sends', () => {
    // requestUpgrade('…') sources, and the tag values passed to track().
    const found = new Set<string>();
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) { if (f !== '__tests__') walk(p); continue; }
        if (!/\.tsx?$/.test(f)) continue;
        const text = readFileSync(p, 'utf8');
        for (const m of text.matchAll(/requestUpgrade\('([a-z_]+)'\)/g)) found.add(m[1]);
        for (const m of text.matchAll(/\btrack(?:Once)?\('[a-z_]+', \{ \w+: '([a-z_]+)' \}\)/g)) found.add(m[1]);
      }
    };
    walk(join(__dirname, '../../src'));
    expect(found.has('decor') && found.has('watermark')).toBe(true);
    expect([...found].filter((tag) => !isMetricName(`app_open:${tag}`))).toEqual([]);
  });

  it('knows every event the app tracks', () => {
    // Walk src/ for track('…') / trackOnce('…') calls: each must be countable.
    const found = new Set<string>();
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) { if (f !== '__tests__') walk(p); continue; }
        if (!/\.tsx?$/.test(f)) continue;
        for (const m of readFileSync(p, 'utf8').matchAll(/\btrack(?:Once)?\('([a-z_]+)'/g)) found.add(m[1]);
      }
    };
    walk(join(__dirname, '../../src'));
    expect(found.size).toBeGreaterThan(20);
    const known = new Set<string>(METRIC_EVENTS);
    expect([...found].filter((e) => !known.has(e))).toEqual([]);
  });
});
