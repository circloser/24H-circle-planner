import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';
import { formatLifeDate, type LifeCategory, type LifeData, type Milestone } from '@/lib/life';
import {
  MAX_SPAN, MIN_SPAN, buildParallel, stackLabels, type ParallelLine,
} from '@/lib/life-parallel';
import { CATEGORY_ICON, inkOf } from './categories';

export interface LifeParallelProps {
  life: LifeData;
  colors: Record<LifeCategory, string>;
  today: string;
  meLabel: string;
  /** Who is folded away for now. */
  hidden: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onAddLine: () => void;
  onOpenLine: (id: string) => void;
  onOpenMoment: (lineId: string, moment: Milestone) => void;
  onAddMoment: (lineId: string) => void;
}

/** How wide one life is, and the least a chart may be squeezed into. */
const LANE = 168;

/**
 * Lives side by side.
 *
 * Reading two lines against each other is a different thing from reading one:
 * what you are looking for is the year that appears on both, so the years run
 * down the page once and every line is hung on them. The dots never move off
 * their year — only the labels beside them are nudged apart when a year is
 * crowded, which is what a hand drawing this would do.
 *
 * Drawn in ordinary elements rather than on a canvas, so every moment is a
 * real button: a keyboard can walk the whole chart, and a screen reader reads
 * it as what it is, a list of lives and what happened in them.
 */
