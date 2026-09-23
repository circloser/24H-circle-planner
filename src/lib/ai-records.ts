/**
 * Everything written down in the app, gathered for the two readings that are
 * written from it — the 사주 reading and the memoir.
 *
 * What makes both worth paying for is that they are not generic: a reading
 * that knows the year a person changed jobs, the friends they meet, the
 * cities they lived in and how their mood has run, can speak to that life and
 * not to a birth date. So this reads every page's record as it stands on the
 * device and boils it down to the facts a writer needs — dates, titles,
 * names, counts — and nothing else.
 *
 * What is NOT gathered: photographs (never), anybody's contact details, the
 * notes on other people beyond a line, and the diary's timetables. Diary notes
 * are included in part (the latest, cut short), because they are the one
 * place a person writes in their own voice.
 *
 * Nothing leaves the device from here. The caller shows what will be sent and
 * sends it only when asked, and only then.
 */
import { LIFE_KEY, decodeLife, type LifeData } from './life';
import { RELATION_KEY, decodeRelation, factHistory, meetHistory, type RelationData } from './relation';
import { latest, newestFirst } from './relation-me';
import { PLACE_KEY, decodePlace, isBeen, isWished, type PlaceData } from './place';
import { ME_QUESTIONS } from '@/data/me-questions';

const DIARY_KEY = '24h-circle-planner.diary';

export interface RecordsDigest {
  name?: string;
  birthDate?: string;
  moments: { date: string; endDate?: string; title: string; note?: string; category: string; with?: string[]; where?: string }[];
  endingNote?: string;
  me: {
    mbti?: string[];
    resume?: string[];
    answers?: { q: string; a: string; at: string }[];
    /** Mood by month: the average of the five-point scale, and how many days. */
    moods?: { month: string; avg: number; days: number }[];
  };
  people: { name: string; group: string; sub?: string; relation?: string; closeness: number; now?: string[]; met?: number; lastMet?: string }[];
  places: { been: string[]; wish: string[]; cities: string[]; pins: string[] };
  diary: { date: string; note: string }[];
}

/** How much of each was gathered (for the readiness check and the consent). */
export interface RecordsCount {
  moments: number;
  people: number;
  diary: number;
  places: number;
  me: number;
}

