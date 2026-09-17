import { describe, expect, it } from 'vitest';
import { estLabelWidth, labelLines } from '../label-fit';

describe('fitting a slice name to its wedge', () => {
  it('keeps a name that fits on one line', () => {
    expect(labelLines('Work', 22, 999)).toEqual(['Work']);
    expect(labelLines('', 22, 10)).toEqual(['']);
  });

  it('splits a long name at the space nearest the middle', () => {
    expect(labelLines('Commute to the office', 22, 60)).toEqual(['Commute to', 'the office']);
    expect(labelLines('Dinner with family', 22, 60)).toEqual(['Dinner with', 'family']);
  });

  it('splits mid-text where words are not spaced, and never abbreviates', () => {
    expect(labelLines('아침운동시간', 22, 40)).toEqual(['아침운', '동시간']);
    // A single long word has nowhere to break: it stays whole and spills over.
    expect(labelLines('Kraftfahrzeugversicherung', 22, 40)).toEqual(['Kraftfahrzeugversicherung']);
    expect(labelLines('Commute to the office', 22, 60).join(' ')).toBe('Commute to the office');
  });

  it('measures CJK as wider than Latin', () => {
    expect(estLabelWidth('수면', 22)).toBeGreaterThan(estLabelWidth('ab', 22));
  });
});
