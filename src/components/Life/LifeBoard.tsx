import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Minus, Plus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useTranslation } from '@/hooks/usePreferences';
import { buildTimeline, type LifeCategory, type LifeData, type Milestone } from '@/lib/life';
import {
  MAX_BOARD_ZOOM, MIN_BOARD_ZOOM, PHONE_LINES, PHONE_ZOOM, boardLines, boardSpan, boardZoom,
} from '@/lib/life-lines';
import { trackFeature } from '@/lib/track';
import type { MilestoneDraft } from '@/hooks/useLife';
import { LifeTimeline } from './LifeTimeline';

export interface LifeBoardProps {
  life: LifeData;
  colors: Record<LifeCategory, string>;
  today: string;
  /** The category filter, applied to every line alike. */
  only: ReadonlySet<LifeCategory>;
  meLabel: string;
  readOnly?: boolean;
  /** Who is folded away for now (wide screens). */
  hidden: ReadonlySet<string>;
  /** Which one other line a phone is showing beside mine. */
  chosen: string | null;
  onChoose: (id: string) => void;
  onToggle: (id: string) => void;
  onAddLine: () => void;
  onOpenLine: (id: string) => void;
  /** The order to draw them in, left to right (mine is always first). */
  onReorder: (ids: readonly string[]) => void;
  /** 다꾸 belongs to my own line: its rows are keyed by my own moments. */
  rowDecor?: (row: string) => ReactNode;
  decorating?: boolean;
  onOpenMoment: (lineId: string, m: Milestone) => void;
  onOpenBirth: (lineId: string) => void;
  onAdd: (lineId: string, preset: Partial<MilestoneDraft>) => void;
}

/**
 * The life page: my line, and beside it the lives it was lived among.
 *
 * Every column is the same drawing — the same line, the same cards, the same
 * hollow markers — because a life beside another life should look like a life,
 * not like a lane on a chart. Mine is always the first.
 *
 * A wide screen takes as many as have been added and zooms out to hold them;
 * a phone has room for two, so it shows mine and whichever one is asked for.
 */
