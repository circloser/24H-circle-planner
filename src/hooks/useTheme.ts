import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEY_THEME } from '@/lib/storage';

export type Theme = 'light' | 'dark';

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_THEME);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable (SSR / private browsing edge case)
  }
  return 'light';
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Explicit light/dark theme only — the app does not follow the OS preference
 * (by design). `effectiveTheme` mirrors `theme` and is kept for callers.
 */
export function useTheme(): {
  theme: Theme;
  effectiveTheme: Theme;
  setTheme: (t: Theme) => void;
} {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY_THEME, t);
    } catch {
      // ignore
    }
    setThemeState(t);
  }, []);

  return { theme, effectiveTheme: theme, setTheme };
}
