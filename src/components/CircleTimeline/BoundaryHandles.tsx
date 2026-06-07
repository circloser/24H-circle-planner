import { useState } from 'react';
import type { TimeSlice } from '@/types/time-slice';
import { boundaryHandlePosition, RING, polarToCartesian } from '@/lib/svg-geometry';
import { sliceWidthMinutes, minutesToHhmm, hhmmToMinutes } from '@/lib/time-utils';
import { useStoreDispatch } from '@/hooks/useScheduleStore';

interface BoundaryHandlesProps {
  slices: TimeSlice[];
  onPointerDownHandle: (e: React.PointerEvent<SVGElement>, boundaryIndex: number) => void;
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
} {
  const { innerR, outerR, cx, cy } = RING;
  const midR = (innerR + outerR) / 2;
  return {
    minus: polarToCartesian(cx, cy, midR - 52, angleDeg),
    leftPlus: polarToCartesian(cx, cy, midR, angleDeg - PLUS_ANGLE_DELTA),
    rightPlus: polarToCartesian(cx, cy, midR, angleDeg + PLUS_ANGLE_DELTA),
    handle: polarToCartesian(cx, cy, midR, angleDeg),
  };
}

// ─── Single affordance button ─────────────────────────────────────────────────

interface AffordanceBtnProps {
  x: number;
  y: number;
  label: string;
  ariaLabel: string;
  disabled?: boolean;
  onClick: (e: React.MouseEvent) => void;
}

function AffordanceBtn({ x, y, label, ariaLabel, disabled, onClick }: AffordanceBtnProps) {
  const r = 13; // tap target radius
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
        fontFamily="Pretendard, system-ui, sans-serif"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
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
  onPointerDownHandle: (e: React.PointerEvent<SVGElement>, boundaryIndex: number) => void;
}

function BoundaryHandle({ slice, slices, index, onPointerDownHandle }: BoundaryHandleProps) {
  const dispatch = useStoreDispatch();
  const [hovered, setHovered] = useState(false);

  const { x, y, angleDeg } = boundaryHandlePosition(slice, 'end');
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

  const { minus: minusPos, leftPlus: leftPlusPos, rightPlus: rightPlusPos, handle } =
    affordancePositions(angleDeg);

  const handleMinus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canMinus) return;
    dispatch({ type: 'MERGE', idCw: cwSlice.id, idCcw: ccwSlice.id });
  };

  // Left "+" → add a division inside the CCW slice (before this boundary).
  const handleLeftPlus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canLeftPlus) return;
    dispatch({ type: 'SPLIT', hhmm: sliceMidpointHhmm(ccwSlice) });
  };

  // Right "+" → add a division inside the CW slice (after this boundary).
  const handleRightPlus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canRightPlus) return;
    dispatch({ type: 'SPLIT', hhmm: sliceMidpointHhmm(cwSlice) });
  };

  return (
    <g
      data-boundary-index={index}
      style={{ cursor: 'ew-resize', touchAction: 'none' }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Hover affordances — rendered BELOW the drag hit-area in DOM order,
          but on a higher visual layer by z-order of SVG paint order.
          Tagged data-export-exclude so the export clone strips them.
          The wrapping <g> above covers both handle and affordance buttons,
          so moving from handle to button does NOT fire pointerleave — no hover gap. */}
      {hovered && (
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
          <AffordanceBtn
            x={minusPos.x}
            y={minusPos.y}
            label="−"
            ariaLabel="이 경계 일정 병합"
            disabled={!canMinus}
            onClick={handleMinus}
          />
          <AffordanceBtn
            x={leftPlusPos.x}
            y={leftPlusPos.y}
            label="+"
            ariaLabel="왼쪽 칸에 일정 추가"
            disabled={!canLeftPlus}
            onClick={handleLeftPlus}
          />
          <AffordanceBtn
            x={rightPlusPos.x}
            y={rightPlusPos.y}
            label="+"
            ariaLabel="오른쪽 칸에 일정 추가"
            disabled={!canRightPlus}
            onClick={handleRightPlus}
          />
        </g>
      )}

      {/* Visible outer handle ring — only shown when hovered or keyboard-focused */}
      <circle
        cx={x}
        cy={y}
        r={6}
        fill="hsl(var(--background))"
        stroke="hsl(var(--border))"
        strokeWidth={2}
        style={{ pointerEvents: 'none', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}
      />
      {/* Inner accent dot — only shown when hovered or keyboard-focused */}
      <circle
        cx={x}
        cy={y}
        r={3}
        fill="hsl(var(--foreground) / 0.7)"
        style={{ pointerEvents: 'none', opacity: hovered ? 1 : 0, transition: 'opacity 0.15s' }}
      />
      {/* Transparent 16px hit-area — always present so boundary is grabbable/hoverable.
          This is the drag initiator; affordance buttons stop propagation so their
          clicks never reach this and never start a drag. */}
      <circle
        cx={x}
        cy={y}
        r={16}
        fill="transparent"
        stroke="none"
        role="slider"
        aria-label={`경계 ${index + 1} 드래그`}
        tabIndex={0}
        style={{ cursor: 'ew-resize', touchAction: 'none' }}
        onPointerDown={(e) => onPointerDownHandle(e, index)}
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
export function BoundaryHandles({ slices, onPointerDownHandle }: BoundaryHandlesProps) {
  if (slices.length <= 1) return null;

  return (
    <g className="boundary-handles">
      {slices.map((slice, i) => (
        <BoundaryHandle
          key={`boundary-${i}`}
          slice={slice}
          slices={slices}
          index={i}
          onPointerDownHandle={onPointerDownHandle}
        />
      ))}
    </g>
  );
}
