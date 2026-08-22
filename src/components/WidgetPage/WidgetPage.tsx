import { useEffect } from 'react';
import { CircleTimeline } from '@/components/CircleTimeline/CircleTimeline';
import { NowNextCard } from '@/components/NowNext/NowNextCard';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { useTheme } from '@/hooks/useTheme';

/**
 * Compact "desktop widget" view (route: /widget). A small always-glanceable page
 * — a static 24h ring with the live now-line + the "지금 & 다음" card — meant to
 * be opened in a small, pinned browser window (Chrome "Open as window" / a PWA
 * window) beside your work. Read-only; edits happen in the full app.
 */
export function WidgetPage() {
  useTheme(); // apply the saved / system theme to <html data-theme>
  const slices = useStoreSelector((s) => s.history.present.slices);

  useEffect(() => {
    document.title = '24Houring · Now & Next';
    // Keep this compact route out of the index (it mirrors the app's data).
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow';
  }, []);

  // Cross-window live refresh: the full app (a different tab/window, same origin)
  // writes the schedule to localStorage, which fires a `storage` event HERE. The
  // page is tiny, so a reload is the simplest way to re-read the current day.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === '24h-circle-planner.days' || e.key === '24h-circle-planner.schedule') {
        window.location.reload();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <div className="min-h-screen w-full bg-surface text-foreground">
      <div className="mx-auto flex max-w-[360px] flex-col items-center gap-3 p-4">
        <div className="w-full max-w-[220px]">
          <CircleTimeline slices={slices} mode="preview" size={220} />
        </div>
        <div className="w-full rounded-xl border border-border bg-surface p-3 shadow-sm">
          <NowNextCard slices={slices} />
        </div>
      </div>
    </div>
  );
}
