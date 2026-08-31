import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { CircleTimeline } from '@/components/CircleTimeline/CircleTimeline';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { useTranslation } from '@/hooks/usePreferences';
import { track } from '@/lib/track';

/**
 * Always-on-top mini widget via the Document Picture-in-Picture API
 * (Chrome/Edge 116+, desktop). Opens a small OS-level floating window showing
 * the live ring + the now/next card; because it's a portal out of the SAME
 * React tree, every edit in the app appears in the widget instantly — no
 * storage events, no reload (unlike the standalone /widget route, which exists
 * for separate pinned browser windows).
 */

interface DocPipApi {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

/** Feature-detect Document Picture-in-Picture (desktop Chrome/Edge only). */
export function isPipSupported(): boolean {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
}

/**
 * Make the app's styling work inside the PiP document: clone stylesheet links
 * (absolute hrefs, so the browser fetches/caches them normally) and inline
 * <style> tags, mirror the theme attribute, and zero the default body margin.
 */
function adoptStyles(pip: Window): void {
  const head = pip.document.head;
  for (const node of Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))) {
    if (node instanceof HTMLLinkElement) {
      const link = pip.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = node.href; // .href is absolute
      head.appendChild(link);
    } else {
      const style = pip.document.createElement('style');
      style.textContent = node.textContent;
      head.appendChild(style);
    }
  }
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme) pip.document.documentElement.setAttribute('data-theme', theme);
  const base = pip.document.createElement('style');
  base.textContent = 'html,body{margin:0;height:100%;overflow:hidden}';
  head.appendChild(base);
  pip.document.title = '24Houring';
}

/** The widget's content — rendered into the PiP window through a portal.
 *  Ring only (user feedback dropped the now/next card), with the chart's own
 *  font-scale var boosted so labels read at a glance: the ring grew 230→360
 *  (×1.56) and the 1.3 var multiplies on top — ≈2× text overall. */
function PipContent() {
  const slices = useStoreSelector((s) => s.history.present.slices);
  return (
    <div
      className="flex h-full w-full items-center justify-center overflow-hidden bg-surface p-3 text-foreground"
      style={{ '--app-font-scale': '1.3' } as React.CSSProperties}
    >
      <div className="w-full max-w-[360px]">
        <CircleTimeline slices={slices} mode="preview" size={360} />
      </div>
    </div>
  );
}

/**
 * Owns the PiP window lifecycle. `open()` must be called from a user gesture
 * (the API requires one); `portal` is rendered by App so the widget lives in
 * the full provider tree.
 */
export function usePipWidget(): { supported: boolean; open: () => Promise<void>; portal: React.ReactNode } {
  const [pipWin, setPipWin] = useState<Window | null>(null);
  const { t } = useTranslation();

  const open = useCallback(async () => {
    if (!isPipSupported()) return;
    try {
      const api = (window as unknown as { documentPictureInPicture: DocPipApi }).documentPictureInPicture;
      const win = await api.requestWindow({ width: 390, height: 430 });
      adoptStyles(win);
      win.addEventListener('pagehide', () => setPipWin(null));
      setPipWin(win);
      track('pip_open');
    } catch {
      // The API can exist but still refuse (embedded webviews, kiosk policies).
      // Silent failure would look broken — say why nothing appeared.
      toast.error(t('pip.failed'));
    }
  }, [t]);

  // App unmount (or hot reload) → close the floating window with it.
  useEffect(() => () => { pipWin?.close(); }, [pipWin]);

  return {
    supported: isPipSupported(),
    open,
    portal: pipWin ? createPortal(<PipContent />, pipWin.document.body) : null,
  };
}
