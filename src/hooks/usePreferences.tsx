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
] as const;

export const FONT_SCALES = [
  { id: 'small', value: 0.85 },
  { id: 'medium', value: 1 },
  { id: 'large', value: 1.2 },
] as const;

export const BACKGROUNDS = ['none', 'dots', 'grid', 'diagonal', 'gradient', 'paper'] as const;
export type Background = (typeof BACKGROUNDS)[number];

export interface Preferences {
  language: Lang;
  fontFamily: string; // css family value, e.g. "Pretendard" or "'Jua'"
  fontScale: number;
  background: Background;
}

const DEFAULT_PREFS: Preferences = {
  language: 'ko',
  fontFamily: 'Pretendard',
  fontScale: 1,
  background: 'none',
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
  root.setAttribute('data-bg', prefs.background);
  root.setAttribute('lang', prefs.language);
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
export function useTranslation(): { t: (key: TKey) => string; lang: Lang } {
  const ctx = useContext(PreferencesContext);
  const lang = ctx?.prefs.language ?? 'ko';
  const t = useCallback((key: TKey) => translate(lang, key), [lang]);
  return { t, lang };
}
