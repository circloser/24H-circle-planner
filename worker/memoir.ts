import { RELAY_LOCATION, RELAY_NAME, type ModelRelayNamespace } from './model-relay';
import { cleanRecords, recordsText, type Records } from './readings';

/**
 * 자서전 — the life line, written out as prose.
 *
 * The Life page holds dates and one-line titles; this turns them into a few
 * pages someone would actually read aloud at a table. It is bought once, for
 * the price of the one-time Polar product (POLAR_MEMOIR_PRODUCT_ID), and is
 * not part of Pro: a subscription of a dollar a month cannot carry a model
 * call that costs real money every time it is made.
 *
 * Privacy. This is the ONE place a life record leaves the device, and only
 * when the person asks for it by name and pays for it:
 *   · dates, titles, notes and the closing words go to Anthropic's API;
 *   · photographs never do — they never leave the device at all;
 *   · nothing sent and nothing written is stored here. The text is streamed
 *     straight back to the browser, which keeps it in the local record.
 *
 * Money. A credit is spent BEFORE the model is called and given back if the
 * model never produced a word, so a failure never costs the buyer a dollar,
 * and two tabs cannot spend the same credit twice.
 */

export interface MemoirMoment {
  /** 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'. */
  date: string;
  /** End of a span (school, a job), same forms. */
  endDate?: string;
  title: string;
  description?: string;
  category?: string;
  /** Age (만 나이) at the time, when the birth date makes it knowable. */
  age?: number;
}

export interface MemoirInput {
  /** The language the memoir is written in (the app's own). */
  lang: string;
  name?: string;
  birthDate?: string;
  moments: MemoirMoment[];
  endingNote?: string;
  /** A free note to the writer: what this person wants the memoir to be. */
  wish?: string;
  /** Everything else the app holds about them — people, places, their own
   *  record, the diary — gathered by the browser (src/lib/ai-records.ts). */
  records?: Records;
}

/** Caps: a life is long, a prompt is not. */
export const MEMOIR_MAX_MOMENTS = 300;
export const MEMOIR_MIN_MOMENTS = 3;
const MAX_TITLE = 120;
const MAX_DESC = 1200;
const MAX_NAME = 60;
const MAX_ENDING = 4000;
const MAX_WISH = 500;

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().slice(0, max);
  return s || undefined;
};

const LANGS = new Set(['ko', 'en', 'de', 'ja', 'zh', 'fr', 'es', 'ru']);
const DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

/**
 * Accept only what a memoir is made of, in the shapes it is made of — the
 * body arrives from a browser, so nothing here trusts it.
 */
export function cleanMemoirInput(raw: unknown): MemoirInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const list = Array.isArray(r['moments']) ? r['moments'] : [];
  const moments: MemoirMoment[] = [];
  for (const item of list.slice(0, MEMOIR_MAX_MOMENTS)) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    const date = str(m['date'], 10);
    const title = str(m['title'], MAX_TITLE);
    if (!date || !DATE_RE.test(date) || !title) continue;
    const endDate = str(m['endDate'], 10);
    const description = str(m['description'], MAX_DESC);
    const category = str(m['category'], 24);
    const age = typeof m['age'] === 'number' && Number.isFinite(m['age'])
      ? Math.max(0, Math.min(150, Math.round(m['age'] as number)))
      : undefined;
    moments.push({
      date,
      ...(endDate && DATE_RE.test(endDate) ? { endDate } : {}),
      title,
      ...(description ? { description } : {}),
      ...(category ? { category } : {}),
      ...(age !== undefined ? { age } : {}),
    });
  }
  if (moments.length < MEMOIR_MIN_MOMENTS) return null;
  const lang = str(r['lang'], 8);
  const name = str(r['name'], MAX_NAME);
  const birthDate = str(r['birthDate'], 10);
  const endingNote = str(r['endingNote'], MAX_ENDING);
  const wish = str(r['wish'], MAX_WISH);
  return {
    lang: lang && LANGS.has(lang) ? lang : 'en',
    ...(name ? { name } : {}),
    ...(birthDate && DATE_RE.test(birthDate) ? { birthDate } : {}),
    moments,
    ...(endingNote ? { endingNote } : {}),
    ...(wish ? { wish } : {}),
    ...(r['records'] && typeof r['records'] === 'object' ? { records: cleanRecords(r['records']) } : {}),
  };
}

