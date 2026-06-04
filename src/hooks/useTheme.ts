import { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEY_THEME } from '@/lib/storage';

export type Theme = 'light' | 'dark' | 'system';

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_THEME);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage unavailable (SSR / private browsing edge case)
  }
  return 'system';
}

function getSystemPrefers(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveEffective(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return getSystemPrefers();
  return theme;
}

function applyTheme(effectiveTheme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', effectiveTheme);
}

export function useTheme(): {
  theme: Theme;
  effectiveTheme: 'light' | 'dark';
  setTheme: (t: Theme) => void;
} {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const effectiveTheme = resolveEffective(theme);

  // Apply theme to DOM on every change
  useEffect(() => {
    applyTheme(effectiveTheme);
  }, [effectiveTheme]);

  // When theme === 'system', track OS preference changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', handler);
    return () => {
      mql.removeEventListener('change', handler);
    };
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY_THEME, t);
    } catch {
      // ignore
    }
    setThemeState(t);
  }, []);

  return { theme, effectiveTheme, setTheme };
}
