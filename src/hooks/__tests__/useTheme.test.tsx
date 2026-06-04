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

// matchMedia mock — default: light preference
let systemPrefersDark = false;
const matchMediaListeners: Array<(e: MediaQueryListEvent) => void> = [];

const matchMediaMock = vi.fn((query: string) => {
  if (query === '(prefers-color-scheme: dark)') {
    return {
      matches: systemPrefersDark,
      media: query,
      addEventListener: vi.fn((event: string, cb: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') matchMediaListeners.push(cb);
      }),
      removeEventListener: vi.fn((event: string, cb: (e: MediaQueryListEvent) => void) => {
        if (event === 'change') {
          const idx = matchMediaListeners.indexOf(cb);
          if (idx !== -1) matchMediaListeners.splice(idx, 1);
        }
      }),
      dispatchEvent: vi.fn(),
    };
  }
  return {
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
});

Object.defineProperty(globalThis, 'matchMedia', {
  value: matchMediaMock,
  writable: true,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useTheme', () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
    matchMediaListeners.length = 0;
    systemPrefersDark = false;
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('defaults to system when no stored preference', () => {
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('system');
    });

    it('reads stored preference from localStorage', () => {
      storageMock.setItem(STORAGE_KEY_THEME, 'dark');
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('dark');
    });

    it('ignores invalid stored value and defaults to system', () => {
      storageMock.setItem(STORAGE_KEY_THEME, 'invalid');
      const { result } = renderHook(() => useTheme());
      expect(result.current.theme).toBe('system');
    });
  });

  describe('effectiveTheme', () => {
    it('resolves system to light when OS is light', () => {
      systemPrefersDark = false;
      const { result } = renderHook(() => useTheme());
      expect(result.current.effectiveTheme).toBe('light');
    });

    it('resolves system to dark when OS is dark', () => {
      systemPrefersDark = true;
      const { result } = renderHook(() => useTheme());
      expect(result.current.effectiveTheme).toBe('dark');
    });

    it('resolves light theme to light regardless of OS', () => {
      systemPrefersDark = true;
      storageMock.setItem(STORAGE_KEY_THEME, 'light');
      const { result } = renderHook(() => useTheme());
      expect(result.current.effectiveTheme).toBe('light');
    });

    it('resolves dark theme to dark regardless of OS', () => {
      systemPrefersDark = false;
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

    it('applies data-theme attribute to documentElement', () => {
      const { result } = renderHook(() => useTheme());
      act(() => {
        result.current.setTheme('light');
      });
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('cycles correctly: light → dark → system → light', () => {
      const { result } = renderHook(() => useTheme());
      act(() => { result.current.setTheme('light'); });
      expect(result.current.theme).toBe('light');
      act(() => { result.current.setTheme('dark'); });
      expect(result.current.theme).toBe('dark');
      act(() => { result.current.setTheme('system'); });
      expect(result.current.theme).toBe('system');
      act(() => { result.current.setTheme('light'); });
      expect(result.current.theme).toBe('light');
    });
  });

  describe('cleanup on unmount', () => {
    it('removes matchMedia listener when unmounted while in system mode', () => {
      const { result, unmount } = renderHook(() => useTheme());
      // Confirm it's in system mode
      expect(result.current.theme).toBe('system');
      // Should have registered a listener
      expect(matchMediaListeners.length).toBeGreaterThan(0);
      unmount();
      // Listener should be removed
      expect(matchMediaListeners.length).toBe(0);
    });

    it('does not leak listeners when switching away from system', () => {
      const { result } = renderHook(() => useTheme());
      act(() => { result.current.setTheme('dark'); });
      // When not in system mode, listener should be cleaned up
      expect(matchMediaListeners.length).toBe(0);
    });
  });
});