export function LifeBoard({
  life, colors, today, only, meLabel, readOnly, hidden, chosen,
  onChoose, onToggle, onAddLine, onOpenLine, onReorder, rowDecor, decorating,
  onOpenMoment, onOpenBirth, onAdd,
}: LifeBoardProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const lines = useMemo(
    () => boardLines(life, { hidden, chosen, ...(isMobile ? { max: PHONE_LINES } : {}) }),
    [life, hidden, chosen, isMobile],
  );
  // How far out the board is drawn. It starts wherever the number of lines
  // says, and stays wherever it is put. A phone is not given the choice: two
  // lines on a narrow screen only fit at one size, so it is simply used.
  const [zoom, setZoom] = useState<number | null>(null);
  const scale = isMobile
    ? (lines.length > 1 ? PHONE_ZOOM : 1)
    : (zoom ?? boardZoom(lines.length));
  const step = (by: number) => {
    trackFeature('life_zoom');
    setZoom((z) => {
      const now = z ?? boardZoom(lines.length);
      return Math.max(MIN_BOARD_ZOOM, Math.min(MAX_BOARD_ZOOM, now * (by > 0 ? 1.25 : 1 / 1.25)));
    });
  };

  const all = life.others ?? [];
  const showing = new Set(lines.map((l) => l.id));

  /**
   * Whose line goes where: a name is dragged along the row and the columns
   * follow it. Mine stays first — this is my page — so it is the others that
   * are put in order, and the order is kept in the record rather than in the
   * screen, because it is a way of reading that is worth keeping.
   *
   * Alt with an arrow does the same thing from the keyboard, which is the only
   * way to do it without a mouse and the only way that works on a phone.
   */
  const [dragging, setDragging] = useState<string | null>(null);
  const moveTo = (id: string, at: number) => {
    const ids = all.map((o) => o.id);
    const from = ids.indexOf(id);
    const to = Math.max(0, Math.min(ids.length - 1, at));
    if (from < 0 || from === to) return;
    ids.splice(to, 0, ...ids.splice(from, 1));
    onReorder(ids);
  };
  const dropOn = (id: string, onto: string) => {
    if (id === onto) return;
    moveTo(id, all.findIndex((o) => o.id === onto));
  };
  // One run of years for every column, so the same year is the same place on
  // each of them — which is what reading two lives side by side is for.
  const span = useMemo(() => boardSpan(lines, today), [lines, today]);

  /**
   * And then the years are made to meet.
   *
   * Each column is its own flow of cards, so a decade that is busy on one line
   * and empty on another would drift apart down the page. Every decade row is
   * therefore pushed down to the lowest of its fellows, in order, using its own
   * padding — padding rather than a margin, because the line is drawn over the
   * row and a gap between rows would break it.
   */
  const board = useRef<HTMLDivElement>(null);
  const aligning = useRef(false);
  useLayoutEffect(() => {
    const el = board.current;
    if (!el) return;
    const align = () => {
      const cols = [...el.querySelectorAll<HTMLElement>('[data-life-column]')];
      const all = cols.map((c) => [...c.querySelectorAll<HTMLElement>('li[data-life-at]')]);
      for (const list of all) {
        for (const row of list) {
          row.style.paddingTop = '';
          row.style.removeProperty('--life-pad');
        }
      }
      if (cols.length < 2) return;
      /**
       * Where the mark on a row sits, in the screen's pixels.
       *
       * Measured from the row rather than from the mark itself, because a card
       * that has not been scrolled to yet is still sixteen pixels down from
       * where it will come to rest. The row's own padding is part of it: that
       * is the thing this loop writes.
       */
      const markOf = (row: HTMLElement) => {
        const pad = parseFloat(getComputedStyle(row).paddingTop) || 0;
        const own = Number(row.dataset.lifeAnchor ?? 0);
        return row.getBoundingClientRect().top + (pad + own) * scale;
      };
      // One row per day per column — the first, where a day is written twice.
      const days = all.map((list) => {
        const map = new Map<string, HTMLElement>();
        for (const row of list) {
          const key = row.dataset.lifeAt;
          if (key && !map.has(key)) map.set(key, row);
        }
        return map;
      });
      const keys = [...new Set(days.flatMap((map) => [...map.keys()]))]
        .sort((a, b) => parseFloat(a) - parseFloat(b));
      // Earliest first, pushing down only: a day two lines share is dropped to
      // the lower of the two, and everything after it comes with it.
      for (const key of keys) {
        const here = days.map((map) => map.get(key)).filter((row): row is HTMLElement => !!row);
        if (here.length < 2) continue;
        const marks = here.map(markOf);
        const lowest = Math.max(...marks);
        here.forEach((row, i) => {
          const gap = lowest - marks[i];
          if (gap <= 0.5) return;
          const pad = parseFloat(getComputedStyle(row).paddingTop) || 0;
          // A rectangle is measured in the screen's pixels and padding is
          // written in the board's own, which the zoom makes different sizes.
          const grown = pad + gap / scale;
          row.style.paddingTop = `${grown}px`;
          // Today's row draws a line that changes from solid to dashed at its
          // own dot, and the dot is below whatever padding it is given.
          row.style.setProperty('--life-pad', `${grown}px`);
        });
      }
    };
    const run = () => {
      if (aligning.current) return;
      aligning.current = true;
      requestAnimationFrame(() => {
        align();
        aligning.current = false;
      });
    };
    align();
    // Cards grow as pictures arrive and as the window changes width.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(run);
    ro?.observe(el);
    window.addEventListener('resize', run);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', run);
    };
  }, [lines, scale, only, today]);

  return (
    <>
      {/* Who is on the page — and, when there are several, how far out. */}
      {!readOnly && (
        <div data-life-lines className="mx-auto mt-8 flex max-w-[960px] flex-wrap items-center justify-center gap-1.5 px-4">
          <span className="text-[13px] text-muted-foreground">{t('life.parallel.who')}</span>
          {[{ id: 'me', name: life.profile.name || meLabel }, ...all.map((o) => ({ id: o.id, name: o.name }))]
            .map(({ id, name }) => {
              const on = showing.has(id);
              const mine = id === 'me';
              return (
                <button key={id} type="button" data-life-line-toggle={id} aria-pressed={on}
                  draggable={!mine}
                  onDragStart={(e) => {
                    setDragging(id);
                    e.dataTransfer.effectAllowed = 'move';
                    // Firefox starts no drag at all without something to carry.
                    e.dataTransfer.setData('text/plain', id);
                  }}
                  onDragOver={(e) => { if (!mine && dragging && dragging !== id) e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = dragging ?? e.dataTransfer.getData('text/plain');
                    if (from && !mine) dropOn(from, id);
                    setDragging(null);
                  }}
                  onDragEnd={() => setDragging(null)}
                  onKeyDown={(e) => {
                    if (mine || !e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
                    e.preventDefault();
                    moveTo(id, all.findIndex((o) => o.id === id) + (e.key === 'ArrowLeft' ? -1 : 1));
                  }}
                  onClick={() => (mine ? undefined : isMobile ? onChoose(id) : onToggle(id))}
                  onDoubleClick={() => (mine ? undefined : onOpenLine(id))}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] ${
                    mine ? '' : 'cursor-grab active:cursor-grabbing'} ${
                    dragging === id ? 'opacity-50' : ''} ${
                    on ? 'border-foreground text-foreground' : 'border-border text-muted-foreground'}`}>
                  {name || t('life.parallel.someone')}
                </button>
              );
            })}
          <Button size="sm" variant="outline" className="ml-1 gap-1.5 rounded-full" data-life-line-add
            onClick={onAddLine}>
            <UserPlus aria-hidden className="h-4 w-4" />
            {t('life.parallel.add')}
          </Button>
          {!isMobile && lines.length > 1 && (
            <span className="ml-1 inline-flex overflow-hidden rounded-full border border-border" data-life-board-zoom={scale.toFixed(2)}>
              <button type="button" aria-label={t('place.zoomOut')} data-life-board-out
                className="grid h-8 w-8 place-items-center text-muted-foreground hover:bg-accent/20"
                onClick={() => step(-1)}>
                <Minus aria-hidden className="h-4 w-4" />
              </button>
              <button type="button" aria-label={t('place.zoomIn')} data-life-board-in
                className="grid h-8 w-8 place-items-center border-l border-border text-muted-foreground hover:bg-accent/20"
                onClick={() => step(1)}>
                <Plus aria-hidden className="h-4 w-4" />
              </button>
            </span>
          )}
        </div>
      )}

      {/*
        The board itself. `zoom` rather than a transform because a transform
        leaves the page the size it was and this has to take the room it
        actually needs; the sticky year is given back what the zoom takes off
        it, so it still comes to rest under the header.
      */}
      <div ref={board} data-life-board data-life-board-lines={lines.length}
        className="flex w-full items-start gap-3 min-[900px]:gap-6"
        style={scale === 1 ? undefined : { zoom: scale }}>
        {lines.map((line) => (
          <div key={line.id} data-life-column={line.id} className="min-w-0 flex-1">
            <LifeTimeline
              life={line.life}
              items={buildTimeline(line.life, { today, only, ...(lines.length > 1 ? span : {}) })}
              colors={colors}
              readOnly={readOnly}
              {...(line.mine && rowDecor ? { rowDecor } : {})}
              decorating={decorating}
              onOpenMoment={(m) => onOpenMoment(line.id, m)}
              onOpenBirth={() => onOpenBirth(line.id)}
              onAdd={(preset) => onAdd(line.id, preset)} />
          </div>
        ))}
      </div>
    </>
  );
}
