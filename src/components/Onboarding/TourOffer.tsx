import { useEffect, useState } from 'react';
import { GraduationCap, X } from 'lucide-react';
import { useTranslation } from '@/hooks/usePreferences';
import { TOURS, tourOfferedKey, type TourId } from './tours';

/** How long after the page opens the offer appears: long enough that the
 *  page has been seen first, short enough to still be a welcome. */
const DELAY_MS = 1200;
/** And how long it waits to be answered before it goes by itself. */
const LINGER_MS = 15_000;

const offered = (tour: TourId): boolean => {
  try { return localStorage.getItem(tourOfferedKey(tour)) !== null; } catch { return true; }
};
const markOffered = (tour: TourId) => {
  try { localStorage.setItem(tourOfferedKey(tour), '1'); } catch { /* private window */ }
};

/**
 * The first time a page of its own is opened, a small card offers its tour.
 *
 * Once per page, and never again whatever the answer — a tour that asks
 * every visit is a nag. It asks nothing of the page underneath: a card at the
 * bottom that can be answered or ignored, and that goes on its own. The same
 * tour is always in ⚙ → 튜토리얼 afterwards.
 */
export function TourOffer({ tour, blocked, onStart }: {
  /** The page open now; the timetable has its own welcome and is not offered here. */
  tour: TourId;
  /** Something else is on screen that must not be talked over (a tour, a first run). */
  blocked: boolean;
  onStart: (tour: Exclude<TourId, 'chart'>) => void;
}) {
  const { t } = useTranslation();
  const [showing, setShowing] = useState<Exclude<TourId, 'chart'> | null>(null);

  useEffect(() => {
    if (tour === 'chart' || blocked || offered(tour)) return;
    const page = tour;
    const shown = window.setTimeout(() => {
      markOffered(page);
      setShowing(page);
    }, DELAY_MS);
    return () => window.clearTimeout(shown);
  }, [tour, blocked]);

  // Gone with the page it was about, and gone by itself after a while.
  useEffect(() => {
    if (!showing) return;
    const gone = window.setTimeout(() => setShowing(null), LINGER_MS);
    return () => window.clearTimeout(gone);
  }, [showing]);

  if (!showing || showing !== tour || blocked) return null;
  const own = TOURS[showing];
  return (
    <div role="dialog" aria-label={t(own.title)} data-tour-offer={showing}
      className="fixed bottom-5 left-1/2 z-[58] flex w-[min(92vw,360px)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-2xl">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10">
        <GraduationCap aria-hidden className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{t(own.title)}</p>
        <p className="text-[12px] text-muted-foreground">{t('tour.offerBody', { n: String(own.steps.length) })}</p>
      </div>
      <button type="button" data-tour-offer-start
        className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground"
        onClick={() => { setShowing(null); onStart(showing); }}>
        {t('tour.start')}
      </button>
      <button type="button" aria-label={t('tour.later')} title={t('tour.later')} data-tour-offer-later
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent/20"
        onClick={() => setShowing(null)}>
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
