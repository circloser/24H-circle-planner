/**
 * 사주 (the Four Pillars), worked out on the device.
 *
 * Nothing here interprets. It turns a birth date and hour into the eight
 * characters, counts the five elements among them, names each character's
 * relation to the day master (십신), and lays out the ten-year periods (대운).
 * The reading is written elsewhere (worker/readings.ts) from these facts and
 * the person's own records; the facts themselves are arithmetic, and the
 * same birth always gives the same chart.
 *
 * The one astronomical fact it needs is where the sun stands on the ecliptic,
 * because the year turns at 입춘 and each month at its 절기, not on the 1st.
 * That is the low-precision solar position (Meeus, Astronomical Algorithms
 * ch. 25): good to about a hundredth of a degree, which is a quarter of an
 * hour of time. A birth within fifteen minutes of a 절기 may land on either
 * side of it; any other birth lands where every almanac puts it.
 *
 * Conventions, stated because schools differ:
 *  · the day turns at 23:00 — a birth at 23:xx is the 子 hour of the next day;
 *  · clock time is used as given (no longitude correction to true solar time);
 *  · 대운수 is the days to the next (or since the previous) 절 divided by 3,
 *    rounded, and kept between 1 and 10.
 */

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
export const STEMS_KO = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const;
export const BRANCHES_KO = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const;

export type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water';
export const ELEMENTS: readonly Element[] = ['wood', 'fire', 'earth', 'metal', 'water'];
export const ELEMENT_KO: Record<Element, string> = { wood: '목(木)', fire: '화(火)', earth: '토(土)', metal: '금(金)', water: '수(水)' };

const STEM_ELEMENT: readonly Element[] = ['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water'];
const BRANCH_ELEMENT: readonly Element[] = ['water', 'earth', 'wood', 'wood', 'earth', 'fire', 'fire', 'earth', 'metal', 'metal', 'earth', 'water'];
/** Each branch's main hidden stem (본기), which decides its 십신. */
const BRANCH_MAIN_STEM = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8] as const;

export type TenGod =
  | '비견' | '겁재' | '식신' | '상관' | '편재' | '정재' | '편관' | '정관' | '편인' | '정인';

export interface Pillar { stem: number; branch: number }

