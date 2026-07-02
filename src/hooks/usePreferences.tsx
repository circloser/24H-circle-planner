/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Lang, TKey } from '@/i18n/translations';
import { translate } from '@/i18n/translations';
import type { ChartView } from '@/lib/chart-view';
import { PREFS_SYNC_EVENT } from '@/lib/sync/syncData';

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

/** An extra current-time line for another timezone (world clock). */
export interface WorldClock {
  id: string;
  tz: string; // IANA time zone, e.g. "America/New_York"
  label: string;
  color: string; // hex line colour
}

export const NOW_LINE_DEFAULT_COLOR = '#EF4444';
export const NOW_LINE_DEFAULT_WIDTH = 2.5;

export interface Preferences {
  language: Lang;
  fontFamily: string; // css family value, e.g. "Pretendard" or "'Jua'"
  fontScale: number;
  background: Background; // active pattern id (used when bgType === 'pattern')
  bgType: BgType;
  bgColor: string; // hex, used when bgType === 'color'
  bgImage: string | null; // data URL, used when bgType === 'image'
  showIcons: boolean; // global toggle for slice icons in the chart
  showNowLine: boolean; // current-time indicator line
  nowLineColor: string; // colour of the current-time line
  nowLineWidth: number; // stroke width of the current-time line
  worldClocks: WorldClock[]; // extra timezone lines
  chartView: ChartView; // 24h ('full') / 12h day / 12h night clock window
}

const DEFAULT_PREFS: Preferences = {
  language: 'ko',
  fontFamily: 'Pretendard',
  fontScale: 1,
  background: 'none',
  showIcons: true,
  showNowLine: true,
  nowLineColor: NOW_LINE_DEFAULT_COLOR,
  nowLineWidth: NOW_LINE_DEFAULT_WIDTH,
  worldClocks: [],
  chartView: 'full',
  bgType: 'pattern',
  bgColor: '#f4f5f7',
  bgImage: null,
};

const STORAGE_KEY = '24h-circle-planner.prefs';

/**
 * First-launch language: detect the browser's preferred language and default to
 * Korean only when it actually is Korean; everything else starts in English.
 * Used only when no preference has been saved yet — the user's explicit choice
 * (persisted) always wins on later visits.
 */
function detectInitialLanguage(): Lang {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const tag = (nav?.language || nav?.languages?.[0] || '').toLowerCase();
    return tag.startsWith('ko') ? 'ko' : 'en';
  } catch {
    return 'en';
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

interface PrefsEnvelope {
  version: 1;
  prefs: Preferences;
}

function loadPrefs(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // No saved prefs → genuine first launch: pick the language from the browser.
    if (!raw) return { ...DEFAULT_PREFS, language: detectInitialLanguage() };
    const parsed = JSON.parse(raw) as PrefsEnvelope;
    if (parsed && parsed.version === 1 && parsed.prefs) {
      return { ...DEFAULT_PREFS, ...parsed.prefs };
    }
    return { ...DEFAULT_PREFS, language: detectInitialLanguage() };
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

  // Cross-device sync can adopt a prefs-only cloud change without reloading; when
  // it does, re-read the freshly written prefs so the change shows up live.
  useEffect(() => {
    const onSynced = () => setPrefs(loadPrefs());
    window.addEventListener(PREFS_SYNC_EVENT, onSynced);
    return () => window.removeEventListener(PREFS_SYNC_EVENT, onSynced);
  }, []);

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

/**
 * Null-safe read of the global "show icons" preference (defaults to true when
 * rendered outside a PreferencesProvider, e.g. preset previews / tests).
 */
export function useShowIcons(): boolean {
  const ctx = useContext(PreferencesContext);
  return ctx?.prefs.showIcons ?? true;
}

/** Null-safe read of the red current-time line toggle (default true). */
export function useShowNowLine(): boolean {
  const ctx = useContext(PreferencesContext);
  return ctx?.prefs.showNowLine ?? true;
}

/** Null-safe read of the current-time line style (colour + stroke width). */
export function useNowLineStyle(): { color: string; width: number } {
  const ctx = useContext(PreferencesContext);
  return {
    color: ctx?.prefs.nowLineColor ?? NOW_LINE_DEFAULT_COLOR,
    width: ctx?.prefs.nowLineWidth ?? NOW_LINE_DEFAULT_WIDTH,
  };
}

/** Null-safe read of the configured world-clock lines (default none). */
export function useWorldClocks(): WorldClock[] {
  const ctx = useContext(PreferencesContext);
  return ctx?.prefs.worldClocks ?? [];
}

/** Null-safe read of the chart view window (default 'full' 24h). */
export function useChartView(): ChartView {
  const ctx = useContext(PreferencesContext);
  return ctx?.prefs.chartView ?? 'full';
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
