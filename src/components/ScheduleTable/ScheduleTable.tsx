import { useEffect, useRef, useState } from 'react';
import { GripVertical, X, Plus } from 'lucide-react';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { useTranslation, useShowIcons, useShowNowLine, useNowLineStyle, useWorldClocks } from '@/hooks/usePreferences';
import { hhmmToMinutes, minutesToHhmm, sliceWidthMinutes, tzMinutes } from '@/lib/time-utils';

/** End-of-day is stored as "24:00"; show it as "00:00" in fields. */
const normTime = (hhmm: string) => (hhmm === '24:00' ? '00:00' : hhmm);

/** Inherit the (scaled) font from the table container — form controls don't by default. */
const INHERIT_FONT = { fontSize: 'inherit', fontFamily: 'inherit' } as const;

/**
 * A borderless 24h "HH:MM" time field. Locale-independent (unlike <input
 * type=time>). Commits on blur/Enter; reverts an invalid entry.
 */
function TimeCell({
  value,
  disabled,
  label,
  onCommit,
}: {
  value: string;
  disabled?: boolean;
  label: string;
  onCommit: (hhmm: string) => void;
}) {
  const display = normTime(value);
  const [text, setText] = useState(display);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(display);
  }, [display]);

  const commit = () => {
    const m = /^(\d{1,2}):?(\d{2})$/.exec(text.trim());
    if (m) {
      const h = Number(m[1]);
      const min = Number(m[2]);
      if (h >= 0 && h <= 24 && min >= 0 && min < 60 && !(h === 24 && min > 0)) {
        onCommit(`${String(h % 24).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
        return;
      }
    }
    setText(display); // invalid → revert
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      disabled={disabled}
      value={text}
      onFocus={(e) => { focused.current = true; e.currentTarget.select(); }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { focused.current = false; commit(); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') { setText(display); e.currentTarget.blur(); }
      }}
      className="w-[4em] rounded px-1 py-0.5 text-center tabular-nums outline-none transition-colors focus:bg-black/10 disabled:opacity-60"
      style={{ ...INHERIT_FONT, color: 'hsl(var(--text-muted))', background: 'transparent' }}
    />
  );
}

interface ScheduleTableProps {
  locked?: boolean;
  onEditLabel: (sliceId: string) => void;
  onAddRow: () => void;
}

/**
 * List/table view of the timetable — one row per slice (drag-handle · colour ·
 * start ~ end · label · delete). Editing a time moves the shared boundary;
 * dragging the handle reorders + restacks. Honours the font-scale preference,
 * and overlays horizontal time lines (current time + each world clock) at the
 * matching position inside the row.
 */
export function ScheduleTable({ locked = false, onEditLabel, onAddRow }: ScheduleTableProps) {
  const slices = useStoreSelector((s) => s.history.present.slices);
  const dispatch = useStoreDispatch();
  const { t } = useTranslation();
  const showIcons = useShowIcons();
  const showNowLine = useShowNowLine();
  const nowLineStyle = useNowLineStyle();
  const worldClocks = useWorldClocks();
  const len = slices.length;

  // Live tick so the time lines + current-row highlight track the clock.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Horizontal time-line markers: the current time + each configured world clock.
  const markers: Array<{ minute: number; color: string; text: string }> = [];
  if (showNowLine) markers.push({ minute: nowMin, color: nowLineStyle.color, text: minutesToHhmm(nowMin) });
  for (const wc of worldClocks) {
    const m = tzMinutes(wc.tz, now);
    if (m !== null) markers.push({ minute: m, color: wc.color, text: `${wc.label} ${minutesToHhmm(m)}` });
  }
  const lineW = Math.max(1.5, nowLineStyle.width);

  const resize = (boundaryIndex: number, hhmm: string) =>
    dispatch({ type: 'RESIZE_BOUNDARY', boundaryIndex, newHHmm: hhmm });

  // ── Drag-to-reorder (pointer-based; works on touch + mouse) ──────────────────
  const ulRef = useRef<HTMLUListElement>(null);
  const meas = useRef({ rowH: 44, top: 0 });
  const fromRef = useRef(-1);
  const overRef = useRef(-1);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);

  const startReorder = (i: number, e: React.PointerEvent) => {
    if (locked || len < 2) return;
    const ul = ulRef.current;
    if (!ul) return;
    const rows = Array.from(ul.children) as HTMLElement[];
    meas.current = { rowH: rows[i]?.offsetHeight || 44, top: ul.getBoundingClientRect().top };
    fromRef.current = i;
    overRef.current = i;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: i, over: i });
  };
  const moveReorder = (e: React.PointerEvent) => {
    if (fromRef.current < 0) return;
    const { rowH, top } = meas.current;
    let over = Math.floor((e.clientY - top) / rowH);
    over = Math.max(0, Math.min(len - 1, over));
    if (over !== overRef.current) { overRef.current = over; setDrag({ from: fromRef.current, over }); }
  };
  const endReorder = (e: React.PointerEvent) => {
    if (fromRef.current < 0) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    const from = fromRef.current;
    const over = overRef.current;
    fromRef.current = -1;
    overRef.current = -1;
    setDrag(null);
    if (over !== from) dispatch({ type: 'REORDER_SLICES', from, to: over });
  };

  return (
    <div className="w-full max-w-[560px]" style={{ fontSize: 'calc(var(--app-font-scale, 1) * 0.875rem)' }}>
      <ul ref={ulRef} className="flex flex-col" style={{ borderTop: '1px solid hsl(var(--border))' }}>
        {slices.map((s, i) => {
          const sStart = hhmmToMinutes(s.startTime);
          const w = sliceWidthMinutes(s);
          const rel = (nowMin - sStart + 1440) % 1440;
          const isNow = rel < w;
          const dragging = drag?.from === i;
          const isOver = drag && drag.over === i && drag.from !== i;
          // Which time lines fall inside this row, and at what fraction of it.
          const rowMarks = markers
            .map((mk) => ({ ...mk, frac: w > 0 ? ((mk.minute - sStart + 1440) % 1440) / w : 0, inRow: ((mk.minute - sStart + 1440) % 1440) < w }))
            .filter((mk) => mk.inRow);
          return (
            <li
              key={s.id}
              className="relative flex items-center gap-1.5 py-2 pr-1"
              style={{
                borderBottom: '1px solid hsl(var(--border))',
                borderTop: isOver ? '2px solid hsl(var(--primary))' : '2px solid transparent',
                opacity: dragging ? 0.4 : 1,
                backgroundColor: isNow && !drag ? 'hsl(var(--text-muted) / 0.10)' : 'transparent',
                touchAction: 'pan-y',
              }}
            >
              {/* Horizontal time lines (current time + world clocks). */}
              {!drag && rowMarks.map((mk, k) => (
                <div
                  key={`mk${k}`}
                  aria-hidden
                  style={{ position: 'absolute', left: 0, right: 0, top: `${mk.frac * 100}%`, transform: 'translateY(-50%)', borderTop: `${lineW}px solid ${mk.color}`, pointerEvents: 'none', zIndex: 4 }}
                >
                  <span
                    style={{ position: 'absolute', right: '2.2rem', top: '50%', transform: 'translateY(-50%)', backgroundColor: mk.color, color: '#fff', borderRadius: '0.4em', padding: '0 0.4em', fontSize: '0.62em', fontWeight: 700, lineHeight: 1.6, whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }}
                  >
                    {mk.text}
                  </span>
                </div>
              ))}

              <button
                type="button"
                aria-label={t('table.reorder')}
                disabled={locked || len < 2}
                onPointerDown={(e) => startReorder(i, e)}
                onPointerMove={moveReorder}
                onPointerUp={endReorder}
                className="grid h-7 w-5 shrink-0 cursor-grab place-items-center rounded touch-none active:cursor-grabbing disabled:cursor-default disabled:opacity-30"
                style={{ color: 'hsl(var(--text-muted))' }}
              >
                <GripVertical className="h-4 w-4" />
              </button>

              <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <div className="flex shrink-0 items-center gap-0.5">
                <TimeCell value={s.startTime} disabled={locked} label={t('block.start')} onCommit={(hhmm) => resize((i - 1 + len) % len, hhmm)} />
                <span style={{ color: 'hsl(var(--text-muted) / 0.7)' }}>~</span>
                <TimeCell value={s.endTime} disabled={locked} label={t('block.end')} onCommit={(hhmm) => resize(i, hhmm)} />
              </div>

              <button
                type="button"
                onClick={() => onEditLabel(s.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-2 py-1 text-left transition-colors hover:bg-black/5"
                style={{ ...INHERIT_FONT, color: 'hsl(var(--foreground))' }}
              >
                {showIcons && s.icon && <span aria-hidden className="shrink-0">{s.icon}</span>}
                <span className="truncate">{s.label.trim() || t('analytics.untitled')}</span>
              </button>

              <button
                type="button"
                aria-label={t('diary.delete')}
                title={t('diary.delete')}
                disabled={locked || len <= 1}
                onClick={() => dispatch({ type: 'DELETE_SLICE', id: s.id })}
                className="grid h-7 w-7 shrink-0 place-items-center rounded transition-colors hover:bg-black/10 disabled:opacity-30"
                style={{ color: 'hsl(var(--text-muted))' }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Add a row (opens the start/end time form) */}
      <button
        type="button"
        onClick={onAddRow}
        disabled={locked}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-colors disabled:opacity-50"
        style={{ ...INHERIT_FONT, border: '1px dashed hsl(var(--border))', color: 'hsl(var(--text-muted))' }}
      >
        <Plus className="h-4 w-4" /> {t('block.add')}
      </button>
    </div>
  );
}