const LANG_NAME: Record<string, string> = {
  ko: 'Korean (한국어)', en: 'English', de: 'German (Deutsch)', ja: 'Japanese (日本語)',
  zh: 'Chinese (中文)', fr: 'French (Français)', es: 'Spanish (Español)', ru: 'Russian (Русский)',
};

/**
 * What the writer is told. Kept in English because the instructions are for
 * the model, not for the reader; the memoir itself is written in the person's
 * own language, which is the one thing the prompt says twice.
 */
export function memoirSystem(lang: string): string {
  return [
    'You are a ghostwriter. You are given the chronology of one person’s life — dates and short titles, sometimes a line of description — and, where they have kept them, the rest of their records: the people around them, the places they have been, what they wrote about themselves, and their diary in their own words. You write their memoir from all of it, in the first person, as if they were telling it. Use the diary for their voice and the people and places for the texture of each chapter.',
    '',
    `Write ONLY in ${LANG_NAME[lang] ?? 'English'}. Every word of the memoir, including the chapter titles, is in that language.`,
    '',
    'Rules, in order of importance:',
    '1. Invent nothing. No events, names, places, illnesses, jobs or numbers that are not in the chronology. If a stretch of years is empty, pass over it; do not fill it.',
    '2. Feelings may be suggested, never asserted. Write "I suppose I was frightened" rather than "I was frightened" where the record does not say so. Never put words in anyone else’s mouth.',
    '3. Say only what the dates say. Where a date gives only a year, write it as a year ("that year", "sometime in 1994"), never as a day.',
    '4. Follow the chronology in order, grouped into chapters — by decade, or by the shape the life actually takes. Give each chapter a short title on its own line, prefixed with "## ".',
    '5. Anything still ahead is written as a hope, in the future tense, never as something that happened.',
    '6. Plain prose. No lists, no tables, no headings other than the chapter titles, no closing note from you, no mention of being an AI or of this chronology being your source.',
    '7. Length: six to ten chapters, a few paragraphs each — long enough to be worth printing, short enough to be read in one sitting.',
    '8. End with a closing chapter. If the person left words to be remembered by, let that chapter grow out of them rather than quoting them whole.',
  ].join('\n');
}

const fmtDate = (d: string) => d.replace(/-/g, '.');

/** The chronology itself, as plainly as it can be put. */
export function memoirUser(input: MemoirInput): string {
  const lines: string[] = [];
  if (input.name) lines.push(`Name: ${input.name}`);
  if (input.birthDate) lines.push(`Born: ${fmtDate(input.birthDate)}`);
  lines.push('', 'Chronology (oldest first):');
  for (const m of input.moments) {
    const when = m.endDate ? `${fmtDate(m.date)}–${fmtDate(m.endDate)}` : fmtDate(m.date);
    const age = m.age !== undefined ? ` (age ${m.age})` : '';
    const cat = m.category ? ` [${m.category}]` : '';
    lines.push(`- ${when}${age}${cat} ${m.title}${m.description ? ` — ${m.description}` : ''}`);
  }
  if (input.endingNote) lines.push('', 'Words they want to leave behind:', input.endingNote);
  if (input.records) {
    // The moments are above already; the rest of the record follows.
    const rest = recordsText({ ...input.records, moments: [], endingNote: undefined });
    if (rest) lines.push('', 'The rest of their records:', rest);
  }
  if (input.wish) lines.push('', 'What they asked of you:', input.wish);
  lines.push('', 'Write the memoir now.');
  return lines.join('\n');
}

// ─── Credits ─────────────────────────────────────────────────────────────────

