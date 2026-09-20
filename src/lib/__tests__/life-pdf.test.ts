import { describe, expect, it } from 'vitest';
import { OVERLAP, pdfPages } from '../export/lifePdf';

describe('cutting the life line into pages', () => {
  it('keeps a short line on one page', () => {
    expect(pdfPages(1000, 800)).toEqual([{ sy: 0, sh: 800 }]);
  });

  it('covers the whole image, with each page overlapping the one before', () => {
    const w = 2160;
    const h = 20000;
    const pages = pdfPages(w, h);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0].sy).toBe(0);
    // Nothing is skipped: every page starts inside the one before it.
    for (let i = 1; i < pages.length; i++) {
      expect(pages[i].sy).toBeLessThan(pages[i - 1].sy + pages[i - 1].sh);
    }
    const last = pages.at(-1)!;
    expect(last.sy + last.sh).toBe(h);
  });

  it('repeats about the asked-for overlap', () => {
    const pages = pdfPages(2160, 20000, 0.1);
    const band = pages[0].sh;
    expect(pages[1].sy).toBeCloseTo(band * 0.9, -1);
    expect(OVERLAP).toBeGreaterThan(0);
  });
});
