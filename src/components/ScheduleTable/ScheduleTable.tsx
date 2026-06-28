import { useEffect, useRef, useState } from 'react';
import { useStoreSelector, useStoreDispatch } from '@/hooks/useScheduleStore';
import { useTranslation } from '@/hooks/usePreferences';
import { hhmmToMinutes, sliceWidthMinutes } from '@/lib/time-utils';

/** End-of-day is stored as "24:00"; show it as "00:00" in fields. */
const normTime = (hhmm: string) => (hhmm === '24:00' ? '00:00' : hhmm);

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
  // Re-sync from the store when the value changes externally (e.g. a neighbour
  // edit moved this shared boundary) — but never while the user is typing.
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
      className="w-[3.4rem] rounded px-1 py-0.5 text-center text-sm tabular-nums outline-none transition-colors focus:bg-black/10 disabled:opacity-60"
      style={{ color: 'hsl(var(--text-muted))', background: 'transparent' }}
    />
  );
}

interface ScheduleTableProps {
  locked?: boolean;
  onEditLabel: (sliceId: string) => void;
}

/**
 * List/table view of the timetable — one row per slice (colour · start ~ end ·
 * label) as an alternative to the circular chart. Editing a start or end time
 * moves the SHARED boundary, so the touching neighbour follows automatically
 * (RESIZE_BOUNDARY — exactly like dragging on the ring). The store array is in
 * chronological ring order, so row i's end is boundary i and row i's start is
 * boundary (i-1). Tapping a label opens the slice editor.
 */
export function ScheduleTable({ locked = false, onEditLabel }: ScheduleTableProps) {
  const slices = useStoreSelector((s) => s.history.present.slices);
  const dispatch = useStoreDispatch();
  const { t } = useTranslation();
  const len = slices.length;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const resize = (boundaryIndex: number, hhmm: string) => {
    dispatch({ type: 'RESIZE_BOUNDARY', boundaryIndex, newHHmm: hhmm });
  };

  return (
    <div className="w-full max-w-[560px]">
      <ul className="flex flex-col" style={{ borderTop: '1px solid hsl(var(--border))' }}>
        {slices.map((s, i) => {
          const isNow = ((nowMin - hhmmToMinutes(s.startTime) + 1440) % 1440) < sliceWidthMinutes(s);
          return (
            <li
              key={s.id}
              className="flex items-center gap-2 py-2 pl-1 pr-1"
              style={{
                borderBottom: '1px solid hsl(var(--border))',
                backgroundColor: isNow ? 'hsl(var(--text-muted) / 0.10)' : 'transparent',
              }}
            >
              <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <div className="flex shrink-0 items-center gap-0.5">
                <TimeCell value={s.startTime} disabled={locked} label={t('block.start')} onCommit={(hhmm) => resize((i - 1 + len) % len, hhmm)} />
                <span className="text-sm" style={{ color: 'hsl(var(--text-muted) / 0.7)' }}>~</span>
                <TimeCell value={s.endTime} disabled={locked} label={t('block.end')} onCommit={(hhmm) => resize(i, hhmm)} />
              </div>
              <button
                type="button"
                onClick={() => onEditLabel(s.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-2 py-1 text-left text-sm transition-colors hover:bg-black/5"
                style={{ color: 'hsl(var(--foreground))' }}
              >
                {s.icon && <span aria-hidden className="shrink-0">{s.icon}</span>}
                <span className="truncate">{s.label.trim() || t('analytics.untitled')}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
