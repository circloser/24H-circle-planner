import { describe, expect, it } from 'vitest';
import { PLACE_SWATCHES, placeColors } from '../place-colors';
import { PIN_CATEGORIES, cleanPalette, decodePlace, emptyPlace, isPlaceColor } from '../place';

const base = { visited: '#b4544a', wished: '#4a72b4' };

describe('the colours a map may be given', () => {
  it('offers a dozen, all of them writable as they are stored', () => {
    expect(PLACE_SWATCHES.length).toBeGreaterThanOrEqual(8);
    expect(PLACE_SWATCHES.every(isPlaceColor)).toBe(true);
  });

  it('takes only a full hex colour', () => {
    expect(isPlaceColor('#ff0000')).toBe(true);
    expect(isPlaceColor('#FF0000')).toBe(true);
    expect(isPlaceColor('#f00')).toBe(false);
    expect(isPlaceColor('red')).toBe(false);
    expect(isPlaceColor('javascript:alert(1)')).toBe(false);
    expect(isPlaceColor(null)).toBe(false);
  });

  it('keeps what it understands and drops the rest', () => {
    expect(cleanPalette({ visited: '#AABBCC', wished: 'red', pins: { food: '#112233', nope: '#445566' } }))
      .toEqual({ visited: '#aabbcc', pins: { food: '#112233' } });
    expect(cleanPalette({ pins: { food: 'chartreuse' } })).toBeUndefined();
    expect(cleanPalette('#ffffff')).toBeUndefined();
    expect(cleanPalette(undefined)).toBeUndefined();
  });

  it('falls back to the theme, and a pin to the colour of having been', () => {
    const plain = placeColors(undefined, base);
    expect(plain.visited).toBe(base.visited);
    expect(plain.wished).toBe(base.wished);
    expect(PIN_CATEGORIES.every((c) => plain.pin[c] === base.visited)).toBe(true);
  });

  it('gives a kind of pin its own colour when it has been given one', () => {
    const chosen = placeColors({ visited: '#111111', pins: { food: '#222222' } }, base);
    expect(chosen.visited).toBe('#111111');
    expect(chosen.pin.food).toBe('#222222');
    expect(chosen.pin.stay).toBe('#111111');
    expect(chosen.wished).toBe(base.wished);
  });
});

describe('the record that holds them', () => {
  it('carries a palette through a load and a save unchanged', () => {
    const data = { ...emptyPlace(), palette: { visited: '#123456', pins: { work: '#654321' } } };
    const back = decodePlace(JSON.parse(JSON.stringify(data)));
    expect(back?.palette).toEqual({ visited: '#123456', pins: { work: '#654321' } });
    // Byte-stable: what a load gives is what the next save writes.
    expect(JSON.stringify(decodePlace(back))).toBe(JSON.stringify(back));
  });

  it('leaves a record without one alone', () => {
    expect(decodePlace(emptyPlace())?.palette).toBeUndefined();
    expect(JSON.stringify(decodePlace(emptyPlace()))).not.toContain('palette');
  });

  it('refuses a colour that is not one', () => {
    const back = decodePlace({ ...emptyPlace(), palette: { visited: 'url(evil)' } });
    expect(back?.palette).toBeUndefined();
  });
});
