import { RING, slicePath } from '@/lib/svg-geometry';
import type { TimeSlice } from '@/types/time-slice';

/**
 * A tiny slices-only timetable thumbnail (no ticks/labels) for diary calendar
 * cells. Fills its container; renders the wedges in chart coordinates with a
 * small centre hole.
 */
export function MiniChart({ slices }: { slices: TimeSlice[] }) {
  return (
    <svg viewBox="0 0 1000 1000" width="100%" height="100%" aria-hidden="true" style={{ display: 'block' }}>
      {slices.map((s) => (
        <path key={s.id} d={slicePath(s)} fill={s.color || '#d1d5db'} />
      ))}
      <circle cx={RING.cx} cy={RING.cy} r={RING.innerR} fill="hsl(var(--surface))" />
    </svg>
  );
}
