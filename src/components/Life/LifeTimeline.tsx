import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
import { useTranslation } from '@/hooks/usePreferences';
import { loadPhoto } from '@/lib/calendar-photos';
import {
  ageAt, formatLifeDate, spokenLifeDate,
  type LifeCategory, type LifeData, type Milestone, type Side, type TimelineItem,
} from '@/lib/life';
import type { MilestoneDraft } from '@/hooks/useLife';
import { CATEGORY_ICON, inkOf } from './categories';

/**
 * The line itself. Every row draws its own stretch of the line (solid above
 * today, dashed below), then a marker on it and a card reaching out to the
 * side with a small pointer. Phones put the line on the left and every card
 * on the right; from 900px the cards alternate left and right of the centre.
 *
 * Rows are plain block boxes in one relative <ol>, so a later decorating
 * layer (stickers, tape — the calendar's engine) can lie over it with
 * absolute coordinates: see the empty [data-life-layer] slot below.
 */

/** Adds `data-shown` to each `.life-reveal` box as it scrolls into view. */
function useReveal(root: React.RefObject<HTMLElement | null>, deps: unknown) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const boxes = [...el.querySelectorAll<HTMLElement>('.life-reveal:not([data-shown])')];
    if (typeof IntersectionObserver === 'undefined') {
      boxes.forEach((b) => b.setAttribute('data-shown', ''));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.setAttribute('data-shown', '');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    boxes.forEach((b) => io.observe(b));
    return () => io.disconnect();
  }, [root, deps]);
}

/** The year of the row at the top of the window, for the sticky year label. */
function useTopYear(root: React.RefObject<HTMLElement | null>, offset: number): number | null {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rows = root.current?.querySelectorAll<HTMLElement>('[data-year]');
      if (!rows?.length) return setYear(null);
      // Rows run top to bottom, so the last one above the line is found by halving.
      let lo = 0;
      let hi = rows.length - 1;
      let found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (rows[mid].getBoundingClientRect().top <= offset) { found = mid; lo = mid + 1; } else hi = mid - 1;
      }
      setYear(found < 1 ? null : Number(rows[found].dataset.year));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [root, offset]);
  return year;
}

/** A picture from this device's store, fetched only once it comes near. */
export function LifePhoto({ id, className }: { id: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const load = () => void loadPhoto(id).then((u) => { if (live) setUrl(u); });
    if (typeof IntersectionObserver === 'undefined') { load(); return () => { live = false; }; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
    }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => { live = false; io.disconnect(); };
  }, [id]);
  return (
    <span ref={ref} className={`block overflow-hidden bg-muted ${className ?? ''}`}>
      {url && <img src={url} alt="" loading="lazy" className="block h-full w-full object-cover" />}
    </span>
  );
}

function Line({ future }: { future: boolean }) {
  return <span aria-hidden className={`life-line ${future ? 'life-line--future' : ''}`} />;
}

/** Which side of the line the entry sits on (wide screens set text toward it). */
const SideCtx = createContext(false);

/**
 * A hollow marker on the line and, to one side of it, the entry as plain
 * text: the date in italics, a serif title, the story, and its photo. No box
 * around it — spacing and alignment do the work. Wide screens set an entry
 * on the left flush right, toward the line.
 */