const read = <T>(key: string, decode: (v: unknown) => T | null): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? decode(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

const cut = (s: string | undefined, n: number) => (s && s.length > n ? `${s.slice(0, n)}…` : s);

/** The diary notes worth reading, newest first. */
function diaryNotes(): { date: string; note: string }[] {
  try {
    const raw = localStorage.getItem(DIARY_KEY);
    const entries = raw ? (JSON.parse(raw) as { entries?: Record<string, { date?: string; note?: string }> }).entries : null;
    return Object.values(entries ?? {})
      .filter((e): e is { date: string; note: string } => typeof e?.date === 'string' && typeof e?.note === 'string' && e.note.trim().length > 0)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((e) => ({ date: e.date, note: e.note.trim() }));
  } catch {
    return [];
  }
}

/** Every record on the device, boiled down. `lang` picks the question wording. */
export function gatherRecords(lang: string): { digest: RecordsDigest; count: RecordsCount } {
  const life: LifeData | null = read(LIFE_KEY, decodeLife);
  const relation: RelationData | null = read(RELATION_KEY, decodeRelation);
  const place: PlaceData | null = read(PLACE_KEY, decodePlace);
  const notes = diaryNotes();

  const names = new Map((relation?.people ?? []).map((p) => [p.id, p.name]));
  const moments = [...(life?.milestones ?? [])]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({
      date: m.date,
      ...(m.endDate ? { endDate: m.endDate } : {}),
      title: m.title,
      ...(m.description ? { note: cut(m.description, 300) } : {}),
      category: m.category,
      ...(m.who?.length ? { with: m.who.map((id) => names.get(id)).filter((n): n is string => !!n) } : {}),
      ...(m.placeRef?.countryCode ? { where: m.placeRef.countryCode } : {}),
    }));

  const me = relation?.me ?? {};
  const questions = new Map(ME_QUESTIONS.map((q) => [q.id, lang === 'ko' ? q.ko : q.en]));
  const answers = Object.entries(me.answers ?? {}).flatMap(([id, list]) => {
    const now = latest(list);
    const q = questions.get(id);
    return now && q ? [{ q, a: cut(now.v, 300)!, at: now.at }] : [];
  });
  const byMonth = new Map<string, { sum: number; n: number }>();
  for (const m of me.moods ?? []) {
    const key = m.at.slice(0, 7);
    const was = byMonth.get(key) ?? { sum: 0, n: 0 };
    byMonth.set(key, { sum: was.sum + m.v, n: was.n + 1 });
  }
  const moods = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, avg: Math.round((v.sum / v.n) * 10) / 10, days: v.n }));

  const people = [...(relation?.people ?? [])]
    .sort((a, b) => b.closeness - a.closeness)
    .slice(0, 60)
    .map((p) => {
      const log = meetHistory(p);
      const now = (['home', 'family', 'work', 'title'] as const)
        .map((k) => factHistory(p, k)[0]?.v)
        .filter((v): v is string => !!v);
      return {
        name: p.name,
        group: p.group,
        ...(p.sub ? { sub: p.sub } : {}),
        ...(p.relation ? { relation: p.relation } : {}),
        closeness: p.closeness,
        ...(now.length ? { now } : {}),
        ...(log.length ? { met: log.length, lastMet: log[0].at } : {}),
      };
    });

  const countries = place?.countries ?? [];
  const places = {
    been: countries.filter((c) => isBeen(c)).map((c) => (c.firstYear ? `${c.code} (${c.firstYear})` : c.code)),
    wish: countries.filter((c) => isWished(c)).map((c) => c.code),
    cities: (place?.cities ?? []).map((c) => `${c.name}${c.lived ? ' (lived)' : ''}${c.firstYear ? ` ${c.firstYear}` : ''}`),
    pins: (place?.pins ?? []).slice(0, 80).map((p) => `${p.name} [${p.category}]${p.date ? ` ${p.date}` : ''}`),
  };

  const digest: RecordsDigest = {
    ...(life?.profile.name ? { name: life.profile.name } : relation?.me.name ? { name: relation.me.name } : {}),
    ...(life?.profile.birthDate ? { birthDate: life.profile.birthDate } : {}),
    moments,
    ...(life?.endingNote?.text ? { endingNote: cut(life.endingNote.text, 2000) } : {}),
    me: {
      ...(me.mbti?.length ? { mbti: newestFirst(me.mbti).map((d) => `${d.v} (${d.at})`) } : {}),
      ...(me.resume?.length ? {
        resume: me.resume.map((e) => `[${e.k}] ${e.v}${e.from || e.to ? ` ${e.from ?? ''}–${e.to ?? 'now'}` : ''}`),
      } : {}),
      ...(answers.length ? { answers } : {}),
      ...(moods.length ? { moods } : {}),
    },
    people,
    places,
    diary: notes.slice(0, 60).map((n) => ({ date: n.date, note: cut(n.note, 400)! })),
  };
  const count: RecordsCount = {
    moments: moments.length,
    people: relation?.people.length ?? 0,
    diary: notes.length,
    places: places.been.length + places.cities.length + places.pins.length,
    me: answers.length + (me.resume?.length ?? 0) + (me.mbti?.length ?? 0),
  };
  return { digest, count };
}

/** What a memoir needs before it can be written, each with how much there is. */
export const MEMOIR_NEEDS = {
  moments: 10,
  people: 5,
  diary: 10,
  places: 5,
  me: 10,
} as const;
/** Besides the moments of the life line, this many of the other four. */
export const MEMOIR_OTHERS_NEEDED = 2;

export interface Readiness {
  ok: boolean;
  items: { key: keyof RecordsCount; have: number; need: number; met: boolean; required: boolean }[];
}

/**
 * Is there enough to write a memoir from?
 *
 * A memoir written from three dates is three dates padded out, and it would
 * be sold as something it is not. So the life line must hold at least ten
 * moments, and at least two of the other records — the people, the diary,
 * the places, my own record — must have something real in them. The check
 * lists every one, so it is plain what is still missing and where to add it.
 */
export function memoirReadiness(count: RecordsCount): Readiness {
  const items = (Object.keys(MEMOIR_NEEDS) as (keyof RecordsCount)[]).map((key) => ({
    key,
    have: count[key],
    need: MEMOIR_NEEDS[key],
    met: count[key] >= MEMOIR_NEEDS[key],
    required: key === 'moments',
  }));
  const others = items.filter((i) => !i.required && i.met).length;
  return { ok: items[0].met && others >= MEMOIR_OTHERS_NEEDED, items };
}
