import { useRef, useEffect, useState } from 'react';
import type { TimeSlice } from '@/types/time-slice';
import { RING, polarToCartesian, slicePath } from '@/lib/svg-geometry';
import { hhmmToAngle } from '@/lib/time-utils';
import { useSliceSelector, useStoreSelector } from '@/hooks/useScheduleStore';
import { SliceLabel } from './SliceLabel';
import { BoundaryHandles } from './BoundaryHandles';

interface CircleTimelineProps {
  slices: TimeSlice[];
  mode?: 'interactive' | 'preview';
  onSliceClick?: (id: string) => void;
  onSliceDoubleClick?: (id: string) => void;
  /** Fixed CSS pixel size. When undefined: responsive (100% width, max 720px). */
  size?: number;
  /** When true, renders a centered hint text overlay prompting the user to start. */
  showEmptyHint?: boolean;

  // ── T4 interaction props ───────────────────────────────────────────────────
  /**
   * 'view' disables all interaction (default, backward-compat for PresetGallery previews).
   * 'interactive' enables boundary handles, background click, and double-click.
   */
  interactionMode?: 'view' | 'interactive';
  /** The slice currently open in the editor — gets the selected wedge highlight. */
  selectedSliceId?: string | null;
  /** Ref to the <g> that owns dragging slice paths. Comes from useSliceInteraction(). */
  dragGroupRef?: React.RefObject<SVGGElement | null>;
  /** Ref to the <svg> root. Comes from useSliceInteraction(). */
  svgRef?: React.RefObject<SVGSVGElement | null>;
  /** Called when a slice is double-clicked in interactive mode. */
  onRequestEdit?: (sliceId: string) => void;
  /** Called when the drag handle for boundary i starts being dragged. */
  onPointerDownHandle?: (e: React.PointerEvent<SVGElement>, boundaryIndex: number) => void;
  /** Called on a background click to split at that position. */
  onBackgroundClick?: (e: React.MouseEvent<SVGElement>) => void;
}

// ─── Center hub live clock (HTML overlay, excluded from SVG export) ──────────
// The static glass disc is rendered inside the SVG; only the live clock text
// is an HTML overlay so PNG/PDF export (which clones svgRef.current) naturally
// excludes stale time values from the output artifact.

interface LiveClockResult {
  displayTime: string; // formatted for display (e.g. "09:41")
  hhmm: string;        // raw "HH:mm" for hhmmToAngle (always zero-padded)
}

function useLiveClock(): LiveClockResult {
  const getRaw = (): LiveClockResult => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const hhmm = `${hh}:${mm}`;
    // Display via locale for proper AM/PM-free 24h format
    const displayTime = now.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return { displayTime, hhmm };
  };

  const [clock, setClock] = useState(getRaw);

  useEffect(() => {
    const id = setInterval(() => setClock(getRaw()), 60_000);
    return () => clearInterval(id);
  }, []);

  return clock;
}

// ─── Hour tick helpers ────────────────────────────────────────────────────────

// Cardinal hours (00/06/12/18) get emphasis; all others are minor.
const CARDINAL_HOURS = new Set([0, 6, 12, 18]);

