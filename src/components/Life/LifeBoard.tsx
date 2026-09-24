import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Minus, Plus, UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
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
  onToggle: (id: string) => void;
  onAddLine: () => void;
  onOpenLine: (id: string) => void;
  /** Take that line off the page altogether (it can be taken back). */
  onRemoveLine: (id: string) => void;
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
  life, colors, today, only, meLabel, readOnly, hidden,
  onToggle, onAddLine, onOpenLine, onRemoveLine, onReorder, rowDecor, decorating,
  onOpenMoment, onOpenBirth, onAdd,
}: LifeBoardProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  // With a mouse the cross waits to be hovered; a finger has no hover, so on
  // a touch screen it is simply there.
  const coarse = useCoarsePointer();
  /** Who is being let go, while the question is on screen. */
  const [dropping, setDropping] = useState<{ id: string; name: string } | null>(null);
  /**
   * Who is drawn. A wide screen holds everyone who has not been folded away;
   * a phone holds two, and the two it holds are the first two of that same
   * list — so the leftmost pair on the desk is the pair in the pocket.
   */
  const lines = useMemo(
    () => boardLines(life, { hidden, ...(isMobile ? { max: PHONE_LINES } : {}) }),
    [life, hidden, isMobile],
  );
  /**
   * How far out the board is drawn: from how much room there is and how many
   * lines have to share it, not from the number of lines alone. It starts
   * there and stays wherever it is put. A phone is not given the choice —
   * two lines on a narrow screen only fit at one size.
   */
  const [zoom, setZoom] = useState<number | null>(null);
  const [room, setRoom] = useState(0);
  const scale = isMobile
    ? (lines.length > 1 ? PHONE_ZOOM : 1)
    : (zoom ?? boardZoom(lines.length, room));
  const step = (by: number) => {
    trackFeature('life_zoom');
    setZoom((z) => {
      const now = z ?? boardZoom(lines.length, room);
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
  /**
   * Whose line is whose, once the names at the top have scrolled away.
   *
   * With several lives side by side, a reader halfway down the page is
   * looking at four lines and no names. So each line carries its owner's name
   * on it, held just under the header as the page scrolls — where the year
   * used to ride — and only once the row of names above has gone out of
   * sight, because until then that row already says it.
   */
  const [headerH, setHeaderH] = useState(56);
  const [tagged, setTagged] = useState(false);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('[data-app-header]');
    const measure = () => { if (header) setHeaderH(header.getBoundingClientRect().height); };
    measure();
    const ro = header && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (header) ro?.observe(header);
    const check = () => {
      const top = frame.current?.getBoundingClientRect().top;
      const next = top !== undefined && top < (header?.getBoundingClientRect().height ?? 56) + 12;
      setTagged((was) => (was === next ? was : next));
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      ro?.disconnect();
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

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
  const frame = useRef<HTMLDivElement>(null);
  const aligning = useRef(false);
  /** Whether the page has already been put where it opens. */
  const landed = useRef(false);
  /**
   * How much room there is, in the screen's own pixels.
   *
   * Measured on the box AROUND the board, for two reasons: the board's own
   * pixels are what the zoom changes, so working the zoom out from them would
   * be a zoom measuring itself; and a ResizeObserver put on an element with
   * `zoom` is never called at all, so the board cannot watch itself either.
   */
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => setRoom(Math.round(el.getBoundingClientRect().width));
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
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
    // With the years lined up, today can be put where it should have been all
    // along: the middle of the screen. Once, on the way in — after that the
    // page is the reader's to scroll.
    if (!landed.current) {
      landed.current = true;
      requestAnimationFrame(() => {
        const today = el.querySelector('[data-life-column="me"] [data-life-today]')
          ?? el.querySelector('[data-life-today]');
        today?.scrollIntoView({ block: 'center' });
      });
    }
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
                // A name, with the way to let that line go tucked into its
                // corner: two buttons rather than one with a cross inside it,
                // because a button inside a button is not a thing.
                <span key={id} className="group relative inline-flex">
                <button type="button" data-life-line-toggle={id} aria-pressed={on}
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
                  onClick={() => {
                    if (mine) return;
                    // On a phone, choosing somebody is choosing them INSTEAD:
                    // they come to the front of the line, which is the same
                    // move as dragging their name to the left on a wide
                    // screen — so both screens agree on who is where.
                    // And choosing the one already beside me again lets them
                    // go, as the same tap does on a wide screen.
                    if (isMobile) {
                      if (on) { onToggle(id); return; }
                      if (hidden.has(id)) onToggle(id);
                      moveTo(id, 0);
                    } else {
                      onToggle(id);
                    }
                  }}
                  onDoubleClick={() => (mine ? undefined : onOpenLine(id))}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] ${
                    on ? 'border-foreground text-foreground' : 'border-border text-muted-foreground'} ${
                    mine ? '' : 'cursor-grab active:cursor-grabbing'} ${
                    dragging === id ? 'opacity-50' : ''}`}>
                  {name || t('life.parallel.someone')}
                </button>
                {!mine && (
                  <button type="button" data-life-line-remove={id}
                    aria-label={`${name || t('life.parallel.someone')} · ${t('common.delete')}`}
                    title={t('life.parallel.remove')}
                    className={`absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-border bg-surface text-muted-foreground shadow-sm transition-opacity hover:border-destructive hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 ${
                      coarse ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setDropping({ id, name: name || t('life.parallel.someone') })}>
                    <X aria-hidden className="h-2.5 w-2.5" />
                  </button>
                )}
                </span>
              );
            })}
          <Button size="sm" variant="outline" className="ml-1 gap-1.5 rounded-full" data-life-line-add
            onClick={onAddLine}>
            <UserPlus aria-hidden className="h-4 w-4" />
            {t('life.parallel.add')}
          </Button>
          {!isMobile && (
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

      {/* Letting a line go is asked about first: it takes the person and
          everything written on their line with it, and the toast that offers
          it back does not last for ever. */}
      <Dialog open={!!dropping} onOpenChange={(open) => { if (!open) setDropping(null); }}>
        <DialogContent className="max-w-sm" data-life-line-drop>
          <DialogHeader>
            <DialogTitle>{t('life.parallel.remove')}</DialogTitle>
            <DialogDescription>
              {t('life.parallel.removeAsk', { name: dropping?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDropping(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" data-life-line-drop-yes
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (dropping) onRemoveLine(dropping.id);
                setDropping(null);
              }}>
              {t('common.delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/*
        The board itself. `zoom` rather than a transform because a transform
        leaves the page the size it was and this has to take the room it
        actually needs; the sticky name on each line is given back what the
        zoom takes off it, so it still comes to rest under the header.
      */}
      <div ref={frame} className="w-full">
      <div ref={board} data-life-board data-life-board-lines={lines.length}
        className="flex w-full items-start gap-3 min-[900px]:gap-8"
        style={scale === 1 ? undefined : { zoom: scale }}>
        {lines.map((line) => (
          <div key={line.id} data-life-column={line.id} className="min-w-0 flex-1">
            {/* The owner's name, riding on the line under the header. The
                board is drawn at its own zoom, so the distance is given back
                what the zoom takes off it. */}
            {lines.length > 1 && (
              <div aria-hidden className="pointer-events-none sticky z-20 h-0"
                style={{ top: (headerH + 8) / scale }}>
                <span data-life-name-tag={line.id} data-shown={tagged || undefined}
                  className={`life-serif absolute max-w-[40vw] truncate rounded-full bg-foreground px-3 py-0.5 text-sm font-bold text-background shadow-sm transition-opacity duration-200 ${
                    // On a phone the line hugs the left edge, and a name
                    // centred on it would hang off the screen: it starts there.
                    isMobile ? 'left-[6px]' : '-translate-x-1/2 left-[28px] min-[900px]:left-1/2'} ${
                    tagged ? 'opacity-100' : 'opacity-0'}`}>
                  {line.mine ? (life.profile.name || meLabel) : (line.name || t('life.parallel.someone'))}
                </span>
              </div>
            )}
            <LifeTimeline
              narrow={isMobile && lines.length > 1}
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
      </div>
    </>
  );
}
