import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { X, Move } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
const DOT_R = OUTER_R + 18; // mobile: marker dot hugging the rim

const polar = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
};
const pctX = (x: number) => ((x + VB_MARGIN) / VB_SIZE) * 100;
const pctY = (y: number) => ((y + VB_MARGIN) / VB_SIZE) * 100;
const fmtMinute = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

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

// ─── A single transparent, editable rim memo (desktop) ───────────────────────

function RimMemoBox({
  memo,
  angleDeg,
  autoFocus,
  readOnly = false,
  deletable = false,
  onChange,
  onDelete,
  onStartDrag,
}: {
  memo: RimMemo;
  angleDeg: number;
  autoFocus: boolean;
  /** No text editing / dragging (a locked diary snapshot). */
  readOnly?: boolean;
  /** Show the hover controls (drag along the rim + delete). */
  deletable?: boolean;
  onChange: (text: string) => void;
  onDelete: () => void;
  onStartDrag: (e: ReactPointerEvent<HTMLElement>) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const right = Math.cos((angleDeg * Math.PI) / 180) >= 0;
  const elbow = polar(ELBOW_R, angleDeg);
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
      {/* Hover-only controls — drag along the rim + delete. */}
      {deletable && (
      <div
        className="absolute -top-2.5 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ [right ? 'left' : 'right']: -8 } as CSSProperties}
      >
        <button
          type="button"
          onPointerDown={onStartDrag}
          aria-label={t('rim.move')}
          className="grid h-5 w-5 cursor-grab place-items-center rounded-full shadow active:cursor-grabbing"
          style={{ backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', touchAction: 'none' }}
        >
          <Move className="h-3 w-3" style={{ color: 'hsl(var(--text-muted))' }} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('rim.delete')}
          className="grid h-5 w-5 place-items-center rounded-full shadow"
          style={{ backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))' }}
        >
          <X className="h-3 w-3" style={{ color: 'hsl(var(--text-muted))' }} />
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
 * Overlay on the chart for rim (edge) memos.
 *
 * Desktop: hover near the rim → leader line + a "+" to drop a note; notes are
 * transparent inline text with hover controls (drag along the rim, delete).
 *
 * Mobile: full notes would cover the chart on a phone, so each memo renders as
 * a small dot on the rim; tapping it opens a popup to read (and delete) it.
 * Creating/editing/dragging stays desktop-only.
 */
export function RimMemoLayer() {
  const { t } = useTranslation();
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
  // Mobile: memo currently open in the view popup.
  const [viewId, setViewId] = useState<string | null>(null);

  // When a diary record is loaded, show THAT date's saved rim memos read-only —
  // without touching the active day's own list. Leaving the diary
  // (diaryDate → null) falls straight back to the live `memos`.
  const source = diaryDate ? (entries[diaryDate]?.rimMemos ?? []) : memos;

  // Only memos whose anchor time is visible in the current window are shown.
  const visible = source.filter((m) => isInWindow(m.minute, spec));
  const viewMemo = viewId ? visible.find((m) => m.id === viewId) ?? null : null;

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
  // Deleting is still allowed on touch (via the view popup).
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

        {/* Leader line per memo (desktop text layout only). */}
        {!isMobile && visible.map((m) => {
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

      {isMobile ? (
        // Mobile: one small dot per memo, hugging the rim. Tap → view popup.
        visible.map((m) => {
          const ang = angleForMin(m.minute, spec);
          const p = polar(DOT_R, ang);
          return (
            <button
              key={m.id}
              type="button"
              data-rim-dot
              aria-label={`${t('rim.viewTitle')} ${fmtMinute(m.minute)}`}
              onClick={() => setViewId(m.id)}
              className="grid place-items-center"
              style={{
                position: 'absolute',
                left: `${pctX(p.x)}%`,
                top: `${pctY(p.y)}%`,
                transform: 'translate(-50%, -50%)',
                width: 28,
                height: 28,
                zIndex: 24,
                pointerEvents: 'auto',
                background: 'transparent',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 13,
                  height: 13,
                  borderRadius: 9999,
                  backgroundColor: 'hsl(var(--accent))',
                  border: '2px solid hsl(var(--background))',
                  boxShadow: '0 1px 4px rgb(0 0 0 / 0.35)',
                }}
              />
            </button>
          );
        })
      ) : (
        // Desktop: HTML memo boxes (outside the chart; editable).
        visible.map((m) => (
          <RimMemoBox
            key={m.id}
            memo={m}
            angleDeg={angleForMin(m.minute, spec)}
            autoFocus={editingId === m.id}
            readOnly={!canEdit}
            deletable={canModify}
            onChange={(text) => update(m.id, text)}
            onDelete={() => remove(m.id)}
            onStartDrag={(e) => startDrag(m.id, e)}
          />
        ))
      )}

      {/* Mobile view popup — read the memo, optionally delete it. */}
      {isMobile && (
        <Dialog open={!!viewMemo} onOpenChange={(o) => { if (!o) setViewId(null); }}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle>
                {t('rim.viewTitle')}
                {viewMemo && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {fmtMinute(viewMemo.minute)}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <p className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-sm text-foreground">
              {viewMemo?.text.trim() ? viewMemo.text : t('rim.placeholder')}
            </p>
            <DialogFooter className="flex-row justify-end gap-2">
              {canModify && viewMemo && (
                <Button
                  variant="outline"
                  aria-label={t('rim.delete')}
                  onClick={() => {
                    remove(viewMemo.id);
                    setViewId(null);
                  }}
                >
                  {t('rim.delete')}
                </Button>
              )}
              <Button onClick={() => setViewId(null)}>{t('common.close')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
