import { useEffect, useMemo, useState } from 'react';
import { readSharedView, decodeShare, type SharedContent } from '@/lib/share-link';
import { decodeLifeShare } from '@/lib/life-share';
import { addSharedLine, type InviteResult } from '@/lib/life-invite';
import { buildTimeline, type LifeData } from '@/lib/life';
import { CircleTimeline } from '@/components/CircleTimeline/CircleTimeline';
import { LifeTimeline } from '@/components/Life/LifeTimeline';
import { categoryColors } from '@/components/Life/categories';
import { useTranslation } from '@/hooks/usePreferences';

const HOME = 'https://24houring.com/';

/**
 * Standalone read-only page for a shared day. Two link shapes land here:
 *  - /s#d=…    — the schedule + note decoded entirely from the fragment;
 *                nothing is fetched and nothing touches any server.
 *  - /s/:id    — a server-stored share (OG-unfurling short link). The worker
 *                injects the payload as window.__SHARE24H__; if that's missing
 *                (e.g. a service-worker-cached shell), fall back to fetching
 *                /api/share/:id.
 * Rendered by main.tsx with only PreferencesProvider (no editing stores), so
 * the chart draws in its static preview mode.
 */
export function SharedView() {
  const { t } = useTranslation();
  const initial = useMemo<SharedContent | null>(() => {
    const fromHash = readSharedView();
    if (fromHash) return fromHash;
    const injected = (window as unknown as { __SHARE24H__?: { d?: string } }).__SHARE24H__;
    if (injected?.d) return decodeShare(injected.d);
    return null;
  }, []);
  const shareId = useMemo(() => /^\/s\/([A-Za-z0-9]{4,24})$/.exec(window.location.pathname)?.[1] ?? null, []);
  const [content, setContent] = useState<SharedContent | null>(initial);
  // The same link shapes can carry a whole life instead of one day.
  const [life, setLife] = useState<LifeData | null>(() => {
    const code = /[#&]d=([^&]+)/.exec(window.location.hash)?.[1]
      ?? (window as unknown as { __SHARE24H__?: { d?: string } }).__SHARE24H__?.d;
    return code ? decodeLifeShare(code) : null;
  });
  // "resolving" while a /s/:id page still has a fetch in flight — don't flash
  // the invalid-link state before the payload has had a chance to arrive.
  const [resolving, setResolving] = useState(Boolean(!initial && shareId));

  useEffect(() => {
    if (initial || !shareId) return;
    let cancelled = false;
    void fetch(`/api/share/${shareId}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ d?: string }>) : null))
      .then((body) => {
        if (cancelled || !body?.d) return;
        const shared = decodeLifeShare(body.d);
        if (shared) setLife(shared);
        else setContent(decodeShare(body.d));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initial, shareId]);

  useEffect(() => {
    if (life) {
      document.title = life.profile.name ? `${life.profile.name} · 24Houring` : '24Houring';
      return;
    }
    document.title = content?.schedule.name
      ? `${content.schedule.name} · 24Houring`
      : '24Houring';
  }, [content, life]);

  /**
   * Keeping someone else's line.
   *
   * The page already draws their life; this puts it beside the reader's own,
   * on the reader's own device, when they ask for it. How many lines they may
   * hold depends on their plan, so it is asked once, and only when there is a
   * life on the page to keep.
   */
  const [pro, setPro] = useState(false);
  const [kept, setKept] = useState<InviteResult | null>(null);
  useEffect(() => {
    if (!life) return;
    let alive = true;
    void fetch('/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<{ plan?: string }>) : null))
      .then((body) => { if (alive && body?.plan === 'pro') setPro(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, [life]);

  const keep = () => {
    // No name of our own for it: a line shared without one is called by the
    // year it began, which tells the reader who it is. They can rename it.
    const done = addSharedLine(life, { pro });
    setKept(done);
    // The life page reads the record as it loads, so it is opened afresh.
    if (done === 'added' || done === 'already') {
      window.setTimeout(() => { window.location.href = '/?view=life'; }, 800);
    }
  };

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

      {life ? (
        <main className="flex w-full max-w-[1040px] flex-col items-center gap-6">
          <h1 className="life-serif text-3xl font-bold tracking-tight text-foreground">
            {life.profile.name || t('life.title')}
          </h1>
          <div className="w-full">
            <LifeTimeline life={life} items={buildTimeline(life)} colors={categoryColors(null)} readOnly />
          </div>
          {life.endingNote?.text && (
            <section className="mx-4 w-full max-w-[640px]">
              <h2 className="life-serif text-center text-2xl font-bold tracking-tight text-foreground">{t('life.endingNote')}</h2>
              <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground/80">{life.endingNote.text}</p>
            </section>
          )}
          {/* The other half of a share: the reader can keep the line. */}
          <div className="flex flex-col items-center gap-2 pt-2">
            <button type="button" data-life-keep onClick={keep}
              className="inline-flex items-center justify-center rounded-full border border-foreground px-5 py-2.5 text-sm font-semibold text-foreground transition-transform hover:scale-105">
              {t('life.keep.add')}
            </button>
            {kept && (
              <p role="status" data-life-keep-said className="text-[13px] text-muted-foreground">
                {t(kept === 'added' ? 'life.keep.done'
                  : kept === 'already' ? 'life.keep.already'
                    : kept === 'full' ? 'life.keep.full' : 'life.keep.blank')}
              </p>
            )}
            {cta}
          </div>
        </main>
      ) : content ? (
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
      ) : resolving ? (
        <main className="flex flex-col items-center gap-4 pt-12" aria-busy="true" />
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
