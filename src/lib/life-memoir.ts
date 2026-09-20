/**
 * 자서전 — the browser half of worker/memoir.ts.
 *
 * The line holds dates and one-line titles; this asks the server to turn them
 * into a few pages of prose, once, for the price of a one-time purchase. It is
 * not part of Pro: a dollar a month cannot carry a model call that costs real
 * money every time it is made.
 *
 * What travels: dates, titles, descriptions, the closing words, and whatever
 * the person asks of the writer. What does NOT, and cannot, because this
 * module has no field for it: photographs. They stay on the device, as they do
 * everywhere else in Life.
 *
 * The answer arrives as plain text, a sentence at a time — a few pages take
 * the better part of a minute, and a blank screen that long looks broken.
 */
import { MAX_MEMOIR, ageAt, isFullDate, sortMilestones, type LifeData } from './life';

/** Fewer moments than this and there is nothing to write about. */
export const MEMOIR_MIN_MOMENTS = 3;

export interface MemoirPrice { amount: number; currency: string }

/** What the server says about the feature and about this account. */
export interface MemoirState {
  /** False when the server has no writer configured: the section stays hidden. */
  enabled: boolean;
  signedIn: boolean;
  /** Memoirs paid for and not yet written. */
  credits: number;
  price: MemoirPrice | null;
}

export interface MemoirMoment {
  date: string;
  endDate?: string;
  title: string;
  description?: string;
  category: string;
  age?: number;
}

export interface MemoirRequest {
  lang: string;
  name?: string;
  birthDate?: string;
  moments: MemoirMoment[];
  endingNote?: string;
  wish?: string;
}

/** Everything the writer is given — and nothing else from the record. */
export function buildMemoirRequest(life: LifeData, lang: string, wish?: string): MemoirRequest {
  const birth = life.profile.birthDate;
  const moments = sortMilestones(life.milestones).map((m) => {
    // Only an age we actually know: a year alone leaves the birthday open.
    const age = isFullDate(birth) ? ageAt(birth, m.date) : null;
    return {
      date: m.date,
      ...(m.endDate ? { endDate: m.endDate } : {}),
      title: m.title,
      ...(m.description ? { description: m.description } : {}),
      category: m.category,
      ...(age && !age.approx ? { age: age.years } : {}),
    };
  });
  return {
    lang,
    ...(life.profile.name ? { name: life.profile.name } : {}),
    ...(isFullDate(birth) ? { birthDate: birth } : {}),
    moments,
    ...(life.endingNote?.text ? { endingNote: life.endingNote.text } : {}),
    ...(wish && wish.trim() ? { wish: wish.trim() } : {}),
  };
}

/** Can a memoir be written from this record at all? */
export const canWriteMemoir = (life: LifeData): boolean =>
  isFullDate(life.profile.birthDate) && life.milestones.length >= MEMOIR_MIN_MOMENTS;

/** The price as the person's own language writes money. */
export function formatMemoirPrice(price: MemoirPrice | null, lang: string): string | null {
  if (!price) return null;
  const major = price.amount / 100;
  try {
    return new Intl.NumberFormat(lang, { style: 'currency', currency: price.currency.toUpperCase() }).format(major);
  } catch {
    return `${price.currency.toUpperCase()} ${major.toFixed(2)}`;
  }
}

/** A chapter title, or a paragraph. The memoir is plain text with "## " for
 *  the chapter titles; this is the whole of its grammar. */
export interface MemoirBlock { kind: 'h' | 'p'; text: string }

export function memoirBlocks(text: string): MemoirBlock[] {
  const out: MemoirBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: 'p', text: para.join(' ') });
    para = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
    } else if (/^#{1,6}\s/.test(line) || /^#{1,6}$/.test(line)) {
      flush();
      const title = line.replace(/^#+\s*/, '').trim();
      if (title) out.push({ kind: 'h', text: title });
    } else {
      para.push(line);
    }
  }
  flush();
  return out;
}

/** A failure with the server's own word for it, so the page can say something
 *  true (no credit, too little written down, the writer unreachable). */
export class MemoirError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = 'MemoirError';
    this.code = code;
    this.status = status;
  }
}

async function errorOf(res: Response): Promise<MemoirError> {
  let code = `http_${res.status}`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) code = body.error;
  } catch {
    // not JSON — the status is all we have
  }
  return new MemoirError(code, res.status);
}

/** Is the feature on, and has this account paid? Never throws. */
export async function fetchMemoirState(): Promise<MemoirState> {
  const off: MemoirState = { enabled: false, signedIn: false, credits: 0, price: null };
  try {
    const res = await fetch('/api/life/memoir', { credentials: 'include', headers: { accept: 'application/json' } });
    if (!res.ok) return off;
    const data = (await res.json()) as Partial<MemoirState>;
    return {
      enabled: Boolean(data.enabled),
      signedIn: Boolean(data.signedIn),
      credits: Math.max(0, Number(data.credits) || 0),
      price: data.price && typeof data.price.amount === 'number' ? { amount: data.price.amount, currency: String(data.price.currency || 'usd') } : null,
    };
  } catch {
    return off;
  }
}

/** Buy one memoir: leaves for Polar's hosted checkout and comes back to Life. */
export async function startMemoirCheckout(): Promise<void> {
  const res = await fetch('/api/life/memoir/checkout', {
    method: 'POST',
    credentials: 'include',
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw await errorOf(res);
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new MemoirError('checkout_no_url', 502);
  window.location.href = data.url;
}

/**
 * Write the memoir. `onText` is called with everything written so far, so the
 * page can show it arriving; the finished text is returned.
 */
export async function writeMemoir(
  req: MemoirRequest,
  onText: (soFar: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch('/api/life/memoir', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) throw await errorOf(res);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
    if (out.length >= MAX_MEMOIR) {
      out = out.slice(0, MAX_MEMOIR);
      void reader.cancel();
      break;
    }
    onText(out);
  }
  out = out.trim();
  // The server gives the credit back when nothing came through; say so plainly.
  if (!out) throw new MemoirError('empty', 502);
  onText(out);
  return out;
}

/** The memoir as a file to keep, next to the JSON backup. */
export function downloadMemoir(text: string, name?: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name ? `${name}-` : ''}memoir-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