export function LifeParallel({
  life, colors, today, meLabel, hidden, onToggle, onAddLine, onOpenLine, onOpenMoment, onAddMoment,
}: LifeParallelProps) {
  const { t } = useTranslation();
  const [span, setSpan] = useState(1);
  const box = useRef<HTMLDivElement>(null);
  const chart = useMemo(
    () => buildParallel(life, { today, span, hidden }),
    [life, today, span, hidden],
  );

  // Open on today rather than on a birth eighty years ago.
  const started = useRef(false);
  useEffect(() => {
    const el = box.current;
    if (!el || started.current || !chart.lines.length) return;
    started.current = true;
    el.scrollTop = Math.max(0, chart.today - el.clientHeight / 2);
  }, [chart]);

  const zoom = (by: number) => setSpan((s) => Math.min(MAX_SPAN, Math.max(MIN_SPAN, s * (by > 0 ? 1.5 : 1 / 1.5))));
  const all = life.others ?? [];

  return (
    <section data-life-parallel className="mt-6 flex flex-col gap-3">
      {/* Who is on it, and who could be. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[13px] text-muted-foreground">{t('life.parallel.who')}</span>
        {[{ id: 'me', name: life.profile.name || meLabel }, ...all.map((o) => ({ id: o.id, name: o.name }))]
          .map(({ id, name }) => {
            const off = id !== 'me' && hidden.has(id);
            return (
              <button key={id} type="button" data-life-line-toggle={id} aria-pressed={!off}
                onClick={() => (id === 'me' ? undefined : onToggle(id))}
                onDoubleClick={() => (id === 'me' ? undefined : onOpenLine(id))}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] ${
                  off ? 'border-border text-muted-foreground' : 'border-foreground text-foreground'}`}>
                {name || t('life.parallel.someone')}
              </button>
            );
          })}
        <Button size="sm" variant="outline" className="ml-1 gap-1.5 rounded-full" data-life-line-add
          onClick={onAddLine}>
          <UserPlus aria-hidden className="h-4 w-4" />
          {t('life.parallel.add')}
        </Button>
        <span className="ml-auto inline-flex overflow-hidden rounded-full border border-border">
          <button type="button" aria-label={t('place.zoomOut')} data-life-parallel-out
            className="grid h-8 w-8 place-items-center text-muted-foreground hover:bg-accent/20"
            onClick={() => zoom(-1)}>
            <Minus aria-hidden className="h-4 w-4" />
          </button>
          <button type="button" aria-label={t('place.zoomIn')} data-life-parallel-in
            className="grid h-8 w-8 place-items-center border-l border-border text-muted-foreground hover:bg-accent/20"
            onClick={() => zoom(1)}>
            <Plus aria-hidden className="h-4 w-4" />
          </button>
        </span>
      </div>

      {/* The chart: years down the left, a lane for each life beside them. */}
      <div ref={box} data-life-parallel-box
        className="relative max-h-[70dvh] overflow-auto rounded-xl border border-border bg-surface/40">
        <div className="relative flex" style={{ height: chart.height, minWidth: 60 + chart.lines.length * LANE }}>
          {/* The years themselves, once, for everyone. */}
          <div className="sticky left-0 z-10 w-[60px] shrink-0 bg-surface/80 backdrop-blur">
            {chart.ticks.map((tick) => (
              <span key={tick.year} data-life-parallel-year={tick.year}
                className={`absolute left-2 -translate-y-1/2 tabular-nums ${
                  tick.decade ? 'text-[12px] font-bold text-foreground' : 'text-[11px] text-muted-foreground'}`}
                style={{ top: tick.y }}>
                {tick.year}
              </span>
            ))}
          </div>

          {/* A faint rule across the decades, so the eye can cross the lanes. */}
          {chart.ticks.filter((tick) => tick.decade).map((tick) => (
            <span key={`r${tick.year}`} aria-hidden
              className="pointer-events-none absolute left-[60px] right-0 border-t border-border/60"
              style={{ top: tick.y }} />
          ))}
          <span aria-hidden data-life-parallel-today
            className="pointer-events-none absolute left-[60px] right-0 border-t border-primary/70"
            style={{ top: chart.today }} />

          {chart.lines.map((line) => (
            <Lane key={line.id} line={line} colors={colors} meLabel={meLabel}
              onOpenMoment={(m) => onOpenMoment(line.id, m)}
              onAdd={() => onAddMoment(line.id)} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** One life, down the page. */
function Lane({ line, colors, meLabel, onOpenMoment, onAdd }: {
  line: ParallelLine;
  colors: Record<LifeCategory, string>;
  meLabel: string;
  onOpenMoment: (m: Milestone) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  // The dots stay on their years; only the labels move apart.
  const labels = stackLabels(line.moments.map((m) => m.y), 18);
  return (
    <div data-life-lane={line.id} className="relative shrink-0" style={{ width: LANE }}>
      {/* The life itself: born here, still going there. */}
      <span aria-hidden className="absolute w-px bg-border" style={{ left: 18, top: line.from, height: Math.max(1, line.to - line.from) }} />
      {line.now !== null && (
        <span aria-hidden className="absolute w-[3px] rounded-full bg-foreground/45"
          style={{ left: 17, top: line.from, height: Math.max(1, line.now - line.from) }} />
      )}
      <span data-life-lane-name
        className="absolute left-0 -translate-y-full whitespace-nowrap pb-1 text-[12px] font-bold text-foreground"
        style={{ top: line.from }}>
        {line.name || (line.mine ? meLabel : t('life.parallel.someone'))}
      </span>
      <span className="absolute left-[26px] -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: line.from }}>
        {formatLifeDate(line.birthDate)}
      </span>

      {line.moments.map((moment, i) => {
        const Icon = CATEGORY_ICON[moment.milestone.category];
        const colour = colors[moment.milestone.category];
        return (
          <span key={moment.milestone.id}>
            <span aria-hidden className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border"
              style={{ left: 18, top: moment.y, borderColor: colour, background: colour }} />
            {/* A line from the dot to its label, when the label had to move. */}
            {Math.abs(labels[i] - moment.y) > 2 && (
              <span aria-hidden className="absolute border-t border-border"
                style={{ left: 20, top: moment.y, width: 8 }} />
            )}
            <button type="button" data-life-parallel-moment={moment.milestone.id}
              onClick={() => onOpenMoment(moment.milestone)}
              className="absolute left-[30px] flex max-w-[130px] -translate-y-1/2 items-center gap-1 rounded px-1 text-left text-[11px] leading-4 text-foreground hover:bg-accent/20"
              style={{ top: labels[i] }}>
              <Icon aria-hidden className="h-3 w-3 shrink-0" style={{ color: inkOf(colour) }} />
              <span className="truncate">{moment.milestone.title}</span>
            </button>
          </span>
        );
      })}

      {/* One way to add something to this particular life. */}
      <button type="button" data-life-lane-add={line.id} onClick={onAdd}
        className="absolute left-[10px] grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-dashed border-border text-muted-foreground hover:bg-accent/20"
        style={{ top: line.to }}
        aria-label={t('life.parallel.addMoment')}>
        <Plus aria-hidden className="h-3 w-3" />
      </button>
    </div>
  );
}

/** The one thing the chart cannot do for itself: say it is empty. */
export function ParallelEmpty({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <p className="flex items-center justify-center gap-2 py-6 text-[13px] text-muted-foreground">
      {t('life.parallel.none')}
      <Button size="sm" variant="outline" className="gap-1.5" data-life-line-add onClick={onAdd}>
        <UserPlus aria-hidden className="h-4 w-4" />
        {t('life.parallel.add')}
      </Button>
    </p>
  );
}