/** One purchase buys one memoir. */
export const MEMOIR_KIND = 'memoir';

let ensured = false;

/** The two tables this needs, created on first use (D1 DDL is idempotent). */
export async function ensureMemoirTables(db: D1Database): Promise<void> {
  if (ensured) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS ai_credits (user_id TEXT NOT NULL, kind TEXT NOT NULL, credits INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, kind))').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS ai_orders (order_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, created_at INTEGER NOT NULL)').run();
  ensured = true;
}

/** How many memoirs this account has paid for and not yet used. */
export async function memoirCredits(db: D1Database, userId: string): Promise<number> {
  await ensureMemoirTables(db);
  const row = await db.prepare('SELECT credits FROM ai_credits WHERE user_id=? AND kind=?').bind(userId, MEMOIR_KIND).first<{ credits: number }>();
  return Math.max(0, row?.credits ?? 0);
}

/** Add one credit for a paid order. Idempotent: Polar retries its webhooks,
 *  and one order must never be worth two memoirs. */
export async function grantMemoirCredit(db: D1Database, userId: string, orderId: string, now = Date.now()): Promise<boolean> {
  await ensureMemoirTables(db);
  const claim = await db.prepare('INSERT OR IGNORE INTO ai_orders (order_id, user_id, kind, created_at) VALUES (?, ?, ?, ?)')
    .bind(orderId, userId, MEMOIR_KIND, now).run();
  if (!claim.meta || claim.meta.changes === 0) return false; // already counted
  await db.prepare(
    'INSERT INTO ai_credits (user_id, kind, credits, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id, kind) DO UPDATE SET credits=credits+1, updated_at=excluded.updated_at',
  ).bind(userId, MEMOIR_KIND, now).run();
  return true;
}

/** Take one credit, atomically. False when there was none to take. */
export async function spendMemoirCredit(db: D1Database, userId: string, now = Date.now()): Promise<boolean> {
  await ensureMemoirTables(db);
  const res = await db.prepare('UPDATE ai_credits SET credits=credits-1, updated_at=? WHERE user_id=? AND kind=? AND credits>0')
    .bind(now, userId, MEMOIR_KIND).run();
  return Boolean(res.meta && res.meta.changes > 0);
}

/** Give a spent credit back — the model produced nothing. */
export async function refundMemoirCredit(db: D1Database, userId: string, now = Date.now()): Promise<void> {
  try {
    await db.prepare('UPDATE ai_credits SET credits=credits+1, updated_at=? WHERE user_id=? AND kind=?').bind(now, userId, MEMOIR_KIND).run();
  } catch {
    // the database is down; the buyer is told the writing failed either way
  }
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

export interface MemoirEnv {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  POLAR_MEMOIR_PRODUCT_ID?: string;
  /** Makes the call from the US (worker/model-relay.ts); absent in tests. */
  MODEL_RELAY?: ModelRelayNamespace;
}

export const MEMOIR_MODEL_DEFAULT = 'claude-sonnet-5';
export const MEMOIR_MAX_TOKENS = 8000;

/** Is the feature set up at all? Unset, the whole section stays hidden. */
export const memoirEnabled = (env: MemoirEnv): boolean =>
  Boolean(env.ANTHROPIC_API_KEY && env.POLAR_MEMOIR_PRODUCT_ID);

/**
 * One SSE line from Anthropic → the text it carries, if any.
 *
 * The cheap checks come first on purpose. A Worker on the free plan has ten
 * milliseconds of CPU for the whole request, and a memoir is a few thousand
 * events; every line that can be dismissed without parsing its JSON is CPU
 * the reader does not spend waiting.
 */
export function deltaText(line: string): string | null {
  if (!line.startsWith('data:') || !line.includes('"text_delta"')) return null;
  const body = line.slice(5).trim();
  if (!body || body === '[DONE]') return null;
  try {
    const ev = JSON.parse(body) as { type?: string; delta?: { type?: string; text?: string } };
    if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && typeof ev.delta.text === 'string') return ev.delta.text;
  } catch {
    // a partial line — the caller only ever feeds whole ones
  }
  return null;
}

