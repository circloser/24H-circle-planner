/**
 * Server-stored share links — the OG-unfurl half of the share feature.
 *
 * The classic `/s#d=<code>` links keep working and never touch the server; this
 * module adds short `/s/:id` links whose payload (and a client-rendered
 * 1200x630 PNG) is stored in D1, so pasting the link into KakaoTalk / X /
 * Discord / Slack unfurls into a card showing the actual ring:
 *
 *   POST /api/share              { d, name?, png? } → { id, url }
 *   GET  /api/share/:id          → { d, name }  (viewer fallback fetch)
 *   GET  /api/share/:id/og.png   → the stored unfurl image
 *   GET  /s/:id                  → SPA shell with OG tags + payload injected
 *
 * Shares are immutable and anonymous; `ip_hash` exists only to rate-limit
 * creation (30/hour/IP) and never leaves the database.
 */
import type { Env } from './index';

const ORIGIN = 'https://24houring.com';
const MAX_PAYLOAD = 8_000; // b64url chars (~6KB JSON — far above any real day)
const MAX_NAME = 120;
const MAX_PNG_B64 = 480_000; // ~360KB decoded
const RATE_LIMIT_PER_HOUR = 30;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** Short, unambiguous, URL-safe public id (10 base62 chars ≈ 59 bits). */
function newShareId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let id = '';
  for (const b of bytes) id += alphabet[b % alphabet.length];
  return id;
}

/** Salted SHA-256 of the caller IP — good enough for a creation rate limit. */
async function hashIp(request: Request): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`24h-share:${ip}`));
  return [...new Uint8Array(buf.slice(0, 16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const B64URL_RE = /^[A-Za-z0-9_-]+$/;

function decodeBase64(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** POST /api/share — store a share; returns its short URL. */
export async function handleShareCreate(request: Request, env: Env): Promise<Response> {
  if (!env.DB) return json({ error: 'unavailable' }, 503);
  let body: { d?: unknown; name?: unknown; png?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const d = typeof body.d === 'string' ? body.d : '';
  if (!d || d.length > MAX_PAYLOAD || !B64URL_RE.test(d)) return json({ error: 'bad_payload' }, 400);
  const name = (typeof body.name === 'string' ? body.name : '').slice(0, MAX_NAME);

  let png: Uint8Array | null = null;
  if (typeof body.png === 'string' && body.png) {
    if (body.png.length > MAX_PNG_B64) return json({ error: 'png_too_large' }, 400);
    png = decodeBase64(body.png);
    // PNG magic bytes — reject anything that isn't actually a PNG.
    if (png && !(png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47)) png = null;
  }

  const ipHash = await hashIp(request);
  try {
    const hourAgo = Date.now() - 3_600_000;
    const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM shares WHERE ip_hash = ? AND created_at > ?')
      .bind(ipHash, hourAgo)
      .first<{ n: number }>();
    if ((recent?.n ?? 0) >= RATE_LIMIT_PER_HOUR) return json({ error: 'rate_limited' }, 429);

    const id = newShareId();
    await env.DB.prepare('INSERT INTO shares (id, payload, name, og_png, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, d, name, png ? png.buffer : null, ipHash, Date.now())
      .run();
    return json({ id, url: `${ORIGIN}/s/${id}` });
  } catch {
    return json({ error: 'db_error' }, 500);
  }
}

/** GET /api/share/:id — payload for the viewer (fallback when injection is absent). */
export async function handleShareGet(env: Env, id: string): Promise<Response> {
  if (!env.DB) return json({ error: 'unavailable' }, 503);
  try {
    const row = await env.DB.prepare('SELECT payload, name FROM shares WHERE id = ?').bind(id).first<{ payload: string; name: string }>();
    if (!row) return json({ error: 'not_found' }, 404);
    return new Response(JSON.stringify({ d: row.payload, name: row.name }), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' },
    });
  } catch {
    return json({ error: 'db_error' }, 500);
  }
}

/** GET /api/share/:id/og.png — the stored unfurl image. */
export async function handleShareOg(env: Env, id: string): Promise<Response> {
  if (!env.DB) return new Response('unavailable', { status: 503 });
  try {
    const row = await env.DB.prepare('SELECT og_png FROM shares WHERE id = ?').bind(id).first<{ og_png: unknown }>();
    if (!row || !row.og_png) return new Response('not found', { status: 404 });
    // D1 hands BLOB columns back as a plain number array (sometimes an
    // ArrayBuffer) — normalize, or Response would serialize "137,80,78,71,…".
    const raw = row.og_png;
    const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw)
      : ArrayBuffer.isView(raw) ? new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
      : Array.isArray(raw) ? Uint8Array.from(raw as number[])
      : null;
    if (!bytes) return new Response('not found', { status: 404 });
    return new Response(bytes, {
      headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=31536000, immutable' },
    });
  } catch {
    return new Response('error', { status: 500 });
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * GET /s/:id — serve the SPA share-viewer shell with OG meta tags and the
 * payload injected, so link scrapers see the real card and the viewer renders
 * without a second round trip. Unknown ids fall through to the plain shell
 * (the client shows its "invalid link" state).
 */
export async function handleShareView(request: Request, env: Env, id: string): Promise<Response> {
  const shellReq = new Request(new URL('/s', request.url), { headers: request.headers });
  const shellRes = await env.ASSETS.fetch(shellReq);
  if (!env.DB) return shellRes;

  let row: { payload: string; name: string; has_png: number } | null;
  try {
    row = await env.DB.prepare('SELECT payload, name, (og_png IS NOT NULL) AS has_png FROM shares WHERE id = ?')
      .bind(id)
      .first<{ payload: string; name: string; has_png: number }>();
  } catch {
    row = null;
  }
  if (!row) return shellRes;

  const title = row.name ? `${row.name} · 24Houring` : '24Houring — 공유된 하루';
  const desc = '원형 24시간 시간표로 그린 하루 — 24Houring에서 눌러서 크게 보고, 내 하루도 그려보세요. A day drawn as a 24-hour circle.';
  const pageUrl = `${ORIGIN}/s/${id}`;
  const ogImg = row.has_png ? `${ORIGIN}/api/share/${id}/og.png` : `${ORIGIN}/og-image.png`;
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(desc)}" />`,
    `<meta name="robots" content="noindex" />`,
    `<link rel="canonical" href="${pageUrl}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="24Houring" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(desc)}" />`,
    `<meta property="og:url" content="${pageUrl}" />`,
    `<meta property="og:image" content="${ogImg}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:image" content="${ogImg}" />`,
    // Payload for the viewer — saves the /api/share/:id fetch on first paint.
    `<script>window.__SHARE24H__=${JSON.stringify({ id, d: row.payload })};</script>`,
  ].join('\n');

  let html = await shellRes.text();
  // Strip the shell's own social/meta tags first — link scrapers take the FIRST
  // og:* occurrence, so the generic homepage card would otherwise win.
  html = html
    .replace(/<meta (?:property="og:|name="twitter:)[^>]*\/?>\s*/g, '')
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/<meta name="description"[^>]*\/?>\s*/, '')
    .replace(/<link rel="canonical"[^>]*\/?>\s*/, '');
  html = html.includes('</head>') ? html.replace('</head>', `${tags}\n</head>`) : `${tags}\n${html}`;
  return new Response(html, {
    status: shellRes.status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Shares are immutable; let the edge keep them for an hour.
      'cache-control': 'public, max-age=3600',
    },
  });
}
