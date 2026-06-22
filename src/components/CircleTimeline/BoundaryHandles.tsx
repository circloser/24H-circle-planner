import { useState, useEffect, useRef } from 'react';
import type { TimeSlice } from '@/types/time-slice';
import { boundaryHandlePosition, RING, polarToCartesian } from '@/lib/svg-geometry';
import { sliceWidthMinutes, minutesToHhmm, hhmmToMinutes } from '@/lib/time-utils';
import { FULL_SPEC, isInWindow, type ViewSpec } from '@/lib/chart-view';
import { useStoreDispatch, useStoreSelector } from '@/hooks/useScheduleStore';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';

interface BoundaryHandlesProps {
  slices: TimeSlice[];
  onPointerDownHandle: (e: React.PointerEvent<SVGElement>, boundaryIndex: number) => void;
  /** Active view window — positions handles + hides out-of-window boundaries. */
  spec?: ViewSpec;
}

// ─── +/− affordance helpers ───────────────────────────────────────────────────

/**
 * Compute mid-point HH:mm of a slice (handles midnight wrap).
 * Snapped to nearest 10-min boundary.
 */
function sliceMidpointHhmm(slice: TimeSlice): string {
  const startMin = hhmmToMinutes(slice.startTime);
  const widthMin = sliceWidthMinutes(slice);
  const midMin = (startMin + Math.floor(widthMin / 2)) % 1440;
  const snapped = (Math.round(midMin / 10) * 10) % 1440;
  return minutesToHhmm(snapped);
}

// "+" buttons sit this many degrees to each side of the boundary line, along
// the ring — so adding a slice on the left or right is spatially intuitive.
const PLUS_ANGLE_DELTA = 8;

/**
 * Affordance button positions (relative to the handle dot at midR).
 * "−" merges: inward (toward hub).
 * "+" (left/right): flanking the division line tangentially. The left "+"
 * (CCW side) splits the slice before the boundary; the right "+" (CW side)
 * splits the slice after it.
 */
function affordancePositions(angleDeg: number): {
  minus: { x: number; y: number };
  leftPlus: { x: number; y: number };
  rightPlus: { x: number; y: number };
  handle: { x: number; y: number };
  time: { x: number; y: number };
} {
  const { innerR, outerR, cx, cy } = RING;
  const midR = (innerR + outerR) / 2;
  return {
    minus: polarToCartesian(cx, cy, midR - 52, angleDeg),
    leftPlus: polarToCartesian(cx, cy, midR, angleDeg - PLUS_ANGLE_DELTA),
    rightPlus: polarToCartesian(cx, cy, midR, angleDeg + PLUS_ANGLE_DELTA),
    handle: polarToCartesian(cx, cy, midR, angleDeg),
    // Boundary time pill sits outward from the handle, clear of the buttons.
    time: polarToCartesian(cx, cy, midR + 50, angleDeg),
  };
}

// ─── Single affordance button ─────────────────────────────────────────────────

interface AffordanceBtnProps {
  x: number;
  y: number;
  label: string;
  ariaLabel: string;
  disabled?: boolean;
  /** Hit-target radius — enlarged on touch devices. */
  r?: number;
  onClick: (e: React.MouseEvent) => void;
}

function AffordanceBtn({ x, y, label, ariaLabel, disabled, r = 13, onClick }: AffordanceBtnProps) {
  const opacity = disabled ? 0.35 : 1;

  return (
    <g
      role="button"
      aria-label={ariaLabel}
      aria-disabled={disabled ? 'true' : undefined}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity,
        pointerEvents: 'all',
      }}
      onClick={disabled ? undefined : (e) => { e.stopPropagation(); onClick(e); }}
      onPointerDown={(e) => { e.stopPropagation(); }} // never start a drag from affordance
    >
      {/* Filled accent circle — this is the click hit-target. An SVG <g> has no
          geometry of its own, so the circle (not the <g>) must catch pointer
          events; the onClick on the wrapping <g> then fires via bubbling. */}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill="hsl(var(--accent))"
        stroke="hsl(var(--background))"
        strokeWidth={1.5}
        style={{ pointerEvents: 'all' }}
      />
      {/* Symbol text */}
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={16}
        fontWeight={700}
        fill="hsl(var(--primary-foreground))"
        fontFamily="inherit"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}

