/**
 * 24Houring API Worker — backend foundation (Pro sync, phase 1).
 *
 * Routing: `/api/*` is handled here; everything else falls through to the static
 * SPA via the ASSETS binding, so the app behaves exactly as before. Auth, sync
 * and billing routes are stubbed (501) until D1 + OAuth land in later phases
 * (see worker/README.md and docs/pro-sync-design.md).
 */

export interface Env {
  /** Static assets binding (the built SPA in ./dist). */
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  // Added once the D1 database exists (see worker/README.md):
  // DB: D1Database;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      // Liveness probe — confirms the Worker layer is deployed.
      if (url.pathname === '/api/health' && request.method === 'GET') {
        return json({ ok: true, service: '24houring-api', ts: Date.now() });
      }
      // Auth / sync / billing routes arrive in later phases.
      return json({ error: 'not_implemented' }, 501);
    }

    // Non-API request → serve the SPA (unchanged behaviour).
    return env.ASSETS.fetch(request);
  },
};