/**
 * Anthropic's event stream → plain text, plus a promise of how much text came
 * through. The memoir is streamed rather than awaited whole because a few
 * pages take the better part of a minute to write, and a browser left with a
 * blank screen that long assumes something broke.
 */
export function memoirStream(upstream: ReadableStream<Uint8Array>): { body: ReadableStream<Uint8Array>; written: Promise<number> } {
  let resolve!: (n: number) => void;
  const written = new Promise<number>((r) => { resolve = r; });
  let count = 0;
  let buffer = '';
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      const take = (line: string) => {
        const failed = streamError(line);
        if (failed) console.error(`[writer] stream ${failed}`);
        const text = deltaText(line);
        if (!text) return;
        count += text.length;
        controller.enqueue(encoder.encode(text));
      };
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl = buffer.indexOf('\n');
          while (nl >= 0) {
            take(buffer.slice(0, nl));
            buffer = buffer.slice(nl + 1);
            nl = buffer.indexOf('\n');
          }
        }
        take(buffer);
      } catch {
        // a broken stream ends the memoir where it stopped
      } finally {
        controller.close();
        resolve(count);
      }
    },
  });
  return { body, written };
}

/**
 * Why the writer said no, in its own words: Anthropic answers an error with
 * `{ error: { type, message } }` ("credit balance is too low", "invalid
 * x-api-key", an unknown model…). Logged for the tail, and handed back to an
 * admin so a failed try says what to fix instead of only that it failed.
 */
export async function writerFailure(tag: string, upstream: Response, where?: string): Promise<string> {
  let detail = `HTTP ${upstream.status}`;
  try {
    const text = await upstream.text();
    try {
      const e = (JSON.parse(text) as { error?: { type?: string; message?: string } }).error;
      if (e?.message) detail = `${upstream.status} ${e.type ?? 'error'}: ${e.message}`;
    } catch {
      if (text) detail = `${upstream.status}: ${text.slice(0, 160)}`;
    }
  } catch { /* no body */ }
  detail = detail.slice(0, 240);
  console.error(`[${tag}] anthropic ${detail}${where ? ` (colo ${where})` : ''}`);
  return detail;
}

/** An error the stream itself carries (`event: error`), e.g. overloaded. */
export function streamError(line: string): string | null {
  if (!line.startsWith('data:') || !line.includes('"error"')) return null;
  try {
    const ev = JSON.parse(line.slice(5).trim()) as { type?: string; error?: { type?: string; message?: string } };
    return ev.type === 'error' ? `${ev.error?.type ?? 'error'}: ${ev.error?.message ?? ''}`.slice(0, 240) : null;
  } catch {
    return null;
  }
}

/**
 * Ask Anthropic for a piece of writing, streamed — through the US relay when
 * the Worker has one, so the answer does not depend on which data centre the
 * visitor happened to reach (see worker/model-relay.ts).
 */
export function callModel(env: MemoirEnv, system: string, user: string, maxTokens: number): Promise<Response> {
  const body = JSON.stringify({
    model: env.ANTHROPIC_MODEL || MEMOIR_MODEL_DEFAULT,
    max_tokens: maxTokens,
    stream: true,
    system,
    messages: [{ role: 'user', content: user }],
  });
  if (env.MODEL_RELAY) {
    const relay = env.MODEL_RELAY.get(env.MODEL_RELAY.idFromName(RELAY_NAME), { locationHint: RELAY_LOCATION });
    return relay.fetch('https://relay/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  }
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body,
  });
}

/** Ask Anthropic for the memoir. Returns the raw streaming response. */
export const callClaude = (env: MemoirEnv, input: MemoirInput): Promise<Response> =>
  callModel(env, memoirSystem(input.lang), memoirUser(input), MEMOIR_MAX_TOKENS);
