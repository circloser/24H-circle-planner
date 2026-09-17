/**
 * First-party usage counts (see src/lib/metrics-events.ts for what is counted).
 *
 *   POST /api/metrics   { e: ["calendar_open", "upgrade_open:decor", …] } → 204
 *
 * One row per KST day and name, holding a count. Nothing else is stored: no
 * user, IP, cookie or content, so the table can only ever say how often
 * something happened. The admin stats endpoint reads it back as totals.
 */
import type { Env } from './index';
import { MAX_METRICS_PER_POST, isMetricName } from '../src/lib/metrics-events';

export const SQL = {
  create: 'CREATE TABLE IF NOT EXISTS metrics (day TEXT NOT NULL, name TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, name))',
  bump: 'INSERT INTO metrics (day, name, n) VALUES (?, ?, 1) ON CONFLICT(day, name) DO UPDATE SET n = n + 1',
  since: 'SELECT day, name, n FROM metrics WHERE day >= ?',
} as const;

const MAX_BODY = 4096;
const DAY = 86_400_000;

/** A calendar day in Korea, where the service is run from. */
export const kstDay = (ms: number): string => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10);

/** The names in a posted batch that are allowed, capped. */
export function parseBatch(body: unknown): string[] {
  const e = (body as { e?: unknown } | null)?.e;
  if (!Array.isArray(e)) return [];
  return e.slice(0, MAX_METRICS_PER_POST).filter(isMetricName);
}

let ready: Promise<unknown> | null = null;
function ensureTable(db: D1Database): Promise<unknown> {
  ready ??= db.prepare(SQL.create).run().catch((err) => {
    ready = null;
    throw err;
  });
  return ready;
}

const noContent = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

export async function handleMetrics(request: Request, env: Env, now = Date.now()): Promise<Response> {
  if (!env.DB) return noContent();
  const text = await request.text();
  if (text.length > MAX_BODY) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const names = parseBatch(body);
  if (!names.length) return noContent();
  await ensureTable(env.DB);
  const day = kstDay(now);
  await env.DB.batch(names.map((name) => env.DB!.prepare(SQL.bump).bind(day, name)));
  return noContent();
}

export interface MetricRow {
  name: string;
  today: number;
  d7: number;
  d28: number;
}

/** Totals per name for today, the last 7 and the last 28 days (KST). */
export async function metricsSummary(db: D1Database, now = Date.now()): Promise<MetricRow[]> {
  await ensureTable(db);
  const today = kstDay(now);
  const from7 = kstDay(now - 6 * DAY);
  const from28 = kstDay(now - 27 * DAY);
  const rows = (await db.prepare(SQL.since).bind(from28).all<{ day: string; name: string; n: number }>()).results ?? [];
  const out = new Map<string, MetricRow>();
  for (const r of rows) {
    const row = out.get(r.name) ?? { name: r.name, today: 0, d7: 0, d28: 0 };
    row.d28 += r.n;
    if (r.day >= from7) row.d7 += r.n;
    if (r.day === today) row.today += r.n;
    out.set(r.name, row);
  }
  return [...out.values()].sort((a, b) => b.d28 - a.d28 || a.name.localeCompare(b.name));
}
