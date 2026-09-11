/**
 * News-email consent — the ONLY lawful source of a mailing list.
 *
 * Google sign-in stores an email for two stated purposes: keeping the session
 * and checking the subscription. Sending news to it needs a separate, explicit
 * opt-in — 개인정보보호법 §18 bars use beyond the notified purpose, and
 * 정보통신망법 §50 requires prior consent before any advertising email. So the
 * list is built here, one deliberate "yes" at a time, and never backfilled from
 * the users table.
 *
 *   GET  /api/marketing                     → { decided, optIn, version, decidedAt }  (signed in)
 *   PUT  /api/marketing  { optIn, version } → same                                    (signed in)
 *   GET  /api/marketing/unsubscribe?t=…     → confirmation page, no login
 *   POST /api/marketing/unsubscribe?t=…     → withdraws (also RFC 8058 one-click)
 *   GET  /api/admin/marketing               → { optedIn, declined, undecided, version } (admin)
 *   GET  /api/admin/marketing?format=csv    → opted-in emails + unsubscribe URLs      (admin)
 *
 * Unsubscribe is a confirm-then-POST so link scanners in mail gateways, which
 * pre-fetch every URL, cannot unsubscribe people by accident.
 *
 * Every row records WHICH notice was answered and WHEN — that is what proves
 * consent later. The unsubscribe token survives re-consent, so the link in an
 * old email always keeps working.
 */
import type { Env } from './index';

/** Bump whenever the consent notice text changes; stale answers are refused. */
export const MARKETING_CONSENT_VERSION = '2026-09-11';

const ORIGIN = 'https://24houring.com';
const TOKEN_RE = /^[A-Za-z0-9]{24}$/;
const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export interface ConsentUser {
  id: string;
  email: string | null;
}

/** Every statement this module runs, named so tests can fake D1 exactly. */
export const SQL = {
  state: 'SELECT opted_in, version, decided_at, unsub_token FROM marketing_consent WHERE user_id = ?',
  upsert:
    'INSERT INTO marketing_consent (user_id, opted_in, version, decided_at, unsub_token, created_at) VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(user_id) DO UPDATE SET opted_in = excluded.opted_in, version = excluded.version, decided_at = excluded.decided_at',
  unsubscribe: 'UPDATE marketing_consent SET opted_in = 0, decided_at = ? WHERE unsub_token = ?',
  counts:
    'SELECT COALESCE(SUM(CASE WHEN opted_in = 1 THEN 1 ELSE 0 END), 0) AS yes, ' +
    'COALESCE(SUM(CASE WHEN opted_in = 0 THEN 1 ELSE 0 END), 0) AS no FROM marketing_consent',
  users: 'SELECT COUNT(*) AS n FROM users',
  exportOptIns:
    'SELECT u.email AS email, c.decided_at AS decided_at, c.unsub_token AS unsub_token FROM marketing_consent c ' +
    'JOIN users u ON u.id = c.user_id WHERE c.opted_in = 1 AND u.email IS NOT NULL ORDER BY c.decided_at',
} as const;

interface StateRow {
  opted_in: number;
  version: string;
  decided_at: number;
  unsub_token: string;
}

export interface ExportRow {
  email: string;
  decided_at: number;
  unsub_token: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}

export function newUnsubToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let token = '';
  for (const b of bytes) token += TOKEN_ALPHABET[b % TOKEN_ALPHABET.length];
  return token;
}

export function unsubscribeUrl(token: string): string {
  return `${ORIGIN}/api/marketing/unsubscribe?t=${token}`;
}

/**
 * One CSV cell. A value starting with = + - @ (or a tab / CR) is run as a
 * formula by Excel and Sheets, so it gets a leading apostrophe; quotes, commas
 * and line breaks are quoted per RFC 4180.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Opted-in recipients only, each with the unsubscribe link its email must carry. */
export function buildOptInCsv(rows: readonly ExportRow[]): string {
  const lines = ['email,agreed_at,unsubscribe_url'];
  for (const r of rows) {
    lines.push([csvCell(r.email), csvCell(new Date(r.decided_at).toISOString()), csvCell(unsubscribeUrl(r.unsub_token))].join(','));
  }
  // BOM so spreadsheet apps read UTF-8 correctly.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function toState(row: StateRow | null) {
  return row
    ? { decided: true, optIn: row.opted_in === 1, version: row.version, decidedAt: row.decided_at }
    : { decided: false, optIn: false, version: MARKETING_CONSENT_VERSION, decidedAt: null };
}

type PageKind = 'confirm' | 'done' | 'invalid' | 'error';

const PAGE_COPY: Record<PageKind, [string, string, string, string]> = {
  confirm: [
    '소식 이메일 수신 거부',
    '아래 버튼을 누르면 24Houring 소식 이메일을 더 이상 받지 않습니다.',
    'Unsubscribe from news emails',
    'Press the button below to stop receiving 24Houring news emails.',
  ],
  done: [
    '수신 거부가 완료되었습니다',
    '앞으로 24Houring 소식 이메일을 보내지 않습니다. 다시 받고 싶으면 앱의 ⚙ 메뉴에서 동의할 수 있습니다.',
    "You're unsubscribed",
    'We will no longer send you 24Houring news emails. You can opt back in from the ⚙ menu in the app.',
  ],
  invalid: [
    '링크를 확인할 수 없습니다',
    '수신 거부 링크가 올바르지 않습니다. 앱의 ⚙ 메뉴에서 직접 수신을 끌 수 있습니다.',
    "We couldn't verify this link",
    'This unsubscribe link is not valid. You can turn news emails off from the ⚙ menu in the app.',
  ],
  error: [
    '잠시 후 다시 시도해 주세요',
    '일시적인 문제로 처리하지 못했습니다.',
    'Please try again shortly',
    'We could not process this right now.',
  ],
};

