import { describe, expect, it } from 'vitest';
import { MAX_NAME_LINES, NAME_SIZE, emWidth, nameBox, wrapName } from '../relation-name';

describe('a name measured without a canvas', () => {
  it('counts a wide character as wide and a narrow one as narrow', () => {
    expect(emWidth('김하루')).toBe(3);
    expect(emWidth('iii')).toBeLessThan(emWidth('WWW'));
    expect(emWidth('')).toBe(0);
    // A Korean name and a Latin one of the same letter count are not the
    // same width, and the measure has to know it.
    expect(emWidth('정하윤')).toBeGreaterThan(emWidth('ann'));
  });
});

describe('breaking a name to fit', () => {
  it('leaves a short name alone', () => {
    expect(wrapName('나', 6)).toEqual(['나']);
    expect(wrapName('김하루', 6)).toEqual(['김하루']);
  });

  it('breaks a Latin name where it reads, at the space', () => {
    expect(wrapName('Ada Lovelace', 6)).toEqual(['Ada', 'Lovelace']);
  });

  it('breaks Korean between characters, because that is how it breaks', () => {
    const lines = wrapName('김하루아버지', 3);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toContain('김하루');
    for (const line of lines) expect(emWidth(line)).toBeLessThanOrEqual(3.01);
  });

  it('never gives back more lines than it was allowed', () => {
    const lines = wrapName('아주아주아주아주아주긴이름입니다그렇습니다', 3, 2);
    expect(lines.length).toBeLessThanOrEqual(2);
  });

  it('says so when a name would not fit at all', () => {
    const lines = wrapName('아주아주아주아주아주긴이름입니다그렇습니다', 2, 2);
    expect(lines[lines.length - 1].endsWith('…')).toBe(true);
  });

  it('has nothing to say about nothing', () => {
    expect(wrapName('   ', 6)).toEqual([]);
  });
});

describe('the circle a name asks for', () => {
  it('asks for no more than one line of writing needs', () => {
    // A single letter still needs room for that letter; nothing at all keeps
    // the circle it was given.
    expect(nameBox('나', 9).radius).toBeGreaterThanOrEqual(9);
    expect(nameBox('나', 9).radius).toBeLessThan(NAME_SIZE * 1.6);
    expect(nameBox('', 9)).toEqual({ lines: [], radius: 9 });
  });

  it('grows the circle rather than letting the name out of it', () => {
    const short = nameBox('김하루', 9);
    const long = nameBox('알렉산드라 콘스탄티노바', 9);
    expect(long.radius).toBeGreaterThan(short.radius);
    expect(long.lines.length).toBeGreaterThan(1);
    expect(long.lines.length).toBeLessThanOrEqual(MAX_NAME_LINES);
  });

  it('holds every line it gives back', () => {
    for (const name of ['나', '김하루', 'Ada Lovelace', '알렉산드라 콘스탄티노바', 'Jean-Baptiste Poquelin']) {
      const { lines, radius } = nameBox(name, 9);
      const w = Math.max(...lines.map(emWidth)) * NAME_SIZE;
      const h = lines.length * NAME_SIZE * 1.15;
      // Every line fits inside the circle, corner to corner.
      expect(Math.hypot(w, h) / 2).toBeLessThanOrEqual(radius);
    }
  });

  it('prefers the roundest way to write a long name', () => {
    // Two short lines make a smaller circle than one long one.
    const { lines } = nameBox('Ada Lovelace', 9);
    expect(lines.length).toBe(2);
  });

  it('never cuts a Latin name in the middle of a word', () => {
    expect(nameBox('Ada Lovelace', 9).lines).toEqual(['Ada', 'Lovelace']);
    expect(nameBox('Jean Baptiste Poquelin', 9).lines.join(' ')).toBe('Jean Baptiste Poquelin');
  });

  it('never breaks a name that fits on one line', () => {
    // Even where two lines would make a smaller circle, a three-character
    // Korean name is written as a three-character Korean name.
    for (const name of ['이정숙', '김영수', '나', 'Ada']) {
      expect(nameBox(name, 9).lines).toEqual([name]);
    }
  });
});
