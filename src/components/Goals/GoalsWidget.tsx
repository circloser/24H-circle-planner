import { useState, useEffect } from 'react';
import { Target, X, Check } from 'lucide-react';
import { useDiary } from '@/hooks/useDiary';
import { useGoals } from '@/hooks/useGoals';
import { useTranslation } from '@/hooks/usePreferences';
import { accumulatedMinutes } from '@/lib/goals';
import { makeDragStart, anchoredStyle, spawnNearCentre, migrateLegacyPos, clampOffset, loadPosProfile, savePosProfile, type Pos } from '@/components/ClockTools/clock-utils';
import { GOALS_WIDGET_SYNC_EVENT } from '@/lib/sync/widgetSync';

const POS_KEY = '24h-circle-planner.goalswidget';
const CARD_W = 300;

/** Default spot: floating near the chart (lower-right), on-screen at any size. */
function defaultPos(): Pos {
  return spawnNearCentre(40, 120, CARD_W, 300);
}

function loadPos(): Pos {
  // A position saved on THIS screen size wins (per-resolution layout memory).
  const prof = loadPosProfile(POS_KEY);
  if (prof) return clampOffset(prof, CARD_W, 300);
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Pos> & { c?: number };
      if (p && typeof p.x === 'number' && typeof p.y === 'number') {
        // `c:1` marks centre-offset space (current); unmarked values are legacy
        // absolute pixels → re-express as offsets (same rendered spot). Always
        // clamp on-screen — an off-screen card can't even be dragged back.
        return clampOffset(p.c === 1 ? { x: p.x, y: p.y } : migrateLegacyPos({ x: p.x, y: p.y }), CARD_W, 300);
      }
    }
  } catch {
    // ignore corrupt/unavailable storage
  }
  return defaultPos();
}

/**
 * Bottom-right floating goals viewer (next to the memo FAB). Appears only once
 * goals exist; the FAB toggles a small card showing each goal's live progress
 * (accumulated vs target). The card floats with a TRANSPARENT background and can
 * be dragged anywhere (grab cursor on hover); its position persists.
 */
export function GoalsWidget({ onSetup }: { onSetup: () => void }) {
  const { goals } = useGoals();
  const { entries } = useDiary();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>(loadPos);
  // Boundary only appears on hover — transparent + frameless at rest, but framed
  // like the clock/calendar widgets while pointed at (a consistent "movable" cue).
  const [hover, setHover] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(POS_KEY, JSON.stringify({ x: pos.x, y: pos.y, c: 1 }));
    } catch {
      // storage unavailable — position simply won't persist
    }
    savePosProfile(POS_KEY, pos); // remember per screen size too
  }, [pos]);

  // Cloud sync applied a new position to localStorage (no reload) — adopt it live.
  // loadPos clamps to this viewport, so the card can't land off-screen.
  useEffect(() => {
    const onSync = () => setPos(loadPos());
    window.addEventListener(GOALS_WIDGET_SYNC_EVENT, onSync);
    return () => window.removeEventListener(GOALS_WIDGET_SYNC_EVENT, onSync);
  }, []);

  const fmt = (m: number) => t('goals.hm', { h: String(Math.floor(m / 60)), m: String(m % 60) });

  return (
    <>
      {open && goals.length > 0 && (
        <div
          data-goals-card="1"
          data-hover={hover ? '1' : '0'}
          onPointerDown={makeDragStart(pos, setPos)}
          onPointerMove={() => { if (!hover) setHover(true); }}
          onPointerLeave={() => setHover(false)}
          className="absolute z-30 max-h-[60vh] w-[300px] cursor-grab touch-none overflow-y-auto rounded-xl p-3 transition-shadow active:cursor-grabbing"
          style={{
            ...anchoredStyle(pos.x, pos.y),
            // Transparent at rest; on hover reveal the same boundary as the
            // clock/calendar floating cards (1px border + shadow) and lift the
            // surface slightly so the whole card brightens under the pointer.
            backgroundColor: hover ? 'hsl(var(--surface) / 0.6)' : 'transparent',
            border: `1px solid ${hover ? 'hsl(var(--border))' : 'transparent'}`,
            boxShadow: hover ? '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' : 'none',
            transition: 'background-color 120ms ease',
          }}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <Target className="h-4 w-4 text-foreground" />
            <span className="flex-1 text-sm font-semibold text-foreground">{t('goals.title')}</span>
            <button
              type="button"
              data-no-drag
              aria-label={t('common.cancel')}
              onClick={() => setOpen(false)}
              className="grid h-6 w-6 place-items-center rounded transition-[background-color,opacity] hover:bg-black/10"
              style={{ opacity: hover ? 1 : 0, pointerEvents: hover ? 'auto' : 'none' }}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <ul className="flex flex-col gap-2.5">
            {goals.map((g) => {
              const acc = accumulatedMinutes(g.label, g.period, entries);
              const pct = g.targetMinutes > 0 ? Math.min(100, Math.round((acc / g.targetMinutes) * 100)) : 0;
              const done = acc >= g.targetMinutes;
              return (
                <li key={g.id}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {g.label || t('goals.untitled')}
                    </span>
                    <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] bg-muted/40 text-muted-foreground">
                      {g.period === 'day' ? t('goals.periodDay') : t('goals.periodWeek')}
                    </span>
                    {done && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: '#16a34a' }} />}
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted/35">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: done ? '#16a34a' : 'hsl(var(--primary))' }} />
                  </div>
                  <div className="mt-0.5 text-right text-[11px] tabular-nums text-muted-foreground">
                    {fmt(acc)} / {fmt(g.targetMinutes)} · {pct}%
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => { if (goals.length === 0) onSetup(); else setOpen((v) => !v); }}
        aria-label={t('goals.open')}
        aria-expanded={open}
        title={t('goals.open')}
        className="absolute bottom-5 right-[74px] z-30 grid h-12 w-12 place-items-center rounded-full shadow-lg transition-transform hover:scale-105 bg-surface text-muted-foreground border border-border"
      >
        <Target className="h-5 w-5" />
      </button>
    </>
  );
}
