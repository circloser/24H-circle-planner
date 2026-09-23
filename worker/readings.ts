/**
 * The two readings written from a person's own records: the 사주 reading, and
 * the records half of the memoir (worker/memoir.ts writes the memoir itself).
 *
 * Both are sold on one promise — that they are about THIS person, not about a
 * birth date — so both are given what the app actually holds: the moments of
 * the life line and who was there, the people around them, the places they
 * have been, what they wrote about themselves, the diary in their own words.
 * The browser gathers it (src/lib/ai-records.ts); this side trusts none of it
 * and cuts every field to size before a word of it reaches the model.
 *
 * Nothing sent and nothing written is stored here. The reading streams back
 * to the browser, which keeps it on the device.
 */

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().slice(0, max);
  return s || undefined;
};
const strs = (v: unknown, max: number, each: number): string[] =>
  (Array.isArray(v) ? v : []).slice(0, max).map((x) => str(x, each)).filter((x): x is string => !!x);
const num = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined;

const LANGS = new Set(['ko', 'en', 'de', 'ja', 'zh', 'fr', 'es', 'ru']);
export const LANG_NAME: Record<string, string> = {
  ko: 'Korean (한국어)', en: 'English', de: 'German (Deutsch)', ja: 'Japanese (日本語)',
  zh: 'Chinese (中文)', fr: 'French (Français)', es: 'Spanish (Español)', ru: 'Russian (Русский)',
};
export const langOf = (v: unknown): string => {
  const l = str(v, 8);
  return l && LANGS.has(l) ? l : 'en';
};

/** The records, as the browser gathered them — every field cut to size. */
export interface Records {
  moments: { date: string; title: string; note?: string; with?: string[] }[];
  me: { mbti: string[]; resume: string[]; answers: { q: string; a: string }[]; moods: { month: string; avg: number }[] };
  people: { name: string; line: string }[];
  places: { been: string[]; wish: string[]; cities: string[]; pins: string[] };
  diary: { date: string; note: string }[];
  endingNote?: string;
}

const DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

export function cleanRecords(raw: unknown): Records {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const moments = (Array.isArray(r['moments']) ? r['moments'] : []).slice(0, 300).flatMap((item) => {
    const m = (item ?? {}) as Record<string, unknown>;
    const date = str(m['date'], 10);
    const title = str(m['title'], 120);
    if (!date || !DATE_RE.test(date) || !title) return [];
    const note = str(m['note'], 300);
    const withWhom = strs(m['with'], 10, 40);
    return [{ date, title, ...(note ? { note } : {}), ...(withWhom.length ? { with: withWhom } : {}) }];
  });
  const me = (r['me'] && typeof r['me'] === 'object' ? r['me'] : {}) as Record<string, unknown>;
  const answers = (Array.isArray(me['answers']) ? me['answers'] : []).slice(0, 100).flatMap((item) => {
    const a = (item ?? {}) as Record<string, unknown>;
    const q = str(a['q'], 120);
    const text = str(a['a'], 300);
    return q && text ? [{ q, a: text }] : [];
  });
  const moods = (Array.isArray(me['moods']) ? me['moods'] : []).slice(-36).flatMap((item) => {
    const m = (item ?? {}) as Record<string, unknown>;
    const month = str(m['month'], 7);
    const avg = num(m['avg'], 1, 5);
    return month && /^\d{4}-\d{2}$/.test(month) && avg !== undefined ? [{ month, avg }] : [];
  });
  const people = (Array.isArray(r['people']) ? r['people'] : []).slice(0, 60).flatMap((item) => {
    const p = (item ?? {}) as Record<string, unknown>;
    const name = str(p['name'], 40);
    if (!name) return [];
    const bits = [
      str(p['group'], 12),
      str(p['sub'], 20),
      str(p['relation'], 40),
      num(p['closeness'], 1, 5) !== undefined ? `closeness ${num(p['closeness'], 1, 5)}/5` : undefined,
      ...strs(p['now'], 4, 60),
      num(p['met'], 0, 9999) ? `met ${num(p['met'], 0, 9999)} times` : undefined,
      str(p['lastMet'], 10) ? `last ${str(p['lastMet'], 10)}` : undefined,
    ].filter(Boolean);
    return [{ name, line: bits.join(', ') }];
  });
  const places = (r['places'] && typeof r['places'] === 'object' ? r['places'] : {}) as Record<string, unknown>;
  const diary = (Array.isArray(r['diary']) ? r['diary'] : []).slice(0, 60).flatMap((item) => {
    const d = (item ?? {}) as Record<string, unknown>;
    const date = str(d['date'], 10);
    const note = str(d['note'], 400);
    return date && DATE_RE.test(date) && note ? [{ date, note }] : [];
  });
  const endingNote = str(r['endingNote'], 2000);
  return {
    moments,
    me: { mbti: strs(me['mbti'], 20, 24), resume: strs(me['resume'], 60, 120), answers, moods },
    people,
    places: {
      been: strs(places['been'], 200, 16),
      wish: strs(places['wish'], 200, 8),
      cities: strs(places['cities'], 150, 60),
      pins: strs(places['pins'], 80, 90),
    },
    diary,
    ...(endingNote ? { endingNote } : {}),
  };
}

