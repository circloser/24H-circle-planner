import { useState, useEffect } from 'react';

/** Phone-width breakpoint (Tailwind `md`). Below this we switch to the stacked,
 *  single-column mobile layout. */
const MOBILE_QUERY = '(max-width: 767px)';

/**
 * True on narrow (phone-sized) viewports — drives the stacked mobile layout
 * (full-width chart, memos as a grid, clock tools as a fixed section below).
 * Distinct from useCoarsePointer: a tablet is coarse but wide, and stays on the
 * desktop layout. Reactive to viewport resize / orientation change.
 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return mobile;
}
