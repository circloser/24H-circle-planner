import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { X, Move } from 'lucide-react';
import { useRimMemos, type RimMemo } from './useRimMemos';
import { useChartView, useTranslation } from '@/hooks/usePreferences';
import { useDays } from '@/hooks/useDays';
import { useDiary } from '@/hooks/useDiary';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { viewSpec, angleForMin, minForAngle, isInWindow } from '@/lib/chart-view';

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
  angleDeg,
  autoFocus,
  readOnly = false,
  deletable = false,
  isMobile = false,
  onChange,
  onDelete,
  onStartDrag,
}: {
  memo: RimMemo;
  angleDeg: number;
  autoFocus: boolean;
  /** No text editing / dragging (touch or a locked diary snapshot). */
  readOnly?: boolean;
  /** Show the delete control (allowed on touch even though editing isn't). */
  deletable?: boolean;
  isMobile?: boolean;
  onChange: (text: string) => void;
  onDelete: () => void;
  onStartDrag: (e: ReactPointerEvent<HTMLElement>) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const right = Math.cos((angleDeg * Math.PI) / 180) >= 0;
  const elbow = polar(ELBOW_R, angleDeg);
  const leftPct = pctX(elbow.x);
  const topPct = pctY(elbow.y);

  // On phones the chart fills the width, so a memo anchored near the left/right
  // edge would spill past the viewport and stretch the page. Nudge it back
  // in-bounds after paint (keeps it readable instead of clipped).
  const [dx, setDx] = useState(0);
  useEffect(() => {
    // Measure after paint (rAF) and nudge — setState lives inside the frame
    // callback, not the effect body, so it can't loop.
    const id = requestAnimationFrame(() => {
      if (!isMobile) {
        setDx((prev) => (prev === 0 ? prev : 0));
        return;
      }
      const el = boxRef.current;
      if (!el || typeof window === 'undefined') return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const M = 6;
      let corr = 0;
      if (r.left < M) corr = M - r.left;
      else if (r.right > vw - M) corr = vw - M - r.right;
      setDx((prev) => (Math.abs(corr) < 0.5 ? prev : prev + corr));
    });
    return () => cancelAnimationFrame(id);
  }, [memo.text, angleDeg, isMobile]);

  // Position outside the chart: right-half memos grow rightward, left-half leftward.
  // On touch the box itself is inert (pointerEvents:none) so it can never swallow
  // a slice tap when clamped inward over the chart — only the delete button is live.
  const style: CSSProperties = {
    position: 'absolute',
    top: `${topPct}%`,
    transform: `translateY(-50%) translateX(${dx}px)`,
    width: isMobile ? 132 : 150,
    zIndex: 24,
    textAlign: right ? 'left' : 'right',
    pointerEvents: isMobile ? 'none' : 'auto',
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

  const btnSize = isMobile ? 'h-6 w-6' : 'h-5 w-5';
  const iconSize = isMobile ? 'h-3.5 w-3.5' : 'h-3 w-3';

  return (
    <div ref={boxRef} className="group" style={style}>
      {/* Controls. Desktop: drag-along-rim + delete, revealed on hover. Touch:
          delete only, always visible, pointerEvents re-enabled (the box itself
          is inert on touch). */}
      {deletable && (
      <div
        className={`absolute -top-2.5 z-10 flex items-center gap-1 transition-opacity ${
          isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        style={{ [right ? 'left' : 'right']: -8, pointerEvents: 'auto' } as CSSProperties}
      >
        {!readOnly && (
        <button
          type="button"
          onPointerDown={onStartDrag}
          aria-label={t('rim.move')}
          className={`grid ${btnSize} cursor-grab place-items-center rounded-full shadow active:cursor-grabbing`}
          style={{ backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', touchAction: 'none' }}
        >
          <Move className={iconSize} style={{ color: 'hsl(var(--text-muted))' }} />
        </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('rim.delete')}
          className={`grid ${btnSize} place-items-center rounded-full shadow`}
          style={{ backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))' }}
        >
          <X className={iconSize} style={{ color: 'hsl(var(--text-muted))' }} />
        </button>
      </div>
      )}

      <div
        ref={ref}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        role="textbox"
        aria-label={t('rim.placeholder')}
        data-placeholder={readOnly ? undefined : t('rim.placeholder')}
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
          cursor: readOnly ? 'default' : 'text',
          padding: '1px 3px',
          textShadow: '0 1px 2px hsl(var(--background)), 0 0 2px hsl(var(--background))',
        }}
        onInput={readOnly ? undefined : (e) => onChange(e.currentTarget.innerText)}
        onBlur={readOnly ? undefined : (e) => {
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
 * right, left-half → left). Transparent; the delete X shows on hover (desktop)
 * or always (touch). The thin hover-capture ring sits OUTSIDE the slices so it
 * never blocks slice editing.
 */
export function RimMemoLayer() {
  const { activeId } = useDays();
  const { memos, add, update, setMinute, remove } = useRimMemos(activeId);
  const { entries } = useDiary();
  const diaryDate = useStoreSelector((s) => s.diaryDate);
  const locked = useStoreSelector((s) => s.locked);
  const isMobile = useIsMobile();
  const spec = viewSpec(useChartView());
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverAngle, setHoverAngle] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // When a diary record is loaded, show THAT date's saved rim memos read-only —
  // without touching the active day's own list. (The previous version copied the
  // diary's memos into the active day and never restored them, so they leaked
  // into the editing view after leaving the diary.) Leaving the diary
  // (diaryDate → null) falls straight back to the live `memos`.
  const source = diaryDate ? (entries[diaryDate]?.rimMemos ?? []) : memos;

  // Only memos whose anchor time is visible in the current window are shown.
  const visible = source.filter((m) => isInWindow(m.minute, spec));

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

  // Drag a memo around the rim: the pointer angle → minute, so the note (and its
  // leader) glide along the edge naturally.
  const startDrag = (id: string, e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const a = toAngle(ev.clientX, ev.clientY);
      if (a !== null) setMinute(id, minForAngle(a, spec));
    };
    const up = () => {
      el.releasePointerCapture(e.pointerId);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const band = annulusPath(BAND_OUTER, OUTER_R);
  // Full editing (create via the ring, edit text, drag along the rim) is a
  // desktop-hover interaction — off on touch and in a locked diary snapshot.
  // Deleting is still allowed on touch (that's how you clear a memo there).
  const canEdit = !locked && !diaryDate && !isMobile;
  const canModify = !locked && !diaryDate;

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
          style={{ pointerEvents: canEdit ? 'auto' : 'none', cursor: 'copy' }}
          onPointerMove={(e) => {
            const a = toAngle(e.clientX, e.clientY);
            if (a !== null) setHoverAngle(a);
          }}
          onPointerLeave={() => setHoverAngle(null)}
          onClick={(e) => {
            const a = toAngle(e.clientX, e.clientY);
            if (a === null) return;
            setHoverAngle(null);
            setEditingId(add(minForAngle(a, spec)));
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

        {/* Leader line per memo (angle derived from the active view). */}
        {visible.map((m) => {
          const ang = angleForMin(m.minute, spec);
          const rim = polar(OUTER_R, ang);
          const elbow = polar(ELBOW_R, ang);
          return (
            <g key={m.id} style={{ pointerEvents: 'none' }}>
              <line x1={rim.x} y1={rim.y} x2={elbow.x} y2={elbow.y} stroke="hsl(var(--text-muted))" strokeWidth={1.5} opacity={0.6} />
              <circle cx={rim.x} cy={rim.y} r={3} fill="hsl(var(--text-muted))" opacity={0.7} />
            </g>
          );
        })}
      </svg>

      {/* HTML memo boxes (outside the chart; editable). */}
      {visible.map((m) => (
        <RimMemoBox
          key={m.id}
          memo={m}
          angleDeg={angleForMin(m.minute, spec)}
          autoFocus={editingId === m.id}
          readOnly={!canEdit}
          deletable={canModify}
          isMobile={isMobile}
          onChange={(text) => update(m.id, text)}
          onDelete={() => remove(m.id)}
          onStartDrag={(e) => startDrag(m.id, e)}
        />
      ))}
    </div>
  );
}
