/**
 * Read-only Google Calendar import (Pro).
 *
 *   POST /api/ical  { url }  → text/calendar
 *
 * Two reasons this goes through the Worker at all: a Google feed sends no CORS
 * headers, so the browser cannot read it directly, and the edge cache keeps us
 * from hammering Google when several devices open the calendar at once.
 *
 * The feed URL is the user's SECRET — whoever holds it can read that calendar.
 * So it travels in the REQUEST BODY, not the query string: a URL is the part of
 * a request that proxies, caches and analytics are most likely to write down,
 * and a credential has no business being there. It is never stored here, and
 * only Google's own calendar host is accepted, which also means this endpoint
 * can never be aimed at anything else (no SSRF surface). Pro only, and signed
 * in — both checked by the caller.
 */
import type { Env } from './index';

/** Google serves personal feeds from exactly one host and path prefix. */
const FEED_HOST = 'calendar.google.com';
const FEED_PATH = '/calendar/ical/';
/** A personal feed is a few hundred KB at most; refuse anything absurd. */
const MAX_BYTES = 4_000_000;
/** How long the edge may reuse one fetch. Google updates a feed slowly anyway. */
const CACHE_SECONDS = 600;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** The feed URL, or null when it is not a Google calendar feed. */
export function feedUrl(raw: string | null): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.hostname !== FEED_HOST) return null;
  if (!url.pathname.startsWith(FEED_PATH)) return null;
  return url.toString();
}

export async function handleIcalFetch(
  request: Request,
  _env: Env,
  user: { id: string } | null,
  isPro: boolean,
): Promise<Response> {
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!isPro) return json({ error: 'pro_required' }, 403);

  let asked: { url?: unknown } | null;
  try {
    asked = (await request.json()) as { url?: unknown } | null;
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const given = asked?.url;
  const target = feedUrl(typeof given === 'string' ? given : null);
  if (!target) return json({ error: 'bad_url' }, 400);

  let res: Response;
  try {
    res = await fetch(target, {
      headers: { accept: 'text/calendar, text/plain;q=0.9' },
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
    });
  } catch {
    return json({ error: 'upstream_unreachable' }, 502);
  }
  // 404 here almost always means the user reset the secret address in Google.
  if (res.status === 404) return json({ error: 'feed_not_found' }, 404);
  if (!res.ok) return json({ error: 'upstream_failed', status: res.status }, 502);

  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) return json({ error: 'too_large' }, 413);
  const body = await res.text();
  if (body.length > MAX_BYTES) return json({ error: 'too_large' }, 413);
  if (!body.includes('BEGIN:VCALENDAR')) return json({ error: 'not_a_calendar' }, 422);

  return new Response(body, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      // Private: this is one person's calendar, never a shared cache's business.
      'cache-control': `private, max-age=${CACHE_SECONDS}`,
    },
  });
}
