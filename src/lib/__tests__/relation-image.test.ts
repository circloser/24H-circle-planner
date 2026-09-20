import { describe, expect, it } from 'vitest';
import { LANGUAGES, TRANSLATIONS } from '@/i18n/translations';
import { ko } from '@/i18n/dict/ko';
import { emptyRelation, type Person, type RelationData, type RelationGroup } from '../relation';
import { RELATION_IMAGE_SIZE, drawRelation } from '../export/relationImage';

const p = (id: string, over: Partial<Person> = {}): Person =>
  ({ id, name: id, group: 'friend', closeness: 2, createdAt: '', ...over });

const colors: Record<RelationGroup, string> = {
  family: '#b4544a', friend: '#5b7893', work: '#7a8355', other: '#8a8a8a',
};

/** A canvas context that writes down what it was asked to do. */
function stub() {
  const texts: Array<{ text: string; x: number; y: number }> = [];
  const circles: Array<{ x: number; y: number; r: number; stroke: string; alpha: number }> = [];
  let alpha = 1;
  let stroke = '';
  const ctx = {
    set globalAlpha(v: number) { alpha = v; },
    get globalAlpha() { return alpha; },
    set strokeStyle(v: string) { stroke = v; },
    get strokeStyle() { return stroke; },
    fillStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    _arc: null as null | { x: number; y: number; r: number },
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    setLineDash() {},
    save() {},
    restore() {},
    clip() {},
    drawImage() {},
    fill() {},
    arc(x: number, y: number, r: number) { this._arc = { x, y, r }; },
    stroke() { if (this._arc) circles.push({ ...this._arc, stroke, alpha }); },
    fillText(text: string, x: number, y: number) { texts.push({ text, x, y }); },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts, circles };
}

const paint = (data: RelationData, size = 600) => {
  const s = stub();
  drawRelation(s.ctx, {
    data, colors, today: '2026-09-20', background: '#f4f5f7', ink: '#2b2b2b',
    accent: '#2f6feb', meLabel: '나', caption: '사람 2명',
  }, size);
  return s;
};

describe('the map as a picture', () => {
  it('writes every name, however faint the person is on screen', () => {
    const { texts } = paint({
      ...emptyRelation(),
      me: { name: '김하루' },
      people: [p('a', { name: '최민준' }), p('b', { name: '윤도현', lastContact: '2020-01-01' })],
    });
    const written = texts.map((t) => t.text);
    expect(written).toContain('최민준');
    expect(written).toContain('윤도현');
    expect(written).toContain('사람 2명');
    expect(written).toContain('24Houring');
  });

  it('draws the middle even when nobody else is there', () => {
    const { circles } = paint(emptyRelation());
    expect(circles.length).toBeGreaterThan(0);
    // The middle is at the middle.
    expect(circles.at(-1)).toMatchObject({ x: 300, y: 300 });
  });

  it('fades someone nobody has spoken to in years', () => {
    const { circles } = paint({
      ...emptyRelation(),
      people: [p('a', { name: '가까운', lastContact: '2026-09-19' }), p('b', { name: '먼', lastContact: '2018-01-01' })],
    });
    const near = circles.find((c) => c.stroke === colors.friend && c.alpha === 1);
    const far = circles.find((c) => c.stroke === colors.friend && c.alpha < 1);
    expect(near).toBeTruthy();
    expect(far).toBeTruthy();
  });

  it('puts a second ring around a birthday that is nearly here', () => {
    const { circles } = paint({ ...emptyRelation(), people: [p('a', { birthday: '10-01' })] });
    expect(circles.some((c) => c.stroke === '#2f6feb')).toBe(true);
  });

  it('is square, and as big as it says it is', () => {
    expect(RELATION_IMAGE_SIZE).toBe(2160);
    const { circles } = paint(emptyRelation(), 2160);
    expect(circles.at(-1)).toMatchObject({ x: 1080, y: 1080 });
  });
});

const RELATION_KEYS = Object.keys(ko).filter((k) => k === 'nav.relation' || k.startsWith('relation.'));

describe('the relation map in every language', () => {
  it('has its words', () => {
    expect(RELATION_KEYS.length).toBeGreaterThan(50);
  });

  it.each(LANGUAGES.map((l) => l.code))('%s: every relation key is there and not empty', (lang) => {
    const dict = TRANSLATIONS[lang] as Record<string, string | undefined>;
    expect(RELATION_KEYS.filter((k) => !dict[k]?.trim())).toEqual([]);
  });

  it.each(LANGUAGES.map((l) => l.code))('%s: keeps every {placeholder}', (lang) => {
    const dict = TRANSLATIONS[lang] as Record<string, string>;
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    expect(RELATION_KEYS.filter((k) => holes(dict[k]) !== holes((ko as Record<string, string>)[k]))).toEqual([]);
  });

  it('never promises anyone else will be told', () => {
    for (const { code } of LANGUAGES) {
      const hint = (TRANSLATIONS[code] as Record<string, string>)['relation.privacy.hint'];
      expect(hint).toBeTruthy();
    }
  });
});
