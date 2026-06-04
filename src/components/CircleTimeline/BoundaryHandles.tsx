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

/**
 * Affordance button offset positions (relative to the handle dot).
 * "−" merges: placed inward (toward hub, smaller radius).
 * "+" splits:  placed outward (toward rim, larger radius).
 * Both flanking the handle radially so they don't sit on the drag hit-area.
 */
function affordancePositions(
  angleDeg: number,
): { minus: { x: number; y: number }; plus: { x: number; y: number } } {
  const { innerR, outerR, cx, cy } = RING;
  const midR = (innerR + outerR) / 2;
  // Inward offset (toward hub): midR - 52px
  const inwardR = midR - 52;
  // Outward offset (toward rim): midR + 52px
  const outwardR = midR + 52;
  return {
    minus: polarToCartesian(cx, cy, inwardR, angleDeg),
    plus: polarToCartesian(cx, cy, outwardR, angleDeg),
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
      {/* Filled accent circle */}
      <circle
        cx={x}
        cy={y}
        r={r}
        fill="hsl(var(--accent))"
        stroke="hsl(var(--background))"
        strokeWidth={1.5}
        style={{ pointerEvents: 'none' }}
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

  // "+" is available if either adjacent slice is ≥ 20 min
  const ccwWidth = sliceWidthMinutes(ccwSlice);
  const cwWidth = sliceWidthMinutes(cwSlice);
  const canPlus = ccwWidth >= 20 || cwWidth >= 20;

  const { minus: minusPos, plus: plusPos } = affordancePositions(angleDeg);

  const handleMinus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canMinus) return;
    dispatch({ type: 'MERGE', idCw: cwSlice.id, idCcw: ccwSlice.id });
  };

  const handlePlus = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canPlus) return;
    // Split the larger of the two adjacent slices at its midpoint
    const targetSlice = ccwWidth >= cwWidth ? ccwSlice : cwSlice;
    const midHhmm = sliceMidpointHhmm(targetSlice);
    dispatch({ type: 'SPLIT', hhmm: midHhmm });
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
          Tagged data-export-exclude so the export clone strips them. */}
      {hovered && (
        <g
          className="boundary-affordances"
          data-export-exclude="true"
          aria-hidden="false"
        >
          <AffordanceBtn
            x={minusPos.x}
            y={minusPos.y}
            label="−"
            ariaLabel="이 경계 일정 병합"
            disabled={!canMinus}
            onClick={handleMinus}
          />
          <AffordanceBtn
            x={plusPos.x}
            y={plusPos.y}
            label="+"
            ariaLabel="이 경계에서 일정 추가"
            disabled={!canPlus}
            onClick={handlePlus}
          />
        </g>
      )}

      {/* Visible outer handle ring */}
      <circle
        cx={x}
        cy={y}
        r={6}
        fill="hsl(var(--background))"
        stroke="hsl(var(--border))"
        strokeWidth={2}
        style={{ pointerEvents: 'none' }}
      />
      {/* Inner accent dot */}
      <circle
        cx={x}
        cy={y}
        r={3}
        fill="hsl(var(--foreground) / 0.7)"
        style={{ pointerEvents: 'none' }}
      />
      {/* Transparent 16px hit-area — easy pointer capture without cluttering visuals.
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
