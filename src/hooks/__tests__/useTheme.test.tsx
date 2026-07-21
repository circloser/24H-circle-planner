import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../useTheme';
import { STORAGE_KEY_THEME } from '@/lib/storage';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  writable: true,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

/** matchMedia mock: controllable prefers-color-scheme with change events. */
function mockMatchMedia(dark: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mql = {
    matches: dark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.delete(cb),
  };
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn(() => mql),
    writable: true,
    configurable: true,
  });
  return {
    fire(matches: boolean) {
      mql.matches = matches;
      listeners.forEach((cb) => cb({ matches }));
    },
  };
}

describe('useTheme (light/dark, follows system until chosen)', () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
    document.documentElement.removeAttribute('data-theme');
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('defaults to light when no stored preference and system is light', () => {
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('light');
    });

    it('defaults to dark when no stored preference and system is dark', () => {
      mockMatchMedia(true);
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('dark');
    });

    it('reads stored preference from localStorage', () => {
      storageMock.setItem(STORAGE_KEY_THEME, 'dark');
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('dark');
    });

    it('stored preference beats a differing system setting', () => {
      mockMatchMedia(true);
      storageMock.setItem(STORAGE_KEY_THEME, 'light');
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('light');
    });

    it('ignores invalid/legacy "system" value and falls back to the system setting', () => {
      storageMock.setItem(STORAGE_KEY_THEME, 'system');
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('light');
    });
  });

  describe('system following', () => {
    it('tracks a live system change while no explicit choice exists', () => {
      const media = mockMatchMedia(false);
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('light');
      act(() => media.fire(true));
      expect(result.current.theme).toBe('dark');
      act(() => media.fire(false));
      expect(result.current.theme).toBe('light');
    });

    it('stops following the system after an explicit setTheme', () => {
      const media = mockMatchMedia(false);
      const { result } = renderHook(() => useTheme());
      act(() => { result.current.setTheme('light'); });
      act(() => media.fire(true));
      expect(result.current.theme).toBe('light');
    });

    it('does not follow the system when a stored choice exists', () => {
      storageMock.setItem(STORAGE_KEY_THEME, 'light');
      const media = mockMatchMedia(false);
      const { result } = renderHook(() => useTheme());
      act(() => media.fire(true));
      expect(result.current.theme).toBe('light');
    });
  });

  describe('effectiveTheme mirrors theme', () => {
    it('is light for the light theme', () => {
      storageMock.setItem(STORAGE_KEY_THEME, 'light');
      const { result } = renderHook(() => useTheme());
      expect(result.current.effectiveTheme).toBe('light');
    });

    it('is dark for the dark theme', () => {
      storageMock.setItem(STORAGE_KEY_THEME, 'dark');
      const { result } = renderHook(() => useTheme());
      expect(result.current.effectiveTheme).toBe('dark');
    });
  });

  describe('setTheme', () => {
    it('persists new theme to localStorage', () => {
      const { result } = renderHook(() => useTheme());
      act(() => {
        result.current.setTheme('dark');
      });
      expect(storageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY_THEME, 'dark');
    });

    it('updates theme state', () => {
      const { result } = renderHook(() => useTheme());
      act(() => {
        result.current.setTheme('dark');
      });
      expect(result.current.theme).toBe('dark');
    });

    it('applies the data-theme attribute to documentElement', () => {
      const { result } = renderHook(() => useTheme());
      act(() => {
        result.current.setTheme('dark');
      });
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      act(() => {
        result.current.setTheme('light');
      });
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('toggles between light and dark', () => {
      const { result } = renderHook(() => useTheme());
      act(() => { result.current.setTheme('light'); });
      expect(result.current.theme).toBe('light');
      act(() => { result.current.setTheme('dark'); });
      expect(result.current.theme).toBe('dark');
      act(() => { result.current.setTheme('light'); });
      expect(result.current.theme).toBe('light');
    });

    it('keeps the color-scheme meta in sync (force-dark opt-out)', () => {
      const { result } = renderHook(() => useTheme());
      act(() => { result.current.setTheme('light'); });
      expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('only light');
      act(() => { result.current.setTheme('dark'); });
      expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('dark');
      act(() => { result.current.setTheme('light'); });
      expect(document.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe('only light');
    });
  });
});
