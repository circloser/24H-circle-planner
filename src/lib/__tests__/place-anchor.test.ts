import { describe, expect, it } from 'vitest';
import { CARD_GUTTER, CORNER_STRIP, cardAt, shapeCentre } from '../place-anchor';
import type { CountryShape } from '../place';

const box = { w: 1200, h: 800 };
const card = { w: 340, h: 320 };

const shape = (rings: Array<Array<[number, number]>>): CountryShape =>
  ({ code: 'XX', name: 'X', continent: 'Asia', rings });

describe('where the card stands', () => {
  it('opens beside what was chosen', () => {
    const { left, top } = cardAt({ x: 400, y: 400 }, box, card);
    expect(left).toBeGreaterThan(400);
    expect(top).toBeLessThan(400);
    expect(top + card.h).toBeGreaterThan(400);
  });

  it('flips to the other side rather than running off the map', () => {
    expect(cardAt({ x: 1100, y: 400 }, box, card).left).toBeLessThan(1100 - card.w);
  });

  it('never covers the corner the controls are in', () => {
    for (const x of [0, 300, 900, 1150, 1200]) {
      const { left } = cardAt({ x, y: 400 }, box, card);
      expect(left + card.w).toBeLessThanOrEqual(box.w - CORNER_STRIP);
      expect(left).toBeGreaterThanOrEqual(CARD_GUTTER);
    }
  });

  it('stays on the map top and bottom', () => {
    expect(cardAt({ x: 400, y: 0 }, box, card).top).toBe(CARD_GUTTER);
    expect(cardAt({ x: 400, y: 800 }, box, card).top).toBe(box.h - CARD_GUTTER - card.h);
  });

  it('does something sensible on a map smaller than the card', () => {
    const tiny = { w: 320, h: 260 };
    const { left, top } = cardAt({ x: 100, y: 100 }, tiny, card);
    expect(left).toBe(CARD_GUTTER);
    expect(top).toBe(CARD_GUTTER);
  });
});

describe('the middle of a country', () => {
  it('is the average of its biggest ring', () => {
    expect(shapeCentre(shape([[[0, 0], [10, 0], [10, 10], [0, 10]]]))).toEqual({ lng: 5, lat: 5 });
  });

  it('ignores the little islands', () => {
    const c = shapeCentre(shape([[[100, 100]], [[0, 0], [10, 0], [10, 10], [0, 10]]]));
    expect(c).toEqual({ lng: 5, lat: 5 });
  });

  it('answers something for a shape with nothing in it', () => {
    expect(shapeCentre(shape([]))).toEqual({ lng: 0, lat: 0 });
  });
});
