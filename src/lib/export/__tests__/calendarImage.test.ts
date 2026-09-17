import { describe, expect, it } from 'vitest';
import { IMAGE_W, imageLayout, mix } from '../calendarImage';
import { MONTH_ROWS } from '@/lib/calendar-grid';

describe('the calendar image', () => {
  it('lays a five-week month out on a 1080-wide image', () => {
    const L = imageLayout();
    expect(L.width).toBe(IMAGE_W);
    expect(L.grid.h).toBe(L.cellH * MONTH_ROWS);
    expect(L.cellW * 7).toBeCloseTo(L.grid.w);
    expect(L.grid.x + L.grid.w).toBeLessThan(L.width);
    expect(L.height).toBeGreaterThan(L.grid.y + L.grid.h);
    // Room for a few plans under the day number.
    expect(L.lines).toBeGreaterThanOrEqual(3);
  });

  it('mixes a highlighter into the ground like the page does', () => {
    expect(mix('#ffffff', '#000000', 0.55)).toBe('rgb(140, 140, 140)');
    expect(mix('#fef08a', 'rgb(255, 255, 255)', 0.55)).toBe('rgb(254, 247, 191)');
    expect(mix('bogus', '#123456', 0.5)).toBe('#123456');
  });
});