function HourTicks() {
  const ticks: React.ReactElement[] = [];
  const { cx, cy, outerR } = RING;

  for (let h = 0; h < 24; h++) {
    const angleDeg = -90 + h * 15;
    const isCardinal = CARDINAL_HOURS.has(h);

    // Tick line: longer + bolder for cardinal hours
    const tickStart = polarToCartesian(cx, cy, outerR, angleDeg);
    const tickEnd = polarToCartesian(cx, cy, outerR + (isCardinal ? 14 : 8), angleDeg);

    ticks.push(
      <line
        key={`tick-${h}`}
        x1={tickStart.x}
        y1={tickStart.y}
        x2={tickEnd.x}
        y2={tickEnd.y}
        stroke={
          isCardinal
            ? 'hsl(var(--text-muted) / 0.85)'
            : 'hsl(var(--text-muted) / 0.45)'
        }
        strokeWidth={isCardinal ? 2.5 : 1}
      />,
    );

    // Hour label: all 24, cardinal = larger + bolder, minor = smaller + lighter
    const labelRadius = outerR + (isCardinal ? 32 : 26);
    const labelPos = polarToCartesian(cx, cy, labelRadius, angleDeg);
    const label = String(h).padStart(2, '0');

    ticks.push(
      <text
        key={`label-${h}`}
        x={labelPos.x}
        y={labelPos.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={isCardinal ? 22 : 15}
        fontWeight={isCardinal ? 700 : 400}
        fill={
          isCardinal
            ? 'hsl(var(--text-muted) / 0.9)'
            : 'hsl(var(--text-muted) / 0.55)'
        }
        fontFamily="Pretendard, system-ui, sans-serif"
      >
        {label}
      </text>,
    );
  }

  return <g className="hour-ticks">{ticks}</g>;
}

// ─── Current-time "now" indicator line ───────────────────────────────────────
// Rendered in the SVG but tagged data-export-exclude="true" so the PNG/PDF
// export clone strips it (see png.ts and stripFilters.ts strip steps).

interface NowIndicatorProps {
  hhmm: string; // "HH:mm" current time
}

function NowIndicator({ hhmm }: NowIndicatorProps) {
  const { cx, cy, innerR, outerR } = RING;
  const angleDeg = hhmmToAngle(hhmm);

  const hubEdge = polarToCartesian(cx, cy, innerR + 2, angleDeg);
  const rimPoint = polarToCartesian(cx, cy, outerR - 2, angleDeg);

  return (
    <g
      className="now-indicator"
      data-export-exclude="true"
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {/* Radial line from hub edge to rim */}
      <line
        x1={hubEdge.x}
        y1={hubEdge.y}
        x2={rimPoint.x}
        y2={rimPoint.y}
        stroke="#EF4444"
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.9}
      />
      {/* Filled dot at the rim end */}
      <circle
        cx={rimPoint.x}
        cy={rimPoint.y}
        r={5}
        fill="#EF4444"
        opacity={0.9}
      />
    </g>
  );
}

// ─── Annulus backdrop path ────────────────────────────────────────────────────

function annulusPath(cx: number, cy: number, outerR: number, innerR: number): string {
  const fmt = (n: number) => n.toFixed(4);
  const outerTop = { x: cx, y: cy - outerR };
  const outerBot = { x: cx, y: cy + outerR };
  const innerTop = { x: cx, y: cy - innerR };
  const innerBot = { x: cx, y: cy + innerR };

  return [
    `M ${fmt(outerTop.x)} ${fmt(outerTop.y)}`,
    `A ${outerR} ${outerR} 0 1 1 ${fmt(outerBot.x)} ${fmt(outerBot.y)}`,
    `A ${outerR} ${outerR} 0 1 1 ${fmt(outerTop.x)} ${fmt(outerTop.y)}`,
    `M ${fmt(innerTop.x)} ${fmt(innerTop.y)}`,
    `A ${innerR} ${innerR} 0 1 0 ${fmt(innerBot.x)} ${fmt(innerBot.y)}`,
    `A ${innerR} ${innerR} 0 1 0 ${fmt(innerTop.x)} ${fmt(innerTop.y)}`,
    'Z',
  ].join(' ');
}

// ─── Individual slice path — uses useSliceSelector for snapshot-aware rendering ──

interface SlicePathProps {
  slice: TimeSlice;
  isInteractive: boolean;
  isSelected?: boolean;
  onSliceClick?: (id: string) => void;
  onSliceDoubleClick?: (id: string) => void;
}

