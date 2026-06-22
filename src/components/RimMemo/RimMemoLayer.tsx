import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import { useRimMemos, type RimMemo } from './useRimMemos';
import { useTranslation } from '@/hooks/usePreferences';

// Must mirror the chart's geometry (CircleTimeline).
const CX = 500;
const CY = 500;
const OUTER_R = 460;
const VB_MARGIN = 36;
const VB_SIZE = 1072; // 1000 + 2*36
const BAND_OUTER = OUTER_R + 58; // hover-capture ring (just outside the slices)
const ELBOW_R = OUTER_R + 60; // where the leader ends and the memo begins

const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
};
const pctX = (x: number) => ((x + VB_MARGIN) / VB_SIZE) * 100;
const pctY = (y: number) => ((y + VB_MARGIN) / VB_SIZE) * 100;

function annulusPath(ro: number, ri: number): string {
  const f = (n: number) => n.toFixed(2);
  return [
    `M ${f(CX)} ${f(CY - ro)}`,
    `A ${ro} ${ro} 0 1 1 ${f(CX)} ${f(CY + ro)}`,
    `A ${ro} ${ro} 0 1 1 ${f(CX)} ${f(CY - ro)}`,
    `M ${f(CX)} ${f(CY - ri)}`,
    `A ${ri} ${ri} 0 1 0 ${f(CX)} ${f(CY + ri)}`,
    `A ${ri} ${ri} 0 1 0 ${f(CX)} ${f(CY - ri)}`,
    'Z',
  ].join(' ');
}

// ─── A single transparent, editable rim memo ──────────────────────────────────

function RimMemoBox({
  memo,
  autoFocus,
  onChange,
  onDelete,
}: {
  memo: RimMemo;
  autoFocus: boolean;
  onChange: (text: string) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const right = Math.cos((memo.angleDeg * Math.PI) / 180) >= 0;
  const elbow = polar(ELBOW_R, memo.angleDeg);
  const leftPct = pctX(elbow.x);
  const topPct = pctY(elbow.y);

  // Position outside the chart: right-half memos grow rightward, left-half leftward.
  const style: CSSProperties = {
    position: 'absolute',
    top: `${topPct}%`,
    transform: 'translateY(-50%)',
    width: 150,
    zIndex: 24,
    textAlign: right ? 'left' : 'right',
    ...(right ? { left: `${leftPct}%` } : { right: `${100 - leftPct}%` }),
  };

  // Seed the editable text when it changes externally (not while the user types).
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerText !== memo.text) el.innerText = memo.text;
  }, [memo.text]);
  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);

  return (
    <div className="group pointer-events-auto" style={style}>
      {/* Hover-only delete. */}
      <button
        type="button"
        onClick={onDelete}
        aria-label={t('rim.delete')}
        className="absolute -top-2 z-10 grid h-5 w-5 place-items-center rounded-full opacity-0 shadow transition-opacity group-hover:opacity-100"
        style={{
          [right ? 'left' : 'right']: -8,
          backgroundColor: 'hsl(var(--surface))',
          border: '1px solid hsl(var(--border))',
        } as CSSProperties}
      >
        <X className="h-3 w-3" style={{ color: 'hsl(var(--text-muted))' }} />
      </button>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={t('rim.placeholder')}
        data-placeholder={t('rim.placeholder')}
        className="rim-memo-text"
        style={{
          background: 'transparent',
          color: 'hsl(var(--foreground))',
          fontSize: 13,
          lineHeight: 1.4,
          fontWeight: 600,
          outline: 'none',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          cursor: 'text',
          padding: '1px 3px',
          textShadow: '0 1px 2px hsl(var(--background)), 0 0 2px hsl(var(--background))',
        }}
        onInput={(e) => onChange(e.currentTarget.innerText)}
        onBlur={(e) => {
          // An empty memo left behind is just visual noise — drop it.
          if (!e.currentTarget.innerText.trim()) onDelete();
        }}
      />
    </div>
  );
}

// ─── Layer ────────────────────────────────────────────────────────────────────

/**
 * Overlay on the chart that lets you drop a memo by hovering near the rim: a
 * leader line extends outward and the note sits outside the chart (right-half →
 * right, left-half → left). Transparent; the delete X shows on hover. The thin
 * hover-capture ring sits OUTSIDE the slices so it never blocks slice editing.
 */
export function RimMemoLayer() {
  const { memos, add, update, remove } = useRimMemos();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverAngle, setHoverAngle] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const toAngle = (clientX: number, clientY: number): number | null => {
    const svg = svgRef.current;
    if (!svg || typeof svg.getScreenCTM !== 'function') return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return (Math.atan2(p.y - CY, p.x - CX) * 180) / Math.PI;
  };

  const band = annulusPath(BAND_OUTER, OUTER_R);

  return (
    <div className="pointer-events-none absolute inset-0" style={{ overflow: 'visible' }}>
      <svg
        ref={svgRef}
        viewBox={`-${VB_MARGIN} -${VB_MARGIN} ${VB_SIZE} ${VB_SIZE}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        style={{ overflow: 'visible', pointerEvents: 'none' }}
        aria-hidden="true"
      >
        {/* Hover-capture ring (outside the slices). */}
        <path
          d={band}
          fillRule="evenodd"
          fill="transparent"
          style={{ pointerEvents: 'auto', cursor: 'copy' }}
          onPointerMove={(e) => {
            const a = toAngle(e.clientX, e.clientY);
            if (a !== null) setHoverAngle(a);
          }}
          onPointerLeave={() => setHoverAngle(null)}
          onClick={(e) => {
            const a = toAngle(e.clientX, e.clientY);
            if (a === null) return;
            setHoverAngle(null);
            setEditingId(add(a));
          }}
        />

        {/* Hover preview: extending leader + a "+". */}
        {hoverAngle !== null && (() => {
          const rim = polar(OUTER_R, hoverAngle);
          const elbow = polar(ELBOW_R, hoverAngle);
          return (
            <g style={{ pointerEvents: 'none' }}>
              <line x1={rim.x} y1={rim.y} x2={elbow.x} y2={elbow.y} stroke="hsl(var(--accent))" strokeWidth={2} strokeDasharray="4 4" opacity={0.8} />
              <circle cx={elbow.x} cy={elbow.y} r={11} fill="hsl(var(--accent))" />
              <text x={elbow.x} y={elbow.y} textAnchor="middle" dominantBaseline="central" fontSize={16} fontWeight={700} fill="hsl(var(--primary-foreground))">+</text>
            </g>
          );
        })()}

        {/* Leader line per memo. */}
        {memos.map((m) => {
          const rim = polar(OUTER_R, m.angleDeg);
          const elbow = polar(ELBOW_R, m.angleDeg);
          return (
            <g key={m.id} style={{ pointerEvents: 'none' }}>
              <line x1={rim.x} y1={rim.y} x2={elbow.x} y2={elbow.y} stroke="hsl(var(--text-muted))" strokeWidth={1.5} opacity={0.6} />
              <circle cx={rim.x} cy={rim.y} r={3} fill="hsl(var(--text-muted))" opacity={0.7} />
            </g>
          );
        })}
      </svg>

      {/* HTML memo boxes (outside the chart; editable). */}
      {memos.map((m) => (
        <RimMemoBox
          key={m.id}
          memo={m}
          autoFocus={editingId === m.id}
          onChange={(text) => update(m.id, text)}
          onDelete={() => remove(m.id)}
        />
      ))}
    </div>
  );
}
