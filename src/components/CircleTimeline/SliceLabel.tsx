import type { TimeSlice } from '@/types/time-slice';
import { sliceWidthMinutes } from '@/lib/time-utils';
import {
  labelAnchorInside,
  labelAnchorOutside,
  truncateLabel,
  labelRadialOffset,
} from '@/lib/svg-geometry';
import { FULL_SPEC, type ViewSpec } from '@/lib/chart-view';
import { idealTextColor, DARK_TEXT } from '@/lib/contrast';
import { useTranslation, useShowIcons } from '@/hooks/usePreferences';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
import { translateLabel } from '@/i18n/content';

interface SliceLabelProps {
  slice: TimeSlice;
  /** Click the label (the "naming part") to open the editor — desktop only. */
  onEdit?: (id: string) => void;
  /** Active view window — positions the label under the 12h clock remap. */
  spec?: ViewSpec;
  /** Position among the rendered labels — drives radial staggering of narrow slices. */
  index?: number;
}

// Outside labels sit on the page (beyond the ring), so they keep a fixed dark
// tone. Inside labels sit ON the slice colour, so their default flips between
// dark and white by the slice's luminance (idealTextColor). A per-slice
// `textColor` always overrides whichever default applies.
const LABEL_TEXT_DEFAULT = DARK_TEXT;

/**
 * Renders the label (icon + text) for one slice.
 * - Uses pure SVG <text> elements only — no <foreignObject>.
 * - Inside mode: places icon + text at the centroid of the slice.
 * - Outside mode: renders a leader line and horizontal text beyond the ring.
 * - Skips rendering for slices < 30 min when textPosition === 'inside'
 *   (too narrow); falls back to icon-only.
 */
export function SliceLabel({ slice, onEdit, spec = FULL_SPEC, index = 0 }: SliceLabelProps) {
  const { textPosition, label, icon: rawIcon } = slice;
  // Global "show icons" toggle — when off, every icon below renders as empty so
  // the chart shows text-only labels (and narrow icon-only slices show nothing).
  const showIcons = useShowIcons();
  const icon = showIcons ? rawIcon : '';
  // On desktop the label captures the pointer so the slice's scissors/cut cursor
  // and click-to-split are excluded over the "naming part", and a click on the
  // name opens the editor. On touch it stays click-through so tapping the name
  // still hits the slice (tap-to-edit).
  const coarse = useCoarsePointer();
  const labelStyle: React.CSSProperties = {
    pointerEvents: coarse ? 'none' : 'auto',
    userSelect: 'none',
    // Text/I-beam cursor over the centre so it reads as "click to edit content".
    cursor: coarse ? undefined : onEdit ? 'text' : 'default',
  };
  const onLabelClick =
    !coarse && onEdit
      ? (e: React.MouseEvent) => {
          e.stopPropagation();
          onEdit(slice.id);
        }
      : undefined;
  const widthMin = sliceWidthMinutes(slice);
  // Adaptive label sizing so narrow slices stay READABLE instead of hiding text:
  //  - width ≥ NARROW            → full-size inside label
  //  - AUTO_OUTSIDE ≤ w < NARROW → inside, but font + icon shrink to fit
  //  - width < AUTO_OUTSIDE      → too small to fit inside → pull the text OUT
  //                                with a leader line (even if it's an inside label)
  const NARROW = 40;
  const AUTO_OUTSIDE = 18;
  const forceOutside = textPosition === 'inside' && widthMin < AUTO_OUTSIDE;
  const isInside = textPosition === 'inside' && !forceOutside;
  const narrow = isInside && widthMin < NARROW;
  // 0 at AUTO_OUTSIDE → 1 at NARROW, driving how much to shrink.
  const shrinkT = Math.max(0, Math.min(1, (widthMin - AUTO_OUTSIDE) / (NARROW - AUTO_OUTSIDE)));
  const textPx = narrow ? Math.round(13 + shrinkT * (22 - 13)) : 22;
  const iconPx = narrow ? Math.round(24 + shrinkT * (38 - 24)) : 38;

  // Inherit the user-selected font from the SVG root; scale label text size by
  // the font-scale preference (icons stay fixed-size emoji).
  const fontFamily = 'inherit';
  const labelFontSize = (px: number) => ({ fontSize: `calc(var(--app-font-scale, 1) * ${px}px)` });
  const { lang } = useTranslation();
  // Narrow inside labels get fewer characters so the shrunk text still fits.
  const truncated = truncateLabel(translateLabel(label, lang), narrow ? 6 : 12, narrow ? 12 : 24);

  // Per-slice text styling over readable defaults. Inside labels auto-pick
  // black/white from the slice's luminance; outside labels keep the dark tone.
  const insideFill = slice.textColor || idealTextColor(slice.color);
  const outsideFill = slice.textColor || LABEL_TEXT_DEFAULT;
  const fontWeight = slice.bold ? 700 : 400;
  const fontStyle = slice.italic ? 'italic' : 'normal';

  if (isInside) {
    const { x, y } = labelAnchorInside(slice, undefined, spec, labelRadialOffset(slice, index));
    // Centre edit zone: a single click here opens the editor (text cursor), even
    // when the slice is empty. The slice body OUTSIDE it keeps the scissors cut
    // cursor. Smaller on narrow wedges so it doesn't bleed into neighbours.
    const hitR = narrow ? 24 : 38;
    const iconY = narrow ? -12 : -20;
    const textY = icon ? (narrow ? 12 : 14) : 0;

    // Positioned via `transform` (children at relative offsets) so the boundary
    // drag engine can re-anchor the whole label by updating one attribute —
    // keeping the label tracking its wedge centroid live during a drag.
    return (
      <g
        data-label-id={slice.id}
        data-label-kind="inside"
        transform={`translate(${x} ${y})`}
        style={labelStyle}
        onClick={onLabelClick}
        onDoubleClick={onLabelClick}
      >
        <circle cx={0} cy={0} r={hitR} fill="transparent" />
        {icon ? (
          <text
            x={0}
            y={iconY}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={iconPx}
            fontFamily={fontFamily}
          >
            {icon}
          </text>
        ) : null}
        {truncated ? (
          <text
            x={0}
            y={textY}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={fontFamily}
            fontWeight={fontWeight}
            fontStyle={fontStyle}
            fill={insideFill}
            style={labelFontSize(textPx)}
          >
            {truncated}
          </text>
        ) : null}
      </g>
    );
  }

  // Outside label
  const { x, y, leader } = labelAnchorOutside(slice, undefined, spec);
  const [leaderStart, leaderEnd] = leader;

  return (
    <g
      data-label-id={slice.id}
      data-label-kind="outside"
      style={labelStyle}
      onClick={onLabelClick}
    >
      <line
        x1={leaderStart.x}
        y1={leaderStart.y}
        x2={leaderEnd.x}
        y2={leaderEnd.y}
        stroke="hsl(var(--text-muted) / 0.7)"
        strokeWidth={1}
      />
      {icon ? (
        <text
          x={leaderEnd.x}
          y={leaderEnd.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={30}
          fontFamily={fontFamily}
        >
          {icon}
        </text>
      ) : null}
      {truncated ? (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={fontFamily}
          fontWeight={fontWeight}
          fontStyle={fontStyle}
          fill={outsideFill}
          style={labelFontSize(20)}
        >
          {truncated}
        </text>
      ) : null}
    </g>
  );
}
