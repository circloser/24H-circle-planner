/**
 * Android home-screen widget image slots.
 *
 * The native widget cannot read the web app's storage, so the app publishes a
 * transparent PNG of the ring to a slot keyed by a secret token that only the
 * phone knows, and the widget polls that slot:
 *
 *   PUT    /api/widget/:token       { png, meta }  → { ok, etag }   (upsert)
 *   GET    /api/widget/:token/png   → image/png + ETag + X-Widget-Meta
 *   DELETE /api/widget/:token       → { ok }                          (unlink)
 *
 * Unlike shares, a slot is mutable and bounded: every edit overwrites the same
 * row, so a phone never accumulates images. The token is the only credential —
 * 22 base62 chars (~131 bits) generated client-side — and never appears in a
 * shareable URL. `meta` is opaque JSON the widget uses to draw the live
 * current-time hand on top of the image (ring geometry in pixels + the view
 * window), so the image itself can stay a static render.
 */
import type { Env } from './index';

const TOKEN_RE = /^[A-Za-z0-9]{16,32}$/;
const MAX_PNG_B64 = 480_000; // ~360KB decoded — same ceiling as shares
const MAX_META = 2_000;
/** Uploads per token per hour. Edits are debounced client-side (~2.5s), so a
 *  legitimate session never gets near this; it only bounds abuse. */
const UPLOADS_PER_HOUR = 120;
/** New slots per IP per hour (each phone makes exactly one). */
const CREATES_PER_HOUR = 30;
const HOUR = 3_600_000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function hashIp(request: Request): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`24h-widget:${ip}`));
  return [...new Uint8Array(buf.slice(0, 16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function decodeBase64(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

const isPng = (b: Uint8Array): boolean => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

/** Strong ETag = first 16 bytes of SHA-256 over the image bytes. */
async function etagOf(png: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', png);
  return `"${[...new Uint8Array(buf.slice(0, 16))].map((b) => b.toString(16).padStart(2, '0')).join('')}"`;
}

/** D1 hands BLOBs back as a number array, an ArrayBuffer, or a view — normalize. */
function toBytes(raw: unknown): Uint8Array | null {
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (ArrayBuffer.isView(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  if (Array.isArray(raw)) return Uint8Array.from(raw as number[]);
  return null;
}

/** Keep `meta` a small flat JSON object — the widget parses it natively. */
function sanitizeMeta(raw: unknown): string | null {
  if (raw === undefined) return '{}';
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const out: Record<string, number | string | boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-zA-Z][a-zA-Z0-9]{0,31}$/.test(k)) return null;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string' && v.length <= 64) out[k] = v;
    else return null;
  }
  const s = JSON.stringify(out);
  return s.length > MAX_META ? null : s;
}

export function isWidgetToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

/** PUT /api/widget/:token — create or overwrite the phone's image slot. */
export async function handleWidgetPut(request: Request, env: Env, token: string): Promise<Response> {
  if (!env.DB) return json({ error: 'unavailable' }, 503);
  if (!isWidgetToken(token)) return json({ error: 'bad_token' }, 400);
  let body: { png?: unknown; meta?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  if (typeof body.png !== 'string' || !body.png) return json({ error: 'bad_payload' }, 400);
  if (body.png.length > MAX_PNG_B64) return json({ error: 'png_too_large' }, 400);
  const png = decodeBase64(body.png);
  if (!png || !isPng(png)) return json({ error: 'bad_png' }, 400);
  const meta = sanitizeMeta(body.meta);
  if (meta === null) return json({ error: 'bad_meta' }, 400);

  const now = Date.now();
  const etag = await etagOf(png);
  try {
    const row = await env.DB.prepare('SELECT win_start, win_count FROM widgets WHERE token = ?')
      .bind(token)
      .first<{ win_start: number; win_count: number }>();

    if (row) {
      const inWindow = now - row.win_start < HOUR;
      if (inWindow && row.win_count >= UPLOADS_PER_HOUR) return json({ error: 'rate_limited' }, 429);
      await env.DB.prepare(
        'UPDATE widgets SET png = ?, meta = ?, etag = ?, updated_at = ?, win_start = ?, win_count = ? WHERE token = ?',
      )
        .bind(png.buffer, meta, etag, now, inWindow ? row.win_start : now, inWindow ? row.win_count + 1 : 1, token)
        .run();
    } else {
      const ipHash = await hashIp(request);
      const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM widgets WHERE ip_hash = ? AND created_at > ?')
        .bind(ipHash, now - HOUR)
        .first<{ n: number }>();
      if ((recent?.n ?? 0) >= CREATES_PER_HOUR) return json({ error: 'rate_limited' }, 429);
      await env.DB.prepare(
        'INSERT INTO widgets (token, png, meta, etag, ip_hash, win_start, win_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
      )
        .bind(token, png.buffer, meta, etag, ipHash, now, now, now)
        .run();
    }
    return json({ ok: true, etag });
  } catch {
    return json({ error: 'db_error' }, 500);
  }
}

/** GET /api/widget/:token/png — the image, with ETag revalidation so the
 *  widget's periodic polls cost a 304 whenever nothing changed. */
export async function handleWidgetPng(request: Request, env: Env, token: string): Promise<Response> {
  if (!env.DB) return new Response('unavailable', { status: 503 });
  if (!isWidgetToken(token)) return new Response('bad token', { status: 400 });
  try {
    const row = await env.DB.prepare('SELECT png, meta, etag, updated_at FROM widgets WHERE token = ?')
      .bind(token)
      .first<{ png: unknown; meta: string; etag: string; updated_at: number }>();
    if (!row) return new Response('not found', { status: 404, headers: { 'cache-control': 'no-store' } });
    const headers: Record<string, string> = {
      etag: row.etag,
      'last-modified': new Date(row.updated_at).toUTCString(),
      'x-widget-meta': row.meta,
      'x-widget-updated': String(row.updated_at),
      // Always revalidate: the slot changes whenever the timetable does.
      'cache-control': 'private, no-cache',
    };
    if (request.headers.get('if-none-match') === row.etag) return new Response(null, { status: 304, headers });
    const bytes = toBytes(row.png);
    if (!bytes) return new Response('not found', { status: 404 });
    return new Response(bytes, { headers: { ...headers, 'content-type': 'image/png' } });
  } catch {
    return new Response('error', { status: 500 });
  }
}

/** DELETE /api/widget/:token — unlink: drop the server copy of the timetable. */
export async function handleWidgetDelete(env: Env, token: string): Promise<Response> {
  if (!env.DB) return json({ error: 'unavailable' }, 503);
  if (!isWidgetToken(token)) return json({ error: 'bad_token' }, 400);
  try {
    await env.DB.prepare('DELETE FROM widgets WHERE token = ?').bind(token).run();
    return json({ ok: true });
  } catch {
    return json({ error: 'db_error' }, 500);
  }
}
