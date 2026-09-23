import { describe, expect, it } from 'vitest';
import {
  branchTenGod, chartOf, daeunOf, elementCount, julianDayNumber, pillarHanja, sunLongitude, tenGod, yearPillar,
} from '../saju';

const KST = 540;
const at = (date: string, time?: string) => chartOf({ date, ...(time ? { time } : {}), offsetMinutes: KST });

describe('the sun and the calendar', () => {
  it('counts days as the almanacs do', () => {
    expect(julianDayNumber(2000, 1, 1)).toBe(2451545);
    expect(julianDayNumber(1900, 1, 1)).toBe(2415021);
  });

  it('puts the sun where it is', () => {
    // The March equinox of 2024 fell at 03:06 UTC on the 20th.
    expect(sunLongitude(Date.UTC(2024, 2, 20, 3, 6))).toBeCloseTo(0, 1);
    // The June solstice of 2024: 20:51 UTC on the 20th.
    expect(sunLongitude(Date.UTC(2024, 5, 20, 20, 51))).toBeCloseTo(90, 1);
  });
});

describe('the four pillars', () => {
  it('names the day by the cycle of sixty', () => {
    expect(pillarHanja(at('2000-01-01').day)).toBe('戊午');
    expect(pillarHanja(at('1900-01-01').day)).toBe('甲戌');
  });

  it('names the year, which turns at 입춘 and not on New Year’s Day', () => {
    expect(pillarHanja(yearPillar(1984))).toBe('甲子');
    expect(pillarHanja(yearPillar(2024))).toBe('甲辰');
    // 입춘 2024 was at 17:27 KST on 4 February.
    expect(pillarHanja(at('2024-02-04', '10:00').year)).toBe('癸卯');
    expect(pillarHanja(at('2024-02-04', '18:00').year)).toBe('甲辰');
    expect(pillarHanja(at('2024-01-20').year)).toBe('癸卯');
    expect(pillarHanja(at('2024-12-31').year)).toBe('甲辰');
  });

  it('names the month by its 절기', () => {
    expect(pillarHanja(at('2024-02-04', '10:00').month)).toBe('乙丑');
    expect(pillarHanja(at('2024-02-04', '18:00').month)).toBe('丙寅');
    // 경칩 2024 was on 5 March: the tenth is 卯 month of a 甲 year.
    expect(pillarHanja(at('2024-03-10').month)).toBe('丁卯');
  });

  it('names the hour from the day (五鼠遁), and turns the day at 23:00', () => {
    const noon = at('2000-01-01', '12:30');
    expect(pillarHanja(noon.hour!)).toBe('戊午');
    const late = at('2000-01-01', '23:30');
    expect(pillarHanja(late.day)).toBe('己未');
    expect(pillarHanja(late.hour!)).toBe('甲子');
    expect(at('2000-01-01').hour).toBeNull();
  });
});

describe('what the characters are', () => {
  it('counts the elements among them', () => {
    const c = at('2000-01-01', '12:30');
    const n = elementCount(c);
    expect(Object.values(n).reduce((a, b) => a + b, 0)).toBe(8);
    expect(Object.values(elementCount(at('2000-01-01'))).reduce((a, b) => a + b, 0)).toBe(6);
  });

  it('names each one’s relation to the day master', () => {
    // 甲 day: 甲 비견, 乙 겁재, 丙 식신, 丁 상관, 戊 편재, 己 정재, 庚 편관, 辛 정관, 壬 편인, 癸 정인.
    expect([...Array(10).keys()].map((s) => tenGod(0, s))).toEqual(
      ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인']);
    // A branch by its main hidden stem: 子 holds 癸, which to 甲 is 정인.
    expect(branchTenGod(0, 0)).toBe('정인');
  });
});

describe('the ten-year periods', () => {
  it('run forward or back by the year and the person, from the month pillar', () => {
    // A 甲 (yang) year: forward for a man, back for a woman.
    const input = { date: '2024-03-10', time: '12:00', offsetMinutes: KST };
    const man = daeunOf(input, 'male');
    const woman = daeunOf(input, 'female');
    expect(man.forward).toBe(true);
    expect(woman.forward).toBe(false);
    expect(pillarHanja(man.periods[0].pillar)).toBe('戊辰');
    expect(pillarHanja(woman.periods[0].pillar)).toBe('丙寅');
    // 청명 2024 was on 4 April, 25 days on: 8 years. 경칩 was 5 days back: 2.
    expect(man.number).toBe(8);
    expect(woman.number).toBe(2);
    expect(man.periods.map((p) => p.startAge)).toEqual([8, 18, 28, 38, 48, 58, 68, 78, 88, 98]);
  });
});
