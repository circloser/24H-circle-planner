/**
 * A read-only link to someone's life line, for sending to the family.
 *
 * It rides the share plumbing the timetable already uses (`POST /api/share` →
 * a short `/s/:id`), so nothing new is stored: the payload is one compact
 * base64url code. Photos never travel — they stay on the device that added
 * them — and the parents' names can be left out, because they are someone
 * else's to give. The code is trimmed until it fits the server's limit, the
 * longest descriptions first, so a long life still makes a link.
 */
import { b64urlDecode, b64urlEncode } from './share-link';
import {
  LIFE_CATEGORIES, decodeLife, emptyLife, isFullDate, isLifeDate, sortMilestones,
  type LifeCategory, type LifeData, type Relation,
} from './life';

const PROD_ORIGIN = 'https://24houring.com';
/** What the server takes (worker/shares.ts MAX_PAYLOAD), with room to spare. */
export const MAX_SHARE_CODE = 24_000;

/** [date, title, category index, unused, description] — short keys, short life.
 *  Slot 3 once carried a hand-set "this is a plan" flag; a plan is now simply a
 *  date after today, so it is written as 0 and ignored on the way back. Old
 *  links still decode, because the shape has not moved. */
type WireMoment = [string, string, number, 0 | 1, string?];
/** [relation, name, birthday] */
type WireParent = [Relation, string, string?];

export interface LifeSharePayload {
  v: 1;
  k: 'life';
  /** Whose life (empty when the names are left out). */
  n?: string;
  /** Birthday — the line cannot be drawn without it. */
  b: string;
  m: WireMoment[];
  f?: WireParent[];
  /** The words to leave behind. */
  t?: string;
}

export interface LifeShareOptions {
  /** Leave every name out: the parents show as "어머니 / 아버지" alone. */
  hideNames?: boolean;
  /** How much of each description to keep (the trimming steps use this). */
  descriptionLimit?: number;
}

/** The share payload for a life record. */
export function lifeSharePayload(life: LifeData, opts: LifeShareOptions = {}): LifeSharePayload {
  const limit = opts.descriptionLimit ?? 300;
  const parents = (['mother', 'father'] as const).flatMap((rel) => {
    const f = life.family.find((m) => m.relation === rel);
    if (!f) return [];
    const row: WireParent = opts.hideNames ? [rel, ''] : [rel, f.name];
    if (!opts.hideNames && f.birthDate) row[2] = f.birthDate;
    return [row];
  });
  const payload: LifeSharePayload = {
    v: 1,
    k: 'life',
    b: life.profile.birthDate,
    m: sortMilestones(life.milestones).map((m) => {
      const row: WireMoment = [m.date, m.title, LIFE_CATEGORIES.indexOf(m.category), 0];
      const desc = limit > 0 ? (m.description ?? '').slice(0, limit) : '';
      if (desc) row[4] = desc;
      return row;
    }),
  };
  if (!opts.hideNames && life.profile.name) payload.n = life.profile.name;
  if (parents.length) payload.f = parents;
  if (life.endingNote?.text) payload.t = life.endingNote.text;
  return payload;
}

/**
 * The code to send, trimmed until the server will take it: first shorter
 * descriptions, then none, then the oldest moments give way (the newest are
 * the ones people came to see). Null when even a bare line is too big.
 */
export function encodeLifeShare(life: LifeData, opts: LifeShareOptions = {}): string | null {
  for (const limit of [300, 120, 0]) {
    const code = b64urlEncode(JSON.stringify(lifeSharePayload(life, { ...opts, descriptionLimit: limit })));
    if (code.length <= MAX_SHARE_CODE) return code;
  }
  let moments = sortMilestones(life.milestones);
  while (moments.length > 1) {
    moments = moments.slice(Math.ceil(moments.length / 10));
    const code = b64urlEncode(JSON.stringify(lifeSharePayload({ ...life, milestones: moments }, { ...opts, descriptionLimit: 0 })));
    if (code.length <= MAX_SHARE_CODE) return code;
  }
  return null;
}

/** Read a share code back into a life record, or null when it is not one. */
export function decodeLifeShare(code: string): LifeData | null {
  let p: LifeSharePayload;
  try {
    p = JSON.parse(b64urlDecode(code)) as LifeSharePayload;
  } catch {
    return null;
  }
  if (!p || p.k !== 'life' || p.v !== 1 || !isFullDate(p.b) || !Array.isArray(p.m)) return null;
  const life: LifeData = {
    ...emptyLife(),
    profile: { birthDate: p.b, ...(p.n ? { name: String(p.n).slice(0, 40) } : {}) },
    // Parents and moments share one id space in decodeLife: keep them apart.
    family: (Array.isArray(p.f) ? p.f : []).map((row, i) => ({
      id: `sp${i}`,
      relation: (row?.[0] === 'father' ? 'father' : 'mother') as Relation,
      name: String(row?.[1] ?? ''),
      ...(isLifeDate(row?.[2]) ? { birthDate: row[2] } : {}),
    })).filter((f) => f.name || f.relation),
    milestones: p.m.flatMap((row, i) => {
      if (!Array.isArray(row) || !isLifeDate(row[0]) || !row[1]) return [];
      const category = LIFE_CATEGORIES[Number(row[2])] as LifeCategory | undefined;
      return [{
        id: `sm${i}`,
        date: row[0],
        title: String(row[1]).slice(0, 80),
        category: category ?? 'other',
        ...(row[4] ? { description: String(row[4]).slice(0, 1000) } : {}),
      }];
    }),
    ...(p.t ? { endingNote: { text: String(p.t).slice(0, 10_000), updatedAt: '' } } : {}),
  };
  // Run it through the same strict decode the stored record uses.
  return decodeLife(life);
}

/** A parent shown without a name still needs something to be called. */
export const sharedName = (name: string): string => name.trim();

/**
 * Store the code and get the short link back. Null when the server declines
 * (offline, rate-limited, too big) — the caller says so rather than pretending.
 */
export async function createLifeShareUrl(life: LifeData, opts: LifeShareOptions = {}): Promise<string | null> {
  const code = encodeLifeShare(life, opts);
  if (!code) return null;
  try {
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ d: code, name: opts.hideNames ? '' : (life.profile.name ?? '') }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { url?: string };
    return typeof body.url === 'string' && body.url.startsWith(PROD_ORIGIN) ? body.url : null;
  } catch {
    return null;
  }
}
