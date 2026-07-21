import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEY_THEME } from '@/lib/storage';

export type Theme = 'light' | 'dark';

/** Browser-chrome colour per theme (status bar in the installed TWA/PWA).
 *  light = --background hsl(220 20% 97%), dark = hsl(220 25% 8%). */
const THEME_COLORS: Record<Theme, string> = {
  light: '#f4f5f7',
  dark: '#0f131a',
};

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_THEME);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable (SSR / private browsing edge case)
  }
  return null;
}

function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  // The color-scheme META is the page-level opt-out Android browsers check for
  // force-dark ("only light" = never invert this page). CSS alone is not
  // enough on Samsung/Chrome Android, so keep the meta in sync with the theme.
  let meta = document.querySelector('meta[name="color-scheme"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'color-scheme');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', theme === 'dark' ? 'dark' : 'only light');
}

/**
 * Explicit light/dark theme. Until the user picks one, the app follows the
 * OS/browser dark-mode setting (live) — installed-app users expect the system
 * toggle to work. The first manual toggle persists a choice and detaches from
 * the system setting for good.
 */
export function useTheme(): {
  theme: Theme;
  effectiveTheme: Theme;
  setTheme: (t: Theme) => void;
} {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme() ?? systemTheme());
  const [followSystem, setFollowSystem] = useState<boolean>(() => readStoredTheme() === null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!followSystem) return;
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = (e: MediaQueryListEvent) => setThemeState(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    } catch {
      return; // matchMedia unavailable (jsdom edge case)
    }
  }, [followSystem]);

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY_THEME, t);
    } catch {
      // ignore
    }
    setFollowSystem(false);
    setThemeState(t);
  }, []);

  return { theme, effectiveTheme: theme, setTheme };
}