// ─── Boundary time pill ───────────────────────────────────────────────────────

/**
 * The little rounded label showing the boundary's HH:mm. Stable data-attrs let
 * the drag engine reposition + relabel it imperatively during a drag (no React
 * re-render — see moveBoundaryHandleImperative in useSliceInteraction.ts).
 * Rendered inside the hover affordance group (which carries data-export-exclude)
 * OR standalone while this boundary is being dragged — never both at once.
 */
function TimePill({ pos, label }: { pos: { x: number; y: number }; label: string }) {
  return (
    <g className="boundary-time-pill" style={{ pointerEvents: 'none' }}>
      <rect
        data-time-pill-rect="1"
        x={pos.x - 26}
        y={pos.y - 13}
        width={52}
        height={26}
        rx={13}
        fill="hsl(var(--foreground))"
        opacity={0.92}
      />
      <text
        data-time-pill-text="1"
        x={pos.x}
        y={pos.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={18}
        fontWeight={700}
        fill="hsl(var(--background))"
        fontFamily="inherit"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {label}
      </text>
    </g>
  );
}

// ─── Single boundary handle with hover affordances ────────────────────────────

interface BoundaryHandleProps {
  slice: TimeSlice;
  slices: TimeSlice[];
  index: number;
  spec: ViewSpec;
  onPointerDownHandle: (e: React.PointerEvent<SVGElement>, boundaryIndex: number) => void;
}

function BoundaryHandle({ slice, slices, index, spec, onPointerDownHandle }: BoundaryHandleProps) {
  const dispatch = useStoreDispatch();
  const [hovered, setHovered] = useState(false);
  // On touch there is no hover, so a tap on the boundary "activates" it, keeping
  // the affordances on screen until the user taps elsewhere.
  const [tapActive, setTapActive] = useState(false);
  const coarse = useCoarsePointer();
  const gRef = useRef<SVGGElement | null>(null);

  // Drag state — changes only at drag start/end (not per-move), so subscribing
  // here does not violate the C10 per-move isolation contract.
  const isDraggingBoundary = useStoreSelector((s) => s.isDraggingBoundary);
  const draggedIndex = useStoreSelector((s) => (s.dragRef ? s.dragRef.boundaryIndex : -1));
  const isThisDragged = isDraggingBoundary && draggedIndex === index;

  // Mouse: hover reveals. Touch: a tap reveals (and stays) — see tapActive below.
  const revealed = hovered || (coarse && tapActive);

  // Affordances (+/− buttons) are an idle affordance — suppressed during any
  // drag. The handle dot + time pill stay visible while dragging so the division
  // is legible as it moves. On touch the dots stay visible so every boundary is
  // a discoverable, draggable target without needing hover.
  const showAffordances = revealed && !isDraggingBoundary;
  const dotVisible = revealed || isThisDragged || coarse;

  // Touch: while this boundary is tap-activated, a tap anywhere outside its group
  // dismisses the affordances. Deferred a tick so the activating tap itself does
  // not immediately clear it.
  useEffect(() => {
    if (!coarse || !tapActive) return;
    const onDocDown = (e: PointerEvent) => {
      const g = gRef.current;
      if (g && e.target instanceof Node && g.contains(e.target)) return;
      setTapActive(false);
    };
    const id = window.setTimeout(() => document.addEventListener('pointerdown', onDocDown, true), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('pointerdown', onDocDown, true);
    };
  }, [coarse, tapActive]);

  const { x, y, angleDeg } = boundaryHandlePosition(slice, 'end', undefined, spec);
  // Endpoints of the division line (hub edge → rim) for the wide hover/grab strip.
  const innerPt = polarToCartesian(RING.cx, RING.cy, RING.innerR + 2, angleDeg);
  const outerPt = polarToCartesian(RING.cx, RING.cy, RING.outerR - 2, angleDeg);
  const len = slices.length;

  // CCW slice = slices[index], CW slice = slices[(index + 1) % len]
  const ccwSlice = slices[index];
  const cwSlice = slices[(index + 1) % len];

  // "−" is always available when ≥2 slices (merging down to 1 is fine)
  const canMinus = len >= 2;

  // Each "+" splits its own adjacent slice; needs that slice ≥ 20 min.
  const ccwWidth = sliceWidthMinutes(ccwSlice);
  const cwWidth = sliceWidthMinutes(cwSlice);
  const canLeftPlus = ccwWidth >= 20;
  const canRightPlus = cwWidth >= 20;

  const {
    minus: minusPos,
    leftPlus: leftPlusPos,
    rightPlus: rightPlusPos,
    handle,
    time: timePos,
  } = affordancePositions(angleDeg);

  // The boundary's time (= end of the CCW slice). "24:00" shows as "00:00".
  const boundaryTime = slice.endTime === '24:00' ? '00:00' : slice.endTime;

  const handleMinus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canMinus) return;
    dispatch({ type: 'MERGE', idCw: cwSlice.id, idCcw: ccwSlice.id });
  };

  // Left "+" → new empty cell on the CCW side, adjacent to this boundary. The
  // CCW slice keeps its content in its earlier half ('after' = later half is the
  // new empty slot, which sits next to the boundary), pushing content away.
  const handleLeftPlus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canLeftPlus) return;
    dispatch({ type: 'SPLIT', hhmm: sliceMidpointHhmm(ccwSlice), newSlotSide: 'after' });
  };

  // Right "+" → new empty cell on the CW side, adjacent to this boundary. The CW
  // slice keeps its content in its later half ('before' = earlier half is the
  // new empty slot, which sits next to the boundary), pushing content away — the
  // mirror image of the left "+".
  const handleRightPlus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canRightPlus) return;
    dispatch({ type: 'SPLIT', hhmm: sliceMidpointHhmm(cwSlice), newSlotSide: 'before' });
  };

  // Touch: a tap (not a drag) on the boundary toggles its affordances on/off.
  const handleTap = () => {
    if (coarse) setTapActive((v) => !v);
  };

  return (
    <g
      ref={gRef}
      data-boundary-index={index}
      style={{ cursor: 'ew-resize', touchAction: 'none' }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Wide transparent strip along the WHOLE division line (hub edge → rim) —
          so the affordances appear when the pointer is anywhere NEAR the
          boundary, not only on the small center dot. Pressing it also grabs the
          boundary for dragging. Rendered first (bottom) so the affordance
          buttons + dot stay on top. (Transparent → invisible in exports.) */}
      <line
        x1={innerPt.x}
        y1={innerPt.y}
        x2={outerPt.x}
        y2={outerPt.y}
        stroke="transparent"
        strokeWidth={coarse ? 36 : 20}
        style={{ pointerEvents: 'stroke', cursor: 'ew-resize', touchAction: 'none' }}
        onPointerDown={(e) => onPointerDownHandle(e, index)}
        onClick={handleTap}
      />

      {/* Hover affordances — rendered BELOW the drag hit-area in DOM order,
          but on a higher visual layer by z-order of SVG paint order.
          Tagged data-export-exclude so the export clone strips them.
          The wrapping <g> above covers both handle and affordance buttons,
          so moving from handle to button does NOT fire pointerleave — no hover gap. */}
      {showAffordances && (
        <g
          className="boundary-affordances"
          data-export-exclude="true"
          aria-hidden="false"
        >
          {/* Transparent hover zone — a circle centered on the handle covering
              the "−" (inward) and both "+" (left/right) buttons, so moving the
              pointer from the handle to any button keeps it over this <g> and
              the affordances don't vanish (no hover gap). Rendered first
              (bottom) so the buttons stay clickable on top. Inert. */}
          <circle
            cx={handle.x}
            cy={handle.y}
            r={64}
            fill="transparent"
            style={{ pointerEvents: 'all' }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Boundary time pill — shows what time this division is at. */}
          <TimePill pos={timePos} label={boundaryTime} />
          <AffordanceBtn
            x={minusPos.x}
            y={minusPos.y}
            label="−"
            ariaLabel="이 경계 일정 병합"
            disabled={!canMinus}
            r={coarse ? 18 : 13}
            onClick={handleMinus}
          />
          <AffordanceBtn
            x={leftPlusPos.x}
            y={leftPlusPos.y}
            label="+"
            ariaLabel="왼쪽 칸에 일정 추가"
            disabled={!canLeftPlus}
            r={coarse ? 18 : 13}
            onClick={handleLeftPlus}
          />
          <AffordanceBtn
            x={rightPlusPos.x}
            y={rightPlusPos.y}
            label="+"
            ariaLabel="오른쪽 칸에 일정 추가"
            disabled={!canRightPlus}
            r={coarse ? 18 : 13}
            onClick={handleRightPlus}
          />
        </g>
      )}

      {/* While THIS boundary is being dragged, show the time pill standalone
          (affordances are hidden above). The drag engine repositions + relabels
          it imperatively each pointermove so it tracks the cursor exactly. */}
      {isThisDragged && <TimePill pos={timePos} label={boundaryTime} />}

      {/* Visible outer handle ring — only shown when hovered or keyboard-focused */}
      <circle
        cx={x}
        cy={y}
        r={6}
        fill="hsl(var(--background))"
        stroke="hsl(var(--border))"
        strokeWidth={2}
        style={{ pointerEvents: 'none', opacity: dotVisible ? 1 : 0, transition: 'opacity 0.15s' }}
      />
      {/* Inner accent dot — only shown when hovered or keyboard-focused */}
      <circle
        cx={x}
        cy={y}
        r={3}
        fill="hsl(var(--foreground) / 0.7)"
        style={{ pointerEvents: 'none', opacity: dotVisible ? 1 : 0, transition: 'opacity 0.15s' }}
      />
      {/* Transparent 16px hit-area — always present so boundary is grabbable/hoverable.
          This is the drag initiator; affordance buttons stop propagation so their
          clicks never reach this and never start a drag. */}
      <circle
        cx={x}
        cy={y}
        r={coarse ? 24 : 16}
        fill="transparent"
        stroke="none"
        role="slider"
        aria-label={`경계 ${index + 1} 드래그`}
        tabIndex={0}
        style={{ cursor: 'ew-resize', touchAction: 'none' }}
        onPointerDown={(e) => onPointerDownHandle(e, index)}
        onClick={handleTap}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      />
    </g>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Renders one drag handle per boundary between adjacent slices.
 * If there is only one slice (full-day), renders nothing (no boundary).
 *
 * Each handle has:
 * - A visible small dot at (innerR + outerR) / 2 radius
 * - A transparent 16px hit-area circle for easy pointer targeting
 * - cursor: ew-resize
 * - touch-action: none
 * - On hover: +/− affordance buttons for split/merge (mouse only)
 */
export function BoundaryHandles({ slices, onPointerDownHandle, spec = FULL_SPEC }: BoundaryHandlesProps) {
  if (slices.length <= 1) return null;

  return (
    <g className="boundary-handles">
      {slices.map((slice, i) => {
        // 12h views only show handles for boundaries that fall inside the window;
        // boundaries between two out-of-window slices are hidden.
        const endStr = slice.endTime === '24:00' ? '00:00' : slice.endTime;
        if (spec.view !== 'full' && !isInWindow(hhmmToMinutes(endStr), spec)) return null;
        return (
          <BoundaryHandle
            key={`boundary-${i}`}
            slice={slice}
            slices={slices}
            index={i}
            spec={spec}
            onPointerDownHandle={onPointerDownHandle}
          />
        );
      })}
    </g>
  );
}
