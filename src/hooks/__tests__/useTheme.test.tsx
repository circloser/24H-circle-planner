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

describe('useTheme (light/dark only)', () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('defaults to light when no stored preference', () => {
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('light');
    });

    it('reads stored preference from localStorage', () => {
      storageMock.setItem(STORAGE_KEY_THEME, 'dark');
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('dark');
    });

    it('ignores invalid/legacy "system" value and defaults to light', () => {
      storageMock.setItem(STORAGE_KEY_THEME, 'system');
      const { result } = renderHook(() => useTheme());
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
  });
});
