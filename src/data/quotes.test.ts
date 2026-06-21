import { describe, it, expect } from 'vitest';
import { LANGUAGES } from '@/i18n/translations';
import { QUOTES, randomQuote } from './quotes';

const LANGS = LANGUAGES.map((l) => l.code);
const HANGUL = /[가-힣]/;

describe('QUOTES', () => {
  it('has 50 quotes', () => {
    expect(QUOTES.length).toBe(50);
  });

  it('provides a non-empty text + author for every supported language', () => {
    for (const q of QUOTES) {
      for (const lang of LANGS) {
        expect(q[lang], `missing form for ${lang}`).toBeTruthy();
        expect(q[lang].text.trim().length).toBeGreaterThan(0);
        expect(q[lang].author.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe('randomQuote', () => {
  it('formats text + em-dash attribution', () => {
    expect(randomQuote('en')).toMatch(/\n\n— .+/);
  });

  it('returns Korean for ko and non-Korean for en', () => {
    // Sample many draws so we are confident the language switch holds.
    for (let i = 0; i < 40; i++) {
      expect(HANGUL.test(randomQuote('ko'))).toBe(true);
      expect(HANGUL.test(randomQuote('en'))).toBe(false);
    }
  });
});
