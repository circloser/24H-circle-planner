/**
 * When the database cannot answer — most often D1's daily row-read limit, which
 * is shared by every database on the Cloudflare account — an API call used to
 * throw, and the visitor got Cloudflare's generic error page (sync showed
 * "동기화 오류", Google sign-in dead-ended on an error screen).
 *
 * Those failures now answer 503 { error: 'server_busy' } with a Retry-After,
 * so the app can say the server is resting and that nothing on the device is
 * lost; the sign-in callback returns to the app with ?login=busy instead.
 */

/** Is this the database being unavailable (rather than a bug)? */
export function isDbUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /D1_ERROR|exceeded D1|row read limit|row write limit|storage limit|D1 DB is overloaded|Network connection lost/i.test(msg);
}

/** Seconds until the daily limit resets (midnight UTC), at least a minute. */
export function secondsToUtcMidnight(nowMs = Date.now()): number {
  const d = new Date(nowMs);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(60, Math.ceil((next - nowMs) / 1000));
}

/** The answer an API call gives when the database is unavailable. */
export function busyResponse(path: string, url: string, err: unknown, nowMs = Date.now()): Response {
  const daily = /limit/i.test(err instanceof Error ? err.message : String(err ?? ''));
  const retry = daily ? secondsToUtcMidnight(nowMs) : 60;
  if (path.startsWith('/api/auth/')) {
    // A browser mid sign-in: back to the app, which explains.
    return new Response(null, { status: 302, headers: { location: new URL('/?login=busy', url).toString(), 'cache-control': 'no-store' } });
  }
  return new Response(JSON.stringify({ error: 'server_busy', retryAfter: retry }), {
    status: 503,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'retry-after': String(retry) },
  });
}