/** `token` is only ever interpolated after TOKEN_RE has accepted it. */
function page(kind: PageKind, token = ''): string {
  const [ko, koBody, en, enBody] = PAGE_COPY[kind];
  const form =
    kind === 'confirm'
      ? `<form method="post" action="/api/marketing/unsubscribe?t=${token}"><button type="submit">수신 거부하기 · Unsubscribe</button></form>`
      : '';
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${ko} · 24Houring</title>
<style>
  :root{color-scheme:light dark}
  body{margin:0;font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;background:#f4f5f7;color:#1f2430}
  @media (prefers-color-scheme:dark){body{background:#1f2430;color:#f4f5f7}.card{background:#2a3040!important}}
  main{min-height:100vh;display:grid;place-items:center;padding:24px}
  .card{max-width:440px;background:#fff;border-radius:16px;padding:28px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  h1{font-size:20px;margin:0 0 8px}p{margin:0 0 12px}.en{opacity:.75;font-size:14px}
  button{margin-top:8px;padding:10px 18px;border-radius:10px;border:0;background:#1f2430;color:#fff;font-size:15px;cursor:pointer}
  @media (prefers-color-scheme:dark){button{background:#f4f5f7;color:#1f2430}}
  a{color:inherit}
</style></head>
<body><main><div class="card">
<h1>${ko}</h1><p>${koBody}</p><p class="en"><strong>${en}</strong><br>${enBody}</p>${form}
<p class="en"><a href="/">24Houring</a></p>
</div></main></body></html>`;
}

/**
 * Handle a marketing-consent route, or return null when `path`/`method` is not
 * one of ours so the main router can carry on. The caller resolves the session
 * user and admin flag, which keeps this module free of cookie handling.
 */
export async function handleMarketingRoute(
  request: Request,
  env: Env,
  path: string,
  method: string,
  user: ConsentUser | null,
  isAdmin: boolean,
): Promise<Response | null> {
  if (path === '/api/marketing') {
    if (method !== 'GET' && method !== 'PUT') return null;
    if (!user) return json({ error: 'unauthorized' }, 401);

    if (method === 'GET') {
      if (!env.DB) return json({ error: 'unavailable' }, 503);
      const row = await env.DB.prepare(SQL.state).bind(user.id).first<StateRow>();
      return json(toState(row));
    }

    // Validate everything before touching the database.
    let body: { optIn?: unknown; version?: unknown };
    try {
      body = (await request.json()) as { optIn?: unknown; version?: unknown };
    } catch {
      return json({ error: 'bad_json' }, 400);
    }
    if (!body || typeof body.optIn !== 'boolean') return json({ error: 'bad_payload' }, 400);
    // A choice counts only for the notice that was actually on screen. An old
    // tab still showing earlier wording has to read the current one first.
    if (body.version !== MARKETING_CONSENT_VERSION) {
      return json({ error: 'stale_notice', version: MARKETING_CONSENT_VERSION }, 409);
    }
    if (!env.DB) return json({ error: 'unavailable' }, 503);

    const now = Date.now();
    await env.DB.prepare(SQL.upsert).bind(user.id, body.optIn ? 1 : 0, MARKETING_CONSENT_VERSION, now, newUnsubToken(), now).run();
    const row = await env.DB.prepare(SQL.state).bind(user.id).first<StateRow>();
    return json(toState(row));
  }

  if (path === '/api/marketing/unsubscribe') {
    if (method !== 'GET' && method !== 'POST') return null;
    const token = new URL(request.url).searchParams.get('t') ?? '';
    if (!TOKEN_RE.test(token)) return html(page('invalid'), 400);
    if (method === 'GET') return html(page('confirm', token));

    if (!env.DB) return html(page('error'), 503);
    const result = await env.DB.prepare(SQL.unsubscribe).bind(Date.now(), token).run();
    const changes = (result as { meta?: { changes?: number } }).meta?.changes ?? 0;
    return changes > 0 ? html(page('done')) : html(page('invalid'), 404);
  }

  if (path === '/api/admin/marketing') {
    if (method !== 'GET') return null;
    if (!user) return json({ error: 'unauthorized' }, 401);
    if (!isAdmin) return json({ error: 'forbidden' }, 403);
    if (!env.DB) return json({ error: 'unavailable' }, 503);

    if (new URL(request.url).searchParams.get('format') === 'csv') {
      const rows = (await env.DB.prepare(SQL.exportOptIns).all<ExportRow>()).results ?? [];
      const day = new Date().toISOString().slice(0, 10);
      return new Response(buildOptInCsv(rows), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="24houring-news-optin-${day}.csv"`,
          'cache-control': 'no-store',
        },
      });
    }

    const counts = await env.DB.prepare(SQL.counts).first<{ yes: number; no: number }>();
    const users = await env.DB.prepare(SQL.users).first<{ n: number }>();
    const optedIn = counts?.yes ?? 0;
    const declined = counts?.no ?? 0;
    return json({
      optedIn,
      declined,
      undecided: Math.max(0, (users?.n ?? 0) - optedIn - declined),
      version: MARKETING_CONSENT_VERSION,
    });
  }

  return null;
}
