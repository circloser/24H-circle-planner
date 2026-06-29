import type { TimeSlice } from '@/types/time-slice';
import { RING, slicePath, labelAnchorInside, truncateLabel, polarToCartesian } from '@/lib/svg-geometry';
import { angleForMin, FULL_SPEC } from '@/lib/chart-view';
import type { RecordItem, ActiveRecord } from '@/hooks/useRecords';

interface RecordRingProps {
  records: RecordItem[];
  active: ActiveRecord | null;
  nowMin: number; // current minute-of-day (for the now-line + live arc end)
}

/** Build a full TimeSlice so we can reuse the chart's arc/label geometry. */
function arcSlice(start: string, end: string, color: string): TimeSlice {
  return { id: '', label: '', startTime: start, endTime: end, color, icon: '', textPosition: 'inside' };
}

const HOUR_LABELS = [0, 6, 12, 18];
const minToHhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * 24h ring showing only the recorded blocks — unrecorded time is left empty
 * (a faint donut). A live recording is drawn as a dashed, semi-transparent arc
 * growing to the current time.
 */
export function RecordRing({ records, active, nowMin }: RecordRingProps) {
  const { cx, cy, innerR, outerR } = RING;
  const midR = (innerR + outerR) / 2;
  const nowHhmm = minToHhmm(nowMin % 1440);

  return (
    <svg viewBox="-36 -36 1072 1072" role="img" aria-label="record-ring" className="h-full w-full">
      {/* Empty 24h band. */}
      <circle cx={cx} cy={cy} r={midR} fill="none" stroke="hsl(var(--muted) / 0.25)" strokeWidth={outerR - innerR} />
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="hsl(var(--border))" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="hsl(var(--border))" strokeWidth={1.5} />

      {/* Recorded blocks. */}
      {records.map((r) => {
        const slice = arcSlice(r.start, r.end, r.color);
        const a = labelAnchorInside(slice);
        return (
          <g key={r.id}>
            <path d={slicePath(slice)} fill={r.color} stroke="hsl(var(--background))" strokeWidth={2} />
            <text
              x={a.x}
              y={a.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={26}
              fontWeight={600}
              fill="#1f2937"
              style={{ pointerEvents: 'none' }}
            >
              {truncateLabel(r.label, 6, 12)}
            </text>
          </g>
        );
      })}

      {/* Live (in-progress) arc. */}
      {active && active.start !== nowHhmm && (
        <path
          d={slicePath(arcSlice(active.start, nowHhmm, active.color))}
          fill={active.color}
          fillOpacity={0.45}
          stroke={active.color}
          strokeWidth={3}
          strokeDasharray="10 8"
        />
      )}

      {/* Hour anchors 0/6/12/18. */}
      {HOUR_LABELS.map((h) => {
        const p = polarToCartesian(cx, cy, outerR + 30, angleForMin(h * 60, FULL_SPEC));
        return (
          <text key={h} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={28} fontWeight={700} fill="hsl(var(--text-muted))">
            {h}
          </text>
        );
      })}

      {/* Now line. */}
      {(() => {
        const ang = angleForMin(nowMin % 1440, FULL_SPEC);
        const a = polarToCartesian(cx, cy, innerR, ang);
        const b = polarToCartesian(cx, cy, outerR, ang);
        return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#EF4444" strokeWidth={3} strokeLinecap="round" />;
      })()}
    </svg>
  );
}