export interface Chart {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  /** Null when the hour of birth is not known. */
  hour: Pillar | null;
  /** The year the chart counts from (it turns at 입춘, not on 1 January). */
  sajuYear: number;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Julian day number of a Gregorian calendar date (noon-based integer). */
export function julianDayNumber(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}

const julianDay = (ms: number) => ms / 86_400_000 + 2440587.5;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** The sun's apparent ecliptic longitude, degrees 0–360, at an instant. */
export function sunLongitude(ms: number): number {
  const t = (julianDay(ms) - 2451545) / 36525;
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
  const c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(rad(m))
    + (0.019993 - 0.000101 * t) * Math.sin(rad(2 * m))
    + 0.000289 * Math.sin(rad(3 * m));
  const omega = 125.04 - 1934.136 * t;
  return mod(l0 + c - 0.00569 - 0.00478 * Math.sin(rad(omega)), 360);
}

export const sexagenary = (i: number): Pillar => ({ stem: mod(i, 10), branch: mod(i, 12) });
/** The place of a pillar in the cycle of sixty (甲子 = 0). */
export const cycleIndex = (p: Pillar): number => {
  for (let i = 0; i < 60; i++) if (i % 10 === p.stem && i % 12 === p.branch) return i;
  return 0;
};

export const pillarHanja = (p: Pillar) => `${STEMS[p.stem]}${BRANCHES[p.branch]}`;
export const pillarKo = (p: Pillar) => `${STEMS_KO[p.stem]}${BRANCHES_KO[p.branch]}`;

export interface BirthInput {
  /** 'YYYY-MM-DD'. */
  date: string;
  /** 'HH:MM', or absent when the hour is not known. */
  time?: string;
  /** Minutes east of UTC at the place and moment of birth (Korea: 540). */
  offsetMinutes: number;
}

/** The instant of birth, in milliseconds since the epoch. */
function birthInstant(input: BirthInput): { ms: number; y: number; m: number; d: number; minutes: number | null } {
  const [y, m, d] = input.date.split('-').map(Number);
  const t = input.time && /^\d{2}:\d{2}$/.test(input.time) ? input.time.split(':').map(Number) : null;
  // Without an hour, noon: the middle of the day is the fairest guess for
  // where the year and the month fall.
  const minutes = t ? t[0] * 60 + t[1] : null;
  const ms = Date.UTC(y, m - 1, d, 0, minutes ?? 720) - input.offsetMinutes * 60_000;
  return { ms, y, m, d, minutes };
}

/** The four pillars of a birth. */
export function chartOf(input: BirthInput): Chart {
  const { ms, y, m, d, minutes } = birthInstant(input);
  const lon = sunLongitude(ms);

  // The year turns at 입춘 (the sun at 315°). In January and February a sun
  // short of 315° is still last year's.
  const sajuYear = m <= 2 && lon < 315 && lon > 200 ? y - 1 : y;
  const year = sexagenary(sajuYear - 4);

  // Each month turns at its 절: 입춘 315° begins 寅, and every 30° after it
  // the next branch. The first month's stem follows from the year's (五虎遁).
  const k = Math.floor(mod(lon - 315, 360) / 30);
  const month: Pillar = { stem: mod((year.stem % 5) * 2 + 2 + k, 10), branch: mod(k + 2, 12) };

  // The day turns at 23:00: the 子 hour belongs to the day it begins.
  const late = minutes !== null && minutes >= 23 * 60;
  const day = sexagenary(julianDayNumber(y, m, d) + (late ? 1 : 0) + 49);

  let hour: Pillar | null = null;
  if (minutes !== null) {
    const branch = Math.floor((minutes + 60) / 120) % 12;
    // The first hour's stem follows from the day's (五鼠遁).
    hour = { stem: mod((day.stem % 5) * 2 + branch, 10), branch };
  }
  return { year, month, day, hour, sajuYear };
}

/** The element of a stem or a branch. */
export const stemElement = (s: number): Element => STEM_ELEMENT[mod(s, 10)];
export const branchElement = (b: number): Element => BRANCH_ELEMENT[mod(b, 12)];
const yang = (stem: number) => stem % 2 === 0;

/** How many of the chart's characters are of each element. */
export function elementCount(chart: Chart): Record<Element, number> {
  const out: Record<Element, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  for (const p of [chart.year, chart.month, chart.day, chart.hour]) {
    if (!p) continue;
    out[stemElement(p.stem)] += 1;
    out[branchElement(p.branch)] += 1;
  }
  return out;
}

const GENERATES: Record<Element, Element> = { wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood' };
const CONTROLS: Record<Element, Element> = { wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood' };

/** What a stem is to the day master (십신). */
export function tenGod(dayStem: number, other: number): TenGod {
  const me = stemElement(dayStem);
  const it = stemElement(other);
  const same = yang(dayStem) === yang(other);
  if (it === me) return same ? '비견' : '겁재';
  if (GENERATES[me] === it) return same ? '식신' : '상관';
  if (CONTROLS[me] === it) return same ? '편재' : '정재';
  if (CONTROLS[it] === me) return same ? '편관' : '정관';
  return same ? '편인' : '정인';
}

/** What a branch is to the day master, by its main hidden stem. */
export const branchTenGod = (dayStem: number, branch: number): TenGod =>
  tenGod(dayStem, BRANCH_MAIN_STEM[mod(branch, 12)]);

export type Gender = 'male' | 'female';

export interface Daeun {
  /** The age (만 나이, roughly) the period begins at. */
  startAge: number;
  pillar: Pillar;
}

/** Where the next (or the previous) 절 falls, to the minute. */
function nextJeol(ms: number, forward: boolean): number {
  const step = (forward ? 1 : -1) * 86_400_000;
  const segment = (t: number) => Math.floor(mod(sunLongitude(t) - 315, 360) / 30);
  const start = segment(ms);
  let a = ms;
  let b = ms + step;
  for (let i = 0; i < 40 && segment(b) === start; i++) {
    a = b;
    b += step;
  }
  // Halve the day it lies in until it is known to the minute.
  for (let i = 0; i < 12; i++) {
    const mid = (a + b) / 2;
    if (segment(mid) === start) a = mid; else b = mid;
  }
  return forward ? b : a;
}

/**
 * The ten-year periods. Forward for a yang year and a man or a yin year and a
 * woman, backward otherwise; each steps one place round the sixty from the
 * month pillar, and the first begins at the 대운수.
 */
export function daeunOf(input: BirthInput, gender: Gender, count = 10): { forward: boolean; number: number; periods: Daeun[] } {
  const chart = chartOf(input);
  const { ms } = birthInstant(input);
  const forward = yang(chart.year.stem) === (gender === 'male');
  const days = Math.abs(nextJeol(ms, forward) - ms) / 86_400_000;
  const number = Math.max(1, Math.min(10, Math.round(days / 3)));
  const from = cycleIndex(chart.month);
  const periods = Array.from({ length: count }, (_, i) => ({
    startAge: number + i * 10,
    pillar: sexagenary(from + (forward ? i + 1 : -(i + 1))),
  }));
  return { forward, number, periods };
}

/** The pillar of a calendar year (세운), counted from its 입춘. */
export const yearPillar = (year: number): Pillar => sexagenary(year - 4);

/** The minutes east of UTC this browser would use for a birth at that time. */
export function localOffsetMinutes(date: string, time?: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time && /^\d{2}:\d{2}$/.test(time) ? time.split(':').map(Number) : [12, 0];
  return -new Date(y, m - 1, d, hh, mm).getTimezoneOffset();
}
