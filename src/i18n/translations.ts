/**
 * Public i18n module — the import path every consumer uses. The dictionaries
 * live in ./dict/ (ko is the source of truth; TKey is derived from it, so a new
 * key is added in dict/ko.ts + dict/en.ts and nowhere else).
 */
import { ko, type TKey } from './dict/ko';
import { en } from './dict/en';
import { de } from './dict/de';
import { ja } from './dict/ja';
import { zh } from './dict/zh';
import { fr } from './dict/fr';
import { es } from './dict/es';
import { ru } from './dict/ru';

export type { TKey };

export const LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'ru', label: 'Русский' },
] as const;

export type Lang = (typeof LANGUAGES)[number]['code'];

type Dict = Record<TKey, string>;

// All eight are now FULL translations (each dict/*.ts is a Record<TKey,string>).
export const TRANSLATIONS: Record<Lang, Partial<Dict>> = { ko, en, de, ja, zh, fr, es, ru };

/**
 * Resolve a key for a language: lang → English → the key itself.
 * Optional `vars` replace `{name}`-style placeholders in the resolved string.
 */
export function translate(lang: Lang, key: TKey, vars?: Record<string, string>): string {
  let s = TRANSLATIONS[lang]?.[key] ?? en[key] ?? key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      s = s.replace(`{${k}}`, vars[k]);
    }
  }
  return s;
}