/** The records as plain lines — the same block for both readings. */
export function recordsText(rec: Records): string {
  const out: string[] = [];
  if (rec.moments.length) {
    out.push('Life line (oldest first):');
    for (const m of rec.moments) {
      out.push(`- ${m.date.replace(/-/g, '.')} ${m.title}${m.with?.length ? ` (with ${m.with.join(', ')})` : ''}${m.note ? ` — ${m.note}` : ''}`);
    }
  }
  if (rec.me.resume.length) out.push('', 'Résumé they wrote about themselves:', ...rec.me.resume.map((l) => `- ${l}`));
  if (rec.me.mbti.length) out.push('', `MBTI as they recorded it, newest first: ${rec.me.mbti.join('; ')}`);
  if (rec.me.moods.length) {
    out.push('', 'Their mood by month (1 awful – 5 great):', rec.me.moods.map((m) => `${m.month} ${m.avg}`).join(', '));
  }
  if (rec.me.answers.length) out.push('', 'Questions they answered about themselves:', ...rec.me.answers.map((a) => `- Q: ${a.q} A: ${a.a}`));
  if (rec.people.length) out.push('', 'People in their life (closest first):', ...rec.people.map((p) => `- ${p.name}: ${p.line}`));
  const pl = rec.places;
  if (pl.been.length || pl.cities.length || pl.pins.length || pl.wish.length) {
    out.push('', 'Places:');
    if (pl.been.length) out.push(`- Countries been to: ${pl.been.join(', ')}`);
    if (pl.cities.length) out.push(`- Cities: ${pl.cities.join('; ')}`);
    if (pl.pins.length) out.push(`- Particular places: ${pl.pins.join('; ')}`);
    if (pl.wish.length) out.push(`- Would like to go: ${pl.wish.join(', ')}`);
  }
  if (rec.diary.length) out.push('', 'From their diary, in their own words (newest first):', ...rec.diary.map((d) => `- ${d.date}: ${d.note}`));
  if (rec.endingNote) out.push('', 'Words they want to leave behind:', rec.endingNote);
  return out.join('\n');
}

// ─── 사주 ────────────────────────────────────────────────────────────────────

/** The chart, as the browser worked it out (src/lib/saju.ts). */
export interface SajuChart {
  pillars: string[];
  dayMaster: string;
  elements: string;
  tenGods: string[];
  daeun: string[];
  currentDaeun?: string;
  thisYear?: string;
  notes: string[];
}

export interface SajuInput {
  lang: string;
  name?: string;
  birthDate: string;
  birthTime?: string;
  chart: SajuChart;
  records: Records;
}

