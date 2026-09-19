import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Lightbulb } from 'lucide-react';
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

/** Examples offered on an empty line: title key, category, age at the time. */
const EXAMPLES = [
  { key: 'life.example.school', category: 'education', age: 7 },
  { key: 'life.example.job', category: 'career', age: 26 },
  { key: 'life.example.wedding', category: 'relationship', age: 31 },
] as const;

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

/** A marker on the line and a card to one side of it, with the pointer. */
function CardRow({ side, color, tight, year, plan, future, faint, children, label, onOpen, row }: {
  side: Side;
  color: string;
  tight: boolean;
  year: number;
  plan: boolean;
  /** Below today's marker: the line runs dashed here. */
  future: boolean;
  faint?: boolean;
  children: ReactNode;
  label: string;
  onOpen: () => void;
  row: Record<string, string>;
}) {
  const left = side === 'left';
  const dashed = plan || faint;
  return (
    <li className={`relative ${tight ? 'pt-6' : 'pt-10'}`} data-year={year} data-future={future || undefined} {...row}>
      <Line future={future} />
      <div className="life-reveal group relative">
        <span aria-hidden
          className="absolute left-[28px] top-5 z-10 h-[18px] w-[18px] -translate-x-1/2 rounded-full border-4 border-surface shadow-[0_1px_4px_rgba(0,0,0,.18)] transition-transform group-hover:scale-110 min-[900px]:left-1/2"
          style={{ backgroundColor: color }} />
        <div className={`relative ml-16 mr-4 min-[900px]:mx-0 min-[900px]:w-[calc(50%-48px)] ${left ? '' : 'min-[900px]:ml-auto'} ${
          faint ? 'opacity-60' : plan ? 'opacity-[.85]' : ''}`}>
          {/* The pointer: a turned square half hidden under the card. */}
          <span aria-hidden
            className={`absolute top-[22px] h-3.5 w-3.5 rotate-45 bg-surface shadow-[0_0_3px_rgba(0,0,0,.12)] -left-[7px] ${
              left ? 'min-[900px]:left-auto min-[900px]:-right-[7px]' : ''} ${
              dashed ? `border-dashed border-border border-l-[1.5px] border-b-[1.5px] ${
                left ? 'min-[900px]:border-l-0 min-[900px]:border-b-0 min-[900px]:border-t-[1.5px] min-[900px]:border-r-[1.5px]' : ''}` : ''}`} />
          <div data-life-card
            className={`relative overflow-hidden rounded-2xl bg-surface text-left shadow-[0_4px_16px_rgba(0,0,0,.06)] transition-[transform,box-shadow] duration-150 group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_22px_rgba(0,0,0,.09)] ${
              dashed ? 'border-[1.5px] border-dashed border-border' : ''}`}>
            <span aria-hidden className="block h-1" style={{ backgroundColor: color }} />
            {/* The whole card opens the editor: the title button stretches over it. */}
            <button type="button" aria-label={label} onClick={onOpen}
              className="absolute inset-0 z-[1] rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset" />
            <div className="p-5">{children}</div>
          </div>
        </div>
      </div>
    </li>
  );
}

function Eyebrow({ category, color, text, badge }: { category: LifeCategory; color: string; text: string; badge?: string }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: inkOf(color) }}>
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
      <span>{text}</span>
      {badge && (
        <span className="rounded-full border border-current px-1.5 py-px text-[10px] leading-none tracking-normal normal-case">{badge}</span>
      )}
    </span>
  );
}

/** Two lines of the description, and a way to read the rest. */
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
      <p ref={ref} className={`mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground ${open ? '' : 'line-clamp-2'}`}>{text}</p>
      {(clamped || open) && (
        <button type="button" onClick={() => setOpen((v) => !v)}
          className="relative z-[2] mt-1 text-xs font-medium text-foreground/70 underline-offset-2 hover:underline">
          {t(open ? 'life.less' : 'life.more')}
        </button>
      )}
    </>
  );
}