function EntryRow({ side, tight, year, plan, future, faint, children, label, onOpen, row, decor }: {
  side: Side;
  tight: boolean;
  year: number;
  plan: boolean;
  /** Below today's marker: the line runs dashed here. */
  future: boolean;
  faint?: boolean;
  children: ReactNode;
  label: string;
  onOpen?: () => void;
  row: Record<string, string>;
  /** The decorating layer for this row, when the page hands one down. */
  decor?: ReactNode;
}) {
  const left = side === 'left';
  const dashed = plan || faint;
  return (
    <li className={`relative ${tight ? 'pt-6' : 'pt-12'}`} data-year={year} data-future={future || undefined} {...row}>
      <Line future={future} />
      {decor}
      <div className="life-reveal group relative">
        <span aria-hidden data-life-marker
          className={`absolute left-[28px] top-[33px] z-10 h-[26px] w-[26px] -translate-x-1/2 rounded-full border-2 bg-background transition-transform duration-150 group-hover:scale-110 min-[900px]:left-1/2 ${
            dashed ? 'border-dashed' : ''} ${faint ? 'border-foreground/40' : 'border-foreground'}`} />
        <div data-life-card
          className={`relative ml-16 mr-4 min-[900px]:mx-0 min-[900px]:w-[calc(50%-72px)] ${
            left ? 'min-[900px]:text-right' : 'min-[900px]:ml-auto'} ${faint ? 'opacity-55' : plan ? 'opacity-[.8]' : ''}`}>
          {/* The whole entry opens the editor: one button stretched over it.
              A shared line is read-only, so there is nothing to press. */}
          {onOpen && (
            <button type="button" aria-label={label} onClick={onOpen}
              className="absolute -inset-2 z-[1] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          )}
          <SideCtx.Provider value={left}>{children}</SideCtx.Provider>
        </div>
      </div>
    </li>
  );
}

/** The italic line above a title: category icon (colour and shape, so never
 *  colour alone), date and age, and "plan" when it is one. */
function DateLine({ category, color, text, badge }: { category: LifeCategory; color: string; text: string; badge?: string }) {
  const left = useContext(SideCtx);
  const Icon = CATEGORY_ICON[category];
  return (
    <span className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] italic leading-[22px] text-muted-foreground ${left ? 'min-[900px]:justify-end' : ''}`}>
      <Icon aria-hidden className="h-4 w-4 shrink-0 not-italic" style={{ color: inkOf(color) }} />
      <span>{text}</span>
      {badge && (
        <span className="rounded-full border border-current px-2 text-[11px] not-italic leading-[18px] tracking-wide">{badge}</span>
      )}
    </span>
  );
}

function Title({ children, faint }: { children: ReactNode; faint?: boolean }) {
  return (
    <span className={`life-serif mt-2 block text-[22px] font-bold leading-8 tracking-tight decoration-1 underline-offset-[6px] group-hover:underline min-[900px]:text-2xl ${
      faint ? 'text-foreground/70' : 'text-foreground'}`}>
      {children}
    </span>
  );
}

/** Three lines of the story, and a way to read the rest. */
function Description({ text }: { text: string }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [clamped, setClamped] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (el && !open) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);
  return (
    <>
      <p ref={ref} className={`mt-3 whitespace-pre-line text-base leading-relaxed text-foreground/75 ${open ? '' : 'line-clamp-3'}`}>{text}</p>
      {(clamped || open) && (
        <button type="button" onClick={() => setOpen((v) => !v)}
          className="relative z-[2] mt-3 text-[15px] text-primary underline decoration-1 underline-offset-4 hover:decoration-2">
          {t(open ? 'life.less' : 'life.more')}
        </button>
      )}
    </>
  );
}

export function LifeTimeline({ life, items, colors, stickyTop, readOnly, rowDecor, decorating, onOpenMoment, onOpenBirth, onAdd }: {
  life: LifeData;
  items: TimelineItem[];
  colors: Record<LifeCategory, string>;
  /** Where the sticky year sits: just under the app header. */
  stickyTop: number;
  /** Someone else's line (a share link): shown, never touched. */
  readOnly?: boolean;
  /** Decorations for a row (다꾸), when the page is decorating. */
  rowDecor?: (row: string) => ReactNode;
  /** While decorating, the line adds nothing on hover. */
  decorating?: boolean;
  onOpenMoment?: (m: Milestone) => void;
  onOpenBirth?: () => void;
  onAdd?: (preset: Partial<MilestoneDraft>) => void;
}) {
  const { t, lang } = useTranslation();
  const ref = useRef<HTMLOListElement>(null);
  // Which rows exist, not how many: adding the first moment swaps the
  // examples out for it and leaves the count the same.
  useReveal(ref, items.map((i) => i.key).join('|'));
  const topYear = useTopYear(ref, stickyTop + 28);
  const birth = life.profile.birthDate;
  const birthYear = Number(birth.slice(0, 4));

  const ageText = (date: string) => {
    const a = ageAt(birth, date);
    if (!a) return '';
    return t(a.approx ? 'life.ageApprox' : 'life.age', { n: String(a.years) });
  };
  const dateText = (m: Pick<Milestone, 'date' | 'endDate'>) => {
    const range = m.endDate ? `${formatLifeDate(m.date)} – ${formatLifeDate(m.endDate)}` : formatLifeDate(m.date);
    const age = ageText(m.date);
    return age ? `${range} · ${age}` : range;
  };

  // Adding happens on the line itself. With a mouse, a faint circle with a +
  // follows the pointer along the line and adds a moment in that year; on a
  // touch screen a tap on the line does the same, and a + waits just below
  // today's marker so the way in is always in sight.
  const wrap = useRef<HTMLDivElement>(null);
  const coarse = useCoarsePointer();
  const [ghost, setGhost] = useState<{ x: number; y: number; year: number } | null>(null);
  const addAt = (year: number) => onAdd?.({ date: String(Math.max(year, birthYear)) });
  /** Where the line runs, in window coordinates. */
  const lineX = () => {
    const ol = ref.current!.getBoundingClientRect();
    return window.matchMedia('(min-width: 900px)').matches ? ol.left + ol.width / 2 : ol.left + 28;
  };
  /** The year of the row at a height: the last row starting above it. */
  const yearAtY = (clientY: number): number => {
    const rows = ref.current?.querySelectorAll<HTMLElement>(':scope > li[data-year]');
    let year = birthYear;
    rows?.forEach((r) => { if (r.getBoundingClientRect().top <= clientY) year = Number(r.dataset.year); });
    return year;
  };
  /** Near the line, and not over an entry's own text or a button. Markers and
   *  labels do NOT hide it: the circle should glide the whole way down. */
  const onLine = (e: React.PointerEvent) =>
    Math.abs(e.clientX - lineX()) <= 28
    && !(e.target as Element).closest('[data-life-card], button, a');
  const tap = useRef<{ x: number; y: number } | null>(null);

  const rows: ReactNode[] = [];
  for (const it of items) {
    if (it.kind === 'decade') {
      rows.push(
        <li key={it.key} className="relative pt-12" data-year={it.decade} data-life-decade>
          <Line future={it.future} />
          {rowDecor?.(it.key)}
          <div className="relative flex min-[900px]:justify-center">
            <span data-life-label className="life-serif relative z-10 ml-[28px] -translate-x-1/2 bg-background px-2 py-1 text-[15px] font-bold tracking-wide text-muted-foreground min-[900px]:ml-0 min-[900px]:translate-x-0">
              {it.decade}s
            </span>
          </div>
        </li>,
      );
    } else if (it.kind === 'today') {
      const age = ageAt(birth, it.date)?.years ?? 0;
      const year = Number(it.date.slice(0, 4));
      rows.push(
        <li key={it.key} className="relative pt-12" data-year={year} data-life-today>
          {/* Solid down to the marker, dashed from it on. */}
          <span aria-hidden className="life-line" style={{ bottom: 'auto', height: 61 }} />
          <span aria-hidden className="life-line life-line--future" style={{ top: 61 }} />
          {rowDecor?.('today')}
          <div className="relative h-[26px]">
            <span aria-hidden data-life-label className="life-pulse absolute left-[28px] top-0 z-10 h-[26px] w-[26px] -translate-x-1/2 rounded-full border-[6px] border-background bg-primary ring-2 ring-primary min-[900px]:left-1/2" />
            <span data-life-label className="absolute left-[52px] top-0 whitespace-nowrap text-[15px] font-semibold italic leading-[26px] text-primary min-[900px]:left-[calc(50%+28px)]">
              {t('life.todayAge', { n: String(age) })}
            </span>
            {coarse && !readOnly && (
              <button type="button" aria-label={t('life.add')} data-life-add-touch onClick={() => addAt(year)}
                className="absolute left-[28px] top-[42px] z-20 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border border-foreground/25 bg-background/80 text-foreground/70 backdrop-blur-sm min-[900px]:left-1/2">
                <Plus aria-hidden className="h-4 w-4" />
              </button>
            )}
          </div>
        </li>,
      );
    } else if (it.kind === 'birth') {
      const color = colors.birth;
      rows.push(
        <EntryRow key={it.key} side={it.side} tight={it.tight} year={birthYear} plan={false} future={false}
          label={`${spokenLifeDate(birth, lang)}, ${t('life.born')}`} onOpen={readOnly ? undefined : onOpenBirth}
          row={{ 'data-life-birth': '' }} decor={rowDecor?.('birth')}>
          <DateLine category="birth" color={color} text={formatLifeDate(birth)} />
          <Title>{t('life.born')}</Title>
          {life.profile.name && <p className="mt-3 text-[15px] leading-relaxed text-foreground/75">{life.profile.name}</p>}
        </EntryRow>,
      );
    } else {
      const m = it.m;
      const color = colors[m.category];
      rows.push(
        <EntryRow key={it.key} side={it.side} tight={it.tight} year={Number(m.date.slice(0, 4))} plan={it.plan} future={it.future}
          label={`${spokenLifeDate(m.date, lang)}, ${m.title}${it.plan ? `, ${t('life.planBadge')}` : ''}`}
          onOpen={readOnly ? undefined : () => onOpenMoment?.(m)}
          row={{ 'data-life-moment': m.id, ...(it.plan ? { 'data-plan': '' } : {}) }} decor={rowDecor?.(m.id)}>
          <DateLine category={m.category} color={color} text={dateText(m)} badge={it.plan ? t('life.planBadge') : undefined} />
          <Title>{m.title}</Title>
          {m.description && <Description text={m.description} />}
          {m.photo && <LifePhoto id={m.photo} className="mt-4 aspect-video rounded-lg" />}
        </EntryRow>,
      );
    }
  }

  return (
    <div ref={wrap} className="relative"
      onPointerMove={(e) => {
        if (readOnly || decorating || e.pointerType !== 'mouse' || !wrap.current) return;
        // Over the circle itself: let it follow, keep its year.
        if ((e.target as Element).closest('[data-life-ghost]')) return;
        if (!onLine(e)) { setGhost(null); return; }
        const box = wrap.current.getBoundingClientRect();
        setGhost({ x: lineX() - box.left, y: e.clientY - box.top, year: yearAtY(e.clientY) });
      }}
      onPointerLeave={() => setGhost(null)}
      onPointerDown={(e) => { tap.current = !readOnly && !decorating && e.pointerType === 'touch' && onLine(e) ? { x: e.clientX, y: e.clientY } : null; }}
      onPointerUp={(e) => {
        const start = tap.current;
        tap.current = null;
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 10) addAt(yearAtY(e.clientY));
      }}
      onPointerCancel={() => { tap.current = null; }}>
      {/* Keyboard: the same "add a moment", reachable with Tab. */}
      {!readOnly && <button type="button" data-life-add onClick={() => onAdd?.({})}
        className="sr-only focus:not-sr-only focus:absolute focus:left-1/2 focus:top-0 focus:z-30 focus:-translate-x-1/2 focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:text-background">
        {t('life.add')}
      </button>}
      {/* The year at the top of the window follows the scroll. */}
      <div className="pointer-events-none sticky z-20 h-0" style={{ top: stickyTop + 8 }} aria-hidden>
        {topYear !== null && (
          <span data-life-year className="life-serif absolute left-[28px] -translate-x-1/2 rounded-full bg-foreground px-3 py-0.5 text-sm font-bold tabular-nums text-background min-[900px]:left-1/2">
            {topYear}
          </span>
        )}
      </div>
      <ol ref={ref} aria-label={t('life.timelineLabel')} className="relative mx-auto max-w-[960px] select-none" data-life-timeline>
        {rows}
      </ol>
      {ghost && (
        <button type="button" data-life-ghost aria-label={t('life.add')} title={t('life.add')}
          onClick={() => addAt(ghost.year)}
          className="absolute z-30 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-foreground/25 bg-foreground/10 text-foreground/70 backdrop-blur-sm transition-colors hover:bg-foreground/20 hover:text-foreground"
          style={{ left: ghost.x, top: ghost.y }}>
          <Plus aria-hidden className="h-4 w-4" />
        </button>
      )}
      {/* Reserved for the decorating layer (stickers and tape on the line). */}
      <div data-life-layer aria-hidden className="pointer-events-none absolute inset-0" />
    </div>
  );
}
