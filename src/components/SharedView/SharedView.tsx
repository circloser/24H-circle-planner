import { useEffect, useMemo } from 'react';
import { readSharedView } from '@/lib/share-link';
import { CircleTimeline } from '@/components/CircleTimeline/CircleTimeline';
import { useTranslation } from '@/hooks/usePreferences';

const HOME = 'https://24houring.com/';

/**
 * Standalone read-only page for a shared day (route: /s#d=…). The schedule + note
 * are decoded entirely from the URL fragment — nothing is fetched, nothing about
 * the viewer is stored, and the viewer's own data is never touched. Rendered by
 * main.tsx with only PreferencesProvider (no editing stores), so the chart draws
 * in its static preview mode.
 */
export function SharedView() {
  const { t } = useTranslation();
  const content = useMemo(() => readSharedView(), []);

  useEffect(() => {
    document.title = content?.schedule.name
      ? `${content.schedule.name} · 24Houring`
      : '24Houring';
  }, [content]);

  const brand = (
    <a
      href={HOME}
      className="text-xl font-bold tracking-tight text-foreground"
    >
      24Hou<span style={{ color: '#FF4D4D' }}>ring</span>
    </a>
  );

  const cta = (
    <a
      href={HOME}
      className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-105"
    >
      {t('shareview.cta')}
    </a>
  );

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-8">
      <div className="mb-6">{brand}</div>

      {content ? (
        <main className="flex w-full max-w-lg flex-col items-center gap-5">
          <p className="text-sm text-muted-foreground">
            {t('shareview.heading')}
          </p>
          <h1
            className="text-center text-2xl font-bold text-foreground"
          >
            {content.schedule.name || t('shareview.untitled')}
          </h1>

          <div className="w-full max-w-[520px]">
            <CircleTimeline
              slices={content.schedule.slices}
              mode="preview"
              title={content.schedule.name}
              hideLiveMarkers
            />
          </div>

          {content.note.trim() ? (
            <section
              className="w-full rounded-xl border border-border bg-surface p-4"
            >
              <h2
                className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {t('shareview.note')}
              </h2>
              <p
                className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground"
              >
                {content.note}
              </p>
            </section>
          ) : null}

          <div className="pt-2">{cta}</div>
        </main>
      ) : (
        <main className="flex flex-col items-center gap-4 pt-12">
          <p className="text-muted-foreground">{t('shareview.empty')}</p>
          {cta}
        </main>
      )}

      <footer className="mt-10 text-xs text-muted-foreground">
        <a href={HOME}>{t('shareview.madeWith')}</a>
      </footer>
    </div>
  );
}