export function cleanSajuInput(raw: unknown): SajuInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const birthDate = str(r['birthDate'], 10);
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const c = (r['chart'] && typeof r['chart'] === 'object' ? r['chart'] : {}) as Record<string, unknown>;
  const pillars = strs(c['pillars'], 4, 40);
  const dayMaster = str(c['dayMaster'], 60);
  if (pillars.length < 3 || !dayMaster) return null;
  const birthTime = str(r['birthTime'], 5);
  const name = str(r['name'], 60);
  const currentDaeun = str(c['currentDaeun'], 80);
  const thisYear = str(c['thisYear'], 80);
  return {
    lang: langOf(r['lang']),
    ...(name ? { name } : {}),
    birthDate,
    ...(birthTime && /^\d{2}:\d{2}$/.test(birthTime) ? { birthTime } : {}),
    chart: {
      pillars,
      dayMaster,
      elements: str(c['elements'], 120) ?? '',
      tenGods: strs(c['tenGods'], 8, 60),
      daeun: strs(c['daeun'], 12, 60),
      ...(currentDaeun ? { currentDaeun } : {}),
      ...(thisYear ? { thisYear } : {}),
      notes: strs(c['notes'], 6, 160),
    },
    records: cleanRecords(r['records']),
  };
}

/**
 * What the reader is told. The rules are the product's promise: a reading
 * that describes the shape of a chart beside the shape of a life, never one
 * that tells fortunes.
 */
export function sajuSystem(lang: string): string {
  return [
    'You write a Four Pillars (사주명리) reading for one person. You are given their chart, already calculated, and — this is what makes the reading theirs — the records they have kept about their own life: the moments of their life line, the people around them, the places they have been, what they wrote about themselves, their moods, their diary.',
    '',
    `Write ONLY in ${LANG_NAME[lang] ?? 'English'}. Every word, including the section titles, is in that language. Chinese characters of the pillars may appear with their reading, e.g. 병오(丙午).`,
    '',
    'What makes this reading different from any other: tie the chart to the record. When you describe a ten-year period (대운) that has already passed, set it beside what they actually recorded in those years — the moves, the jobs, the people, the places — and describe the two side by side. Name real moments, real places and real people from the records. Where their MBTI, mood or answers echo a trait of the chart, say so; where they do not, say that too.',
    '',
    'Rules, in order of importance:',
    '1. Describe energies, tendencies and the composition of the chart. Never predict events: no promotions, marriages, divorces, accidents, illnesses, deaths, bankruptcies, exam results, lawsuits.',
    '2. Nothing about health, illness, lifespan, pregnancy, legal trouble or losing money, in any form.',
    '3. No instructions. Never "be careful", "you must", "you should", "avoid". Go no further than "this is a period in which this kind of energy is strong".',
    '4. No stereotypes by gender or age (no "marriageable age", no "as a woman", no "as a man").',
    '5. Invent nothing about their life. Mention only what is in the records. Where records and chart run side by side, never claim one caused the other.',
    '6. Plain, warm, vivid prose, with short paragraphs. Explain every technical term in a few words the first time it appears.',
    '',
    'Shape: six to eight sections, each with a short title on its own line prefixed with "## ". In this order: the chart at a glance (the day master and the whole); the five elements in them; the past ten-year periods beside their records; the present period; the years ahead as tendencies only; this year; and a closing section on what their own records show of them. Between 2,000 and 3,500 characters in all. No lists or tables, no disclaimer, no mention of being an AI.',
  ].join('\n');
}

export function sajuUser(input: SajuInput): string {
  const c = input.chart;
  const lines: string[] = [];
  if (input.name) lines.push(`Name: ${input.name}`);
  lines.push(`Born: ${input.birthDate}${input.birthTime ? ` ${input.birthTime}` : ' (hour unknown)'}`);
  lines.push('', 'Chart (hour, day, month, year):', ...c.pillars.map((p) => `- ${p}`));
  lines.push(`Day master: ${c.dayMaster}`);
  if (c.elements) lines.push(`Five elements among the characters: ${c.elements}`);
  if (c.tenGods.length) lines.push(`Ten gods: ${c.tenGods.join('; ')}`);
  if (c.daeun.length) lines.push('', 'Ten-year periods (대운):', ...c.daeun.map((d) => `- ${d}`));
  if (c.currentDaeun) lines.push(`Current period: ${c.currentDaeun}`);
  if (c.thisYear) lines.push(`This year (세운): ${c.thisYear}`);
  if (c.notes.length) lines.push('', ...c.notes);
  const rec = recordsText(input.records);
  lines.push('', rec || 'They have not recorded anything yet: read the chart alone, and say once, gently, that the reading grows richer with their records.');
  lines.push('', 'Write the reading now.');
  return lines.join('\n');
}

export const SAJU_MAX_TOKENS = 5000;