export function LifeTimeline({ life, items, colors, showExamples, stickyTop, onOpenMoment, onOpenBirth, onAdd }: {
  life: LifeData;
  items: TimelineItem[];
  colors: Record<LifeCategory, string>;
  showExamples: boolean;
  /** Where the sticky year sits: just under the app header. */
  stickyTop: number;
  onOpenMoment: (m: Milestone) => void;
  onOpenBirth: () => void;
  onAdd: (preset: Partial<MilestoneDraft>) => void;
}) {
  const { t, lang } = useTranslation();
  const ref = useRef<HTMLOListElement>(null);
  useReveal(ref, items.length + (showExamples ? 1 : 0));
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

  // Double-click (or a long press on a phone) on the line adds a moment in
  // that row's year.
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  const yearAt = (target: EventTarget | null): number | null => {
    const el = target as Element | null;
    if (!el || el.closest('button, a, input, textarea, [data-life-card]')) return null;
    const row = el.closest<HTMLElement>('[data-year]');
    return row ? Number(row.dataset.year) : null;
  };
  const addAt = (year: number) => onAdd({ date: String(Math.max(year, birthYear)) });
  const endPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  const rows: ReactNode[] = [];
  for (const it of items) {
    if (it.kind === 'decade') {
      rows.push(
        <li key={it.key} className="relative pt-10" data-year={it.decade} data-life-decade>
          <Line future={it.future} />
          <div className="relative flex min-[900px]:justify-center">
            <span className="relative z-10 ml-[28px] -translate-x-1/2 rounded-full border border-border bg-surface px-2 py-0.5 min-[900px]:px-3 text-xs font-semibold tracking-wide text-muted-foreground shadow-sm min-[900px]:ml-0 min-[900px]:translate-x-0">
              {it.decade}s
            </span>
          </div>
        </li>,
      );
    } else if (it.kind === 'today') {
      const age = ageAt(birth, it.date)?.years ?? 0;
      rows.push(
        <li key={it.key} className="relative pt-10" data-year={Number(it.date.slice(0, 4))} data-life-today>
          {/* Solid down to the marker, dashed from it on. */}
          <span aria-hidden className="life-line" style={{ bottom: 'auto', height: 52 }} />
          <span aria-hidden className="life-line life-line--future" style={{ top: 52 }} />
          <div className="relative h-6">
            <span aria-hidden className="life-pulse absolute left-[28px] top-0 z-10 h-6 w-6 -translate-x-1/2 rounded-full border-4 border-surface bg-primary shadow-[0_1px_4px_rgba(0,0,0,.2)] min-[900px]:left-1/2" />
            <span className="absolute left-[48px] top-0 whitespace-nowrap rounded-full bg-primary/10 px-3 text-sm font-semibold leading-6 text-primary min-[900px]:left-[calc(50%+22px)]">
              {t('life.todayAge', { n: String(age) })}
            </span>
          </div>
        </li>,
      );
    } else if (it.kind === 'birth') {
      const color = colors.birth;
      rows.push(
        <CardRow key={it.key} side={it.side} color={color} tight={it.tight} year={birthYear} plan={false} future={false}
          label={`${spokenLifeDate(birth, lang)}, ${t('life.born')}`} onOpen={onOpenBirth}
          row={{ 'data-life-birth': '' }}>
          <Eyebrow category="birth" color={color} text={formatLifeDate(birth)} />
          <span className="mt-1.5 block text-lg font-bold leading-snug text-foreground">{t('life.born')}</span>
          {life.profile.name && <p className="mt-1 text-sm text-muted-foreground">{life.profile.name}</p>}
        </CardRow>,
      );
      if (showExamples) {
        rows.push(
          <li key="examples-hint" className="relative pt-10" data-year={birthYear}>
            <Line future={false} />
            <div className="relative flex min-[900px]:justify-center">
              <span className="relative z-10 ml-16 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm min-[900px]:ml-0">
                <Lightbulb aria-hidden className="h-3.5 w-3.5" />
                {t('life.empty.hint')}
              </span>
            </div>
          </li>,
        );
        EXAMPLES.forEach((ex, i) => {
          const date = String(birthYear + ex.age);
          const color = colors[ex.category];
          rows.push(
            <CardRow key={ex.key} side={(it.side === 'left') === (i % 2 === 0) ? 'right' : 'left'} color={color} tight={false}
              year={birthYear + ex.age} plan={false} future={false} faint label={t(ex.key)}
              onOpen={() => onAdd({ title: t(ex.key), category: ex.category, date })}
              row={{ 'data-life-example': '' }}>
              <Eyebrow category={ex.category} color={color} text={`${date} · ${ageText(date)}`} />
              <span className="mt-1.5 block text-lg font-bold leading-snug text-foreground/70">{t(ex.key)}</span>
            </CardRow>,
          );
        });
      }
    } else {
      const m = it.m;
      const color = colors[m.category];
      rows.push(
        <CardRow key={it.key} side={it.side} color={color} tight={it.tight} year={Number(m.date.slice(0, 4))} plan={it.plan} future={it.future}
          label={`${spokenLifeDate(m.date, lang)}, ${m.title}${it.plan ? `, ${t('life.planBadge')}` : ''}`}
          onOpen={() => onOpenMoment(m)}
          row={{ 'data-life-moment': m.id, ...(it.plan ? { 'data-plan': '' } : {}) }}>
          <Eyebrow category={m.category} color={color} text={dateText(m)} badge={it.plan ? t('life.planBadge') : undefined} />
          <span className="mt-1.5 block text-lg font-bold leading-snug text-foreground">{m.title}</span>
          {m.description && <Description text={m.description} />}
          {m.photo && <LifePhoto id={m.photo} className="mt-3 aspect-video rounded-lg" />}
        </CardRow>,
      );
    }
  }

  return (
    <div className="relative">
      {/* The year at the top of the window follows the scroll. */}
      <div className="pointer-events-none sticky z-20 h-0" style={{ top: stickyTop + 8 }} aria-hidden>
        {topYear !== null && (
          <span data-life-year className="absolute left-[28px] -translate-x-1/2 rounded-full bg-foreground px-2.5 py-0.5 text-xs font-bold tabular-nums text-background shadow min-[900px]:left-1/2">
            {topYear}
          </span>
        )}
      </div>
      <ol ref={ref} aria-label={t('life.timelineLabel')} className="relative mx-auto max-w-[960px] select-none"
        data-life-timeline
        onDoubleClick={(e) => { const y = yearAt(e.target); if (y !== null) addAt(y); }}
        onPointerDown={(e) => {
          if (e.pointerType !== 'touch') return;
          const y = yearAt(e.target);
          if (y === null) return;
          press.current = { x: e.clientX, y: e.clientY, timer: window.setTimeout(() => { press.current = null; addAt(y); }, 600) };
        }}
        onPointerMove={(e) => {
          const p = press.current;
          if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) endPress();
        }}
        onPointerUp={endPress}
        onPointerCancel={endPress}>
        {rows}
      </ol>
      {/* Reserved for the decorating layer (stickers and tape on the line). */}
      <div data-life-layer aria-hidden className="pointer-events-none absolute inset-0" />
    </div>
  );
}