function SlicePath({ slice, isInteractive, isSelected, onSliceClick, onSliceDoubleClick }: SlicePathProps) {
  // During drag, returns snapshot value for affected slices (snapshot-to-snapshot = no-op diff).
  const liveSlice = useSliceSelector(slice.id);
  const d = liveSlice ? slicePath(liveSlice) : slicePath(slice);

  const className = [
    isInteractive ? 'slice-path' : undefined,
    isSelected ? 'slice-path--selected' : undefined,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <path
      d={d}
      fill={slice.color}
      stroke="hsl(var(--border) / 0.4)"
      strokeWidth={1}
      className={className}
      data-slice-id={slice.id}
      role={isInteractive ? 'button' : undefined}
      aria-label={isInteractive ? (slice.label ? `${slice.label} 슬라이스` : '슬라이스') : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      style={{ cursor: isInteractive ? 'pointer' : 'default' }}
      onClick={isInteractive && onSliceClick ? () => onSliceClick(slice.id) : undefined}
      onDoubleClick={
        isInteractive && onSliceDoubleClick ? () => onSliceDoubleClick(slice.id) : undefined
      }
    />
  );
}

// ─── Store-connected wrapper that reads drag state ────────────────────────────
// Isolated component so that in 'view' mode the store is never touched.

interface InteractiveLayerProps {
  slices: TimeSlice[];
  backdropD: string;
  dragGroupRef: React.RefObject<SVGGElement | null>;
  onPointerDownHandle: (e: React.PointerEvent<SVGElement>, boundaryIndex: number) => void;
  onBackgroundClick: (e: React.MouseEvent<SVGElement>) => void;
  onSliceClick?: (id: string) => void;
  onSliceDoubleClick?: (id: string) => void;
  selectedSliceId?: string | null;
}

function InteractiveLayer({
  slices,
  backdropD,
  dragGroupRef,
  onPointerDownHandle,
  onBackgroundClick,
  onSliceClick,
  onSliceDoubleClick,
  selectedSliceId,
}: InteractiveLayerProps) {
  const isDraggingBoundary = useStoreSelector((s) => s.isDraggingBoundary);
  const dragRef = useStoreSelector((s) => s.dragRef);

  const draggingIds = isDraggingBoundary && dragRef ? dragRef.affectedSliceIds : null;
  const draggingSlices = draggingIds ? slices.filter((s) => draggingIds.has(s.id)) : [];
  const staticSlices = draggingIds ? slices.filter((s) => !draggingIds.has(s.id)) : slices;

  return (
    <>
      {/* Clickable backdrop for split */}
      <path
        d={backdropD}
        fill="transparent"
        fillRule="evenodd"
        stroke="none"
        style={{ cursor: 'crosshair' }}
        onClick={onBackgroundClick}
      />

      {/* Static slices */}
      <g className="slice-group">
        {staticSlices.map((slice) => (
          <SlicePath
            key={slice.id}
            slice={slice}
            isInteractive
            isSelected={selectedSliceId === slice.id}
            onSliceClick={onSliceClick}
            onSliceDoubleClick={onSliceDoubleClick}
          />
        ))}
      </g>

      {/* Live drag group — React reconciles by ref identity, not by d value */}
      <g ref={dragGroupRef} className="slice-group-drag">
        {draggingSlices.map((slice) => (
          <SlicePath
            key={slice.id}
            slice={slice}
            isInteractive
            isSelected={selectedSliceId === slice.id}
            onSliceClick={onSliceClick}
            onSliceDoubleClick={onSliceDoubleClick}
          />
        ))}
      </g>

      {/* Boundary handles */}
      {slices.length > 1 && (
        <BoundaryHandles slices={slices} onPointerDownHandle={onPointerDownHandle} />
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CircleTimeline({
  slices,
  mode = 'interactive',
  onSliceClick,
  onSliceDoubleClick,
  size,
  interactionMode = 'view',
  dragGroupRef,
  svgRef: svgRefProp,
  onRequestEdit,
  onPointerDownHandle,
  onBackgroundClick,
  showEmptyHint = false,
  selectedSliceId,
}: CircleTimelineProps) {
  const { cx, cy, innerR, outerR } = RING;

  // Fallback internal svg ref (if none passed — e.g. in view mode or tests)
  const internalSvgRef = useRef<SVGSVGElement | null>(null);
  const svgRef = svgRefProp ?? internalSvgRef;

  const isInteractive = mode === 'interactive' || interactionMode === 'interactive';

  const svgStyle: React.CSSProperties = size
    ? { width: size, height: size }
    : { width: '100%', height: '100%', maxWidth: '720px', aspectRatio: '1 / 1' };

  if (!isInteractive) {
    (svgStyle as React.CSSProperties).pointerEvents = 'none';
  }

  const backdropD = annulusPath(cx, cy, outerR, innerR);
  const handleDoubleClick = onRequestEdit ?? onSliceDoubleClick;

  // Live clock for the center hub overlay (HTML — excluded from SVG export)
  // Also drives the now-indicator angle (SVG, but export-excluded via data-export-exclude).
  const clock = useLiveClock();

  // Wrapper style for the relative-positioned container (always needed now for hub clock)
  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: svgStyle.width,
    height: svgStyle.height,
    ...(svgStyle.maxWidth ? { maxWidth: svgStyle.maxWidth } : {}),
    ...(svgStyle.aspectRatio ? { aspectRatio: svgStyle.aspectRatio } : {}),
  };

  // Hub is innerR=100 in a 1000×1000 viewBox. We convert to a percentage for
  // the HTML overlay so it scales with the SVG's rendered size.
  // Hub center = (500/1000, 500/1000) = (50%, 50%)
  // Hub radius in % of the SVG width = (100/1000)*100 = 10%
  // The clock overlay is a square of side 2*hubR% centered in the SVG.
  const hubPct = (innerR / 1000) * 100; // 10%

  const svgElement = (
    <svg
      ref={svgRef}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid meet"
      style={svgStyle}
      aria-label="24시간 원형 타임라인"
      role="img"
    >
      <defs>
        <filter id="glass-blur" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        {/* Hub glass filter — lighter blur for the small center disc */}
        <filter id="hub-glass-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <rect width="1000" height="1000" fill="none" />

      {/* Pizza backdrop: thick band from innerR=100 to outerR=460 */}
      <path
        d={backdropD}
        className="glass-ring-backdrop"
        fillRule="evenodd"
        filter="url(#glass-blur)"
        stroke="hsl(var(--border) / 0.4)"
        strokeWidth={1}
      />
      <path
        d={backdropD}
        fill="none"
        fillRule="evenodd"
        stroke="hsl(var(--border) / 0.5)"
        strokeWidth={1}
      />

      <HourTicks />

      {interactionMode === 'interactive' && dragGroupRef && onPointerDownHandle && onBackgroundClick ? (
        // Interactive mode: use store-connected layer
        <InteractiveLayer
          slices={slices}
          backdropD={backdropD}
          dragGroupRef={dragGroupRef}
          onPointerDownHandle={onPointerDownHandle}
          onBackgroundClick={onBackgroundClick}
          onSliceClick={onSliceClick}
          onSliceDoubleClick={handleDoubleClick}
          selectedSliceId={selectedSliceId}
        />
      ) : (
        // View/legacy mode: static slice group, no store access
        <g className="slice-group">
          {slices.map((slice) => (
            <path
              key={slice.id}
              d={slicePath(slice)}
              fill={slice.color}
              stroke="hsl(var(--border) / 0.4)"
              strokeWidth={1}
              data-slice-id={slice.id}
              style={{ cursor: isInteractive ? 'pointer' : 'default' }}
              onClick={isInteractive && onSliceClick ? () => onSliceClick(slice.id) : undefined}
              onDoubleClick={
                isInteractive && onSliceDoubleClick
                  ? () => onSliceDoubleClick(slice.id)
                  : undefined
              }
            />
          ))}
        </g>
      )}

      <g className="label-group">
        {slices.map((slice) => (
          <SliceLabel key={slice.id} slice={slice} />
        ))}
      </g>

      {/* Now-indicator: solid red line at current time angle.
          Tagged data-export-exclude="true" — stripped from PNG/PDF clone. */}
      <NowIndicator hhmm={clock.hhmm} />

      {/* Center hub glass disc — in SVG so it composites with slices correctly.
          The live clock text is NOT here; it's in the HTML overlay below so
          exports don't bake in a stale time value. */}
      <circle
        cx={cx}
        cy={cy}
        r={innerR}
        className="glass-hub-disc"
        filter="url(#hub-glass-blur)"
        stroke="hsl(var(--border) / 0.5)"
        strokeWidth={1.5}
      />
      {/* Hub rim accent ring */}
      <circle
        cx={cx}
        cy={cy}
        r={innerR}
        fill="none"
        stroke="hsl(var(--border) / 0.3)"
        strokeWidth={2}
      />
    </svg>
  );

  // The component always wraps in a relative div so the hub clock overlay
  // and (optionally) the empty-state hint can be absolutely positioned.
  return (
    <div style={wrapperStyle}>
      {svgElement}

      {/* Center hub live clock — HTML overlay, NOT inside SVG, excluded from export */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: `${50 - hubPct}%`,
          top: `${50 - hubPct}%`,
          width: `${hubPct * 2}%`,
          height: `${hubPct * 2}%`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: 'clamp(0.55rem, 1.4vw, 0.85rem)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            color: 'hsl(var(--foreground) / 0.85)',
            fontFamily: 'Pretendard, system-ui, sans-serif',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {clock.displayTime}
        </span>
        <span
          style={{
            fontSize: 'clamp(0.35rem, 0.8vw, 0.5rem)',
            fontWeight: 400,
            letterSpacing: '0.04em',
            lineHeight: 1.4,
            color: 'hsl(var(--text-muted) / 0.6)',
            fontFamily: 'Pretendard, system-ui, sans-serif',
            textTransform: 'uppercase',
            marginTop: '2px',
          }}
        >
          24H
        </span>
      </div>

      {/* Empty state hint — only when requested.
          Positioned in the lower wedge band (below the center hub clock at 40–60%)
          so it never overlaps the hub. */}
      {showEmptyHint && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '66%',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <p
            style={{
              fontSize: '0.875rem',
              color: 'hsl(var(--text-muted) / 0.7)',
              textAlign: 'center',
              padding: '0 2rem',
              maxWidth: '60%',
              fontFamily: 'Pretendard, system-ui, sans-serif',
            }}
          >
            프리셋을 선택하거나 빈 영역을 클릭해 시작하세요
          </p>
        </div>
      )}
    </div>
  );
}
