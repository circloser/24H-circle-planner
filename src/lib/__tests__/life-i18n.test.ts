import { describe, expect, it } from 'vitest';
import { LANGUAGES, TRANSLATIONS } from '@/i18n/translations';
import { ko } from '@/i18n/dict/ko';

const LIFE_KEYS = Object.keys(ko).filter((k) => k === 'nav.life' || k.startsWith('life.') || k === 'upgrade.featLife');

describe('the life page in every language', () => {
  it('has its words', () => {
    expect(LIFE_KEYS.length).toBeGreaterThan(80);
  });

  it.each(LANGUAGES.map((l) => l.code))('%s: every life key is there and not empty', (lang) => {
    const dict = TRANSLATIONS[lang] as Record<string, string | undefined>;
    const missing = LIFE_KEYS.filter((k) => !dict[k]?.trim());
    expect(missing).toEqual([]);
  });

  it.each(LANGUAGES.map((l) => l.code))('%s: keeps every {placeholder}', (lang) => {
    const dict = TRANSLATIONS[lang] as Record<string, string>;
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    const broken = LIFE_KEYS.filter((k) => holes(dict[k]) !== holes((ko as Record<string, string>)[k]));
    expect(broken).toEqual([]);
  });

  it('never calls the ending note a will in its name', () => {
    for (const { code } of LANGUAGES) {
      const name = (TRANSLATIONS[code] as Record<string, string>)['life.endingNote'];
      expect(name).not.toMatch(/유언|will|Testament|遺言|遗嘱|testament|завещ/i);
    }
  });
});
