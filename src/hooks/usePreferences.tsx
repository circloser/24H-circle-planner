/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Lang, TKey } from '@/i18n/translations';
import { translate } from '@/i18n/translations';

// ─── Options ──────────────────────────────────────────────────────────────────

export const FONT_FAMILIES = [
  { id: 'Pretendard', label: 'Pretendard', css: 'Pretendard' },
  { id: 'Noto Sans KR', label: 'Noto Sans KR', css: "'Noto Sans KR'" },
  { id: 'Nanum Myeongjo', label: '나눔명조 (Serif)', css: "'Nanum Myeongjo'" },
  { id: 'Jua', label: '주아 (Rounded)', css: "'Jua'" },
  { id: 'Gowun Dodum', label: '고운돋움 (Clean)', css: "'Gowun Dodum'" },
  { id: 'Black Han Sans', label: '검은고딕 (Display)', css: "'Black Han Sans'" },
  { id: 'Gaegu', label: '개구 (손글씨)', css: "'Gaegu'" },
] as const;

// Continuous font-scale slider bounds (replaces the old 3-step buttons).
export const FONT_SCALE_MIN = 0.8;
export const FONT_SCALE_MAX = 1.6;
export const FONT_SCALE_STEP = 0.05;

export const BACKGROUNDS = [
  'none', 'dots', 'grid', 'diagonal', 'gradient', 'paper', 'checker', 'waves', 'memo',
] as const;
export type Background = (typeof BACKGROUNDS)[number];

/** Which background mode is active (mutually exclusive). */
export type BgType = 'pattern' | 'color' | 'image';

export interface Preferences {
  language: Lang;
  fontFamily: string; // css family value, e.g. "Pretendard" or "'Jua'"
  fontScale: number;
  background: Background; // active pattern id (used when bgType === 'pattern')
  bgType: BgType;
  bgColor: string; // hex, used when bgType === 'color'
  bgImage: string | null; // data URL, used when bgType === 'image'
}

const DEFAULT_PREFS: Preferences = {
  language: 'ko',
  fontFamily: 'Pretendard',
  fontScale: 1,
  background: 'none',
  bgType: 'pattern',
  bgColor: '#f4f5f7',
  bgImage: null,
};

const STORAGE_KEY = '24h-circle-planner.prefs';

// ─── Persistence ──────────────────────────────────────────────────────────────

interface PrefsEnvelope {
  version: 1;
  prefs: Preferences;
}

function loadPrefs(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as PrefsEnvelope;
    if (parsed && parsed.version === 1 && parsed.prefs) {
      return { ...DEFAULT_PREFS, ...parsed.prefs };
    }
    return DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: Preferences): void {
  try {
    const envelope: PrefsEnvelope = { version: 1, prefs };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // storage unavailable — preferences simply won't persist
  }
}

/** Apply preferences to the document (CSS vars + attributes). */
function applyPrefs(prefs: Preferences): void {
  const root = document.documentElement;
  root.style.setProperty('--app-font-family', prefs.fontFamily);
  root.style.setProperty('--app-font-scale', String(prefs.fontScale));
  root.setAttribute('lang', prefs.language);

  // Background — three mutually exclusive modes share the data-bg attribute.
  if (prefs.bgType === 'color') {
    root.setAttribute('data-bg', 'color');
    root.style.setProperty('--app-bg-color', prefs.bgColor);
    root.style.removeProperty('--app-bg-image');
  } else if (prefs.bgType === 'image' && prefs.bgImage) {
    root.setAttribute('data-bg', 'image');
    root.style.setProperty('--app-bg-image', `url("${prefs.bgImage}")`);
    root.style.removeProperty('--app-bg-color');
  } else {
    // pattern (incl. 'none')
    root.setAttribute('data-bg', prefs.background);
    root.style.removeProperty('--app-bg-color');
    root.style.removeProperty('--app-bg-image');
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface PreferencesContextValue {
  prefs: Preferences;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(loadPrefs);

  // Apply on mount and whenever prefs change.
  useEffect(() => {
    applyPrefs(prefs);
    savePrefs(prefs);
  }, [prefs]);

  const setPreference = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      setPrefs((p) => ({ ...p, [key]: value }));
    },
    [],
  );

  return (
    <PreferencesContext.Provider value={{ prefs, setPreference }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}

/** Translation hook bound to the current language preference. */
export function useTranslation(): {
  t: (key: TKey, vars?: Record<string, string>) => string;
  lang: Lang;
} {
  const ctx = useContext(PreferencesContext);
  const lang = ctx?.prefs.language ?? 'ko';
  const t = useCallback(
    (key: TKey, vars?: Record<string, string>) => translate(lang, key, vars),
    [lang],
  );
  return { t, lang };
}
