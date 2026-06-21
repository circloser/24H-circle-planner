import { useRef, useEffect, useState, useCallback } from 'react';
import type { TimeSlice } from '@/types/time-slice';
import { RING, polarToCartesian, slicePath, wrapText } from '@/lib/svg-geometry';
import { hhmmToAngle, angleToHhmm } from '@/lib/time-utils';
import { useSliceSelector, useStoreSelector } from '@/hooks/useScheduleStore';
import { useTranslation, useShowClock, useShowNowLine } from '@/hooks/usePreferences';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
import { translatePresetName } from '@/i18n/content';
import { SliceLabel } from './SliceLabel';
import { BoundaryHandles } from './BoundaryHandles';

// Convert a client (screen) point into the SVG's user-space coordinates, then to
// the polar angle from the ring centre. Mirrors useSliceInteraction so the cut
// preview snaps to the exact same time the click would split at.
function clientToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  if (typeof svg.getScreenCTM !== 'function' || typeof svg.createSVGPoint !== 'function') {
    return { x: clientX, y: clientY };
  }
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(ctm.inverse());
}

function svgPointToAngleDeg(x: number, y: number): number {
  return (Math.atan2(y - RING.cy, x - RING.cx) * 180) / Math.PI;
}

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
  /** Called on a slice-body click (desktop cut mode) to split at the cursor. */
  onSliceSplit?: (e: React.MouseEvent<SVGElement>) => void;
  /** Schedule title shown in the center hub (SVG text — appears in PNG/PDF export). */
  title?: string;
  /** Called when the center hub is clicked (interactive mode) — opens the title editor. */
  onHubClick?: () => void;
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
    // `new Date()` and getHours/getMinutes resolve in the browser's local time
    // zone (the visitor's region), so the hour hand / now-line track local time
    // automatically — no manual offset needed for a web deployment.
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const hhmm = `${hh}:${mm}`;
    // Display in the visitor's locale, 24h format (no hard-coded ko-KR).
    const displayTime = now.toLocaleTimeString(undefined, {
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
        fontSize={isCardinal ? 30 : 20}
        fontWeight={isCardinal ? 800 : 700}
        fill={
          isCardinal
            ? 'hsl(var(--foreground) / 0.95)'
            : 'hsl(var(--foreground) / 0.7)'
        }
        fontFamily="inherit"
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
  /** Cut mode (desktop): scissors cursor + click splits at the cursor position. */
  cutMode?: boolean;
  onSliceClick?: (id: string) => void;
  onSliceDoubleClick?: (id: string) => void;
  onSliceSplit?: (e: React.MouseEvent<SVGElement>) => void;
  onSliceHover?: (e: React.PointerEvent<SVGElement>) => void;
  onSliceLeave?: () => void;
}

function SlicePath({
  slice,
  isInteractive,
  isSelected,
  cutMode,
  onSliceClick,
  onSliceDoubleClick,
  onSliceSplit,
  onSliceHover,
  onSliceLeave,
}: SlicePathProps) {
  // During drag, returns snapshot value for affected slices (snapshot-to-snapshot = no-op diff).
  const liveSlice = useSliceSelector(slice.id);
  const d = liveSlice ? slicePath(liveSlice) : slicePath(slice);

  const className = [
    isInteractive ? 'slice-path' : undefined,
    isSelected ? 'slice-path--selected' : undefined,
    isInteractive && cutMode ? 'slice-cut' : undefined,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  // Cut mode: a single click splits at the cursor. Otherwise fall back to the
  // tap-to-edit path (onSliceClick) used on touch.
  const handleClick =
    isInteractive && cutMode && onSliceSplit
      ? onSliceSplit
      : isInteractive && onSliceClick
        ? () => onSliceClick(slice.id)
        : undefined;

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
      // The scissors cursor comes from the .slice-cut class; don't override it.
      style={{ cursor: isInteractive && !cutMode ? 'pointer' : undefined }}
      onClick={handleClick}
      onDoubleClick={
        isInteractive && onSliceDoubleClick ? () => onSliceDoubleClick(slice.id) : undefined
      }
      onPointerMove={isInteractive && cutMode ? onSliceHover : undefined}
      onPointerLeave={isInteractive && cutMode ? onSliceLeave : undefined}
    />
  );
}

// ─── Store-connected wrapper that reads drag state ────────────────────────────
// Isolated component so that in 'view' mode the store is never touched.

interface InteractiveLayerProps {
  slices: TimeSlice[];
  backdropD: string;
  dragGroupRef: React.RefObject<SVGGElement | null>;
  onBackgroundClick: (e: React.MouseEvent<SVGElement>) => void;
  onSliceClick?: (id: string) => void;
  onSliceDoubleClick?: (id: string) => void;
  onSliceSplit?: (e: React.MouseEvent<SVGElement>) => void;
  onSliceHover?: (e: React.PointerEvent<SVGElement>) => void;
  onSliceLeave?: () => void;
  cutMode?: boolean;
  selectedSliceId?: string | null;
}

function InteractiveLayer({
  slices,
  backdropD,
  dragGroupRef,
  onBackgroundClick,
  onSliceClick,
  onSliceDoubleClick,
  onSliceSplit,
  onSliceHover,
  onSliceLeave,
  cutMode,
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
            cutMode={cutMode}
            onSliceClick={onSliceClick}
            onSliceDoubleClick={onSliceDoubleClick}
            onSliceSplit={onSliceSplit}
            onSliceHover={onSliceHover}
            onSliceLeave={onSliceLeave}
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
            cutMode={cutMode}
            onSliceClick={onSliceClick}
            onSliceDoubleClick={onSliceDoubleClick}
            onSliceSplit={onSliceSplit}
            onSliceHover={onSliceHover}
            onSliceLeave={onSliceLeave}
          />
        ))}
      </g>

      {/* Boundary handles are rendered by CircleTimeline AFTER the label group
          (above this layer) so the hover +/− buttons are never hidden behind
          slice icons/labels. */}
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
  onSliceSplit,
  showEmptyHint = false,
  selectedSliceId,
  title,
  onHubClick,
}: CircleTimelineProps) {
  const { cx, cy, innerR, outerR } = RING;
  const { t, lang } = useTranslation();
  const showClock = useShowClock();
  const showNowLine = useShowNowLine();
  // On touch, double-click/double-tap to edit is awkward, so a single tap opens
  // the editor instead. (Boundary handles sit on top, so taps near a division
  // still hit the boundary first — see BoundaryHandles.)
  const coarse = useCoarsePointer();

  // Center hub title — wrapped to fill the circular space (up to 2 lines)
  // instead of hard-truncating to a few characters.
  const titleLines = title ? wrapText(translatePresetName(title, lang), 14, 2) : [];
  const titleFontSize = titleLines.length > 1 ? 21 : 26;

  // Fallback internal svg ref (if none passed — e.g. in view mode or tests)
  const internalSvgRef = useRef<SVGSVGElement | null>(null);
  const svgRef = svgRefProp ?? internalSvgRef;

  // Cut preview: a faint dashed line showing where a scissors-click would split.
  // Updated imperatively on hover (no React re-render per mousemove).
  const cutPreviewRef = useRef<SVGLineElement>(null);
  const showCutPreview = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      const svg = svgRef.current;
      const line = cutPreviewRef.current;
      if (!svg || !line) return;
      const { x, y } = clientToSvgPoint(svg, e.clientX, e.clientY);
      const ang = hhmmToAngle(angleToHhmm(svgPointToAngleDeg(x, y)));
      const inner = polarToCartesian(RING.cx, RING.cy, RING.innerR, ang);
      const outer = polarToCartesian(RING.cx, RING.cy, RING.outerR, ang);
      line.setAttribute('x1', String(inner.x));
      line.setAttribute('y1', String(inner.y));
      line.setAttribute('x2', String(outer.x));
      line.setAttribute('y2', String(outer.y));
      line.style.opacity = '1';
    },
    [svgRef],
  );
  const hideCutPreview = useCallback(() => {
    if (cutPreviewRef.current) cutPreviewRef.current.style.opacity = '0';
  }, []);

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

  // The viewBox is padded by VB_MARGIN on every side so the bold hour labels
  // (00–23) outside the rim are never clipped. Content coords are unchanged
  // (cx=cy=500); the padded box just adds breathing room.
  const VB_MARGIN = 36;
  const VB_SIZE = 1000 + VB_MARGIN * 2; // 1072

  // Hub HTML-overlay sizing: (500,500) still maps to 50%/50% of the padded box.
  // Hub radius as a fraction of the rendered width = innerR / VB_SIZE.
  const hubPct = (innerR / VB_SIZE) * 100;

  const svgElement = (
    <svg
      ref={svgRef}
      viewBox={`${-VB_MARGIN} ${-VB_MARGIN} ${VB_SIZE} ${VB_SIZE}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        ...svgStyle,
        // Chart text inherits the user-selected font; children use fontFamily="inherit".
        fontFamily: 'var(--app-font-family, Pretendard), Pretendard, system-ui, sans-serif',
      }}
      aria-label={t('circle.ariaTimeline')}
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
          onBackgroundClick={onBackgroundClick}
          onSliceClick={coarse ? handleDoubleClick : onSliceClick}
          onSliceDoubleClick={handleDoubleClick}
          onSliceSplit={onSliceSplit}
          onSliceHover={!coarse ? showCutPreview : undefined}
          onSliceLeave={!coarse ? hideCutPreview : undefined}
          cutMode={!coarse}
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

      {/* Cut preview line — shows where a scissors-click would split. Driven
          imperatively by showCutPreview/hideCutPreview; excluded from export. */}
      {interactionMode === 'interactive' && !coarse ? (
        <line
          ref={cutPreviewRef}
          className="cut-preview"
          data-export-exclude="true"
          x1={cx}
          y1={cy}
          x2={cx}
          y2={cy}
          style={{ opacity: 0, pointerEvents: 'none' }}
        />
      ) : null}

      <g className="label-group">
        {slices.map((slice) => (
          <SliceLabel
            key={slice.id}
            slice={slice}
            onEdit={isInteractive ? handleDoubleClick : undefined}
          />
        ))}
      </g>

      {/* Boundary handles ON TOP of labels — so hover +/− buttons aren't hidden
          behind slice icons. Interactive mode only. */}
      {isInteractive && slices.length > 1 && onPointerDownHandle ? (
        <BoundaryHandles slices={slices} onPointerDownHandle={onPointerDownHandle} />
      ) : null}

      {/* Now-indicator: solid red line at current time angle. Toggleable.
          Tagged data-export-exclude="true" — stripped from PNG/PDF clone. */}
      {showNowLine ? <NowIndicator hhmm={clock.hhmm} /> : null}

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
        style={isInteractive && onHubClick ? { cursor: 'pointer' } : undefined}
        onClick={
          isInteractive && onHubClick
            ? (e) => {
                e.stopPropagation();
                onHubClick();
              }
            : undefined
        }
      />
      {/* Hub rim accent ring */}
      <circle
        cx={cx}
        cy={cy}
        r={innerR}
        fill="none"
        stroke="hsl(var(--border) / 0.3)"
        strokeWidth={2}
        style={{ pointerEvents: 'none' }}
      />
      {/* Schedule title — SVG text so it appears in PNG/PDF export (unlike the
          live clock, which is an HTML overlay and is excluded from export). */}
      {titleLines.length > 0 ? (
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={titleFontSize}
          fontWeight={600}
          fill="hsl(var(--foreground) / 0.9)"
          fontFamily="inherit"
          style={{ pointerEvents: 'none' }}
        >
          {titleLines.map((ln, i) => (
            <tspan
              key={i}
              x={cx}
              dy={i === 0 ? `${(-(titleLines.length - 1) / 2) * 1.12}em` : '1.12em'}
            >
              {ln}
            </tspan>
          ))}
        </text>
      ) : null}
    </svg>
  );

  // The component always wraps in a relative div so the hub clock overlay
  // and (optionally) the empty-state hint can be absolutely positioned.
  return (
    <div style={wrapperStyle}>
      {svgElement}

      {/* Center hub live current time — HTML overlay (excluded from export).
          Sits below the SVG title so exports show the title, not a stale clock.
          Toggleable via the clock setting. */}
      {showClock && (
      <div
        aria-hidden="true"
        data-clock="true"
        style={{
          position: 'absolute',
          left: `${50 - hubPct}%`,
          top: `${50 - hubPct}%`,
          width: `${hubPct * 2}%`,
          height: `${hubPct * 2}%`,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          paddingBottom: '16%',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: 'clamp(0.4rem, 1vw, 0.62rem)',
            fontWeight: 500,
            letterSpacing: '0.01em',
            lineHeight: 1,
            color: 'hsl(var(--text-muted) / 0.8)',
            fontFamily: 'Pretendard, system-ui, sans-serif',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {clock.displayTime}
        </span>
      </div>
      )}

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
            {t('circle.emptyHint')}
          </p>
        </div>
      )}
    </div>
  );
}
