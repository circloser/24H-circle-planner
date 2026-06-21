import type { TimeSlice } from '@/types/time-slice';
import { sliceWidthMinutes } from '@/lib/time-utils';
import {
  labelAnchorInside,
  labelAnchorOutside,
  truncateLabel,
} from '@/lib/svg-geometry';
import { idealTextColor, DARK_TEXT } from '@/lib/contrast';
import { useTranslation, useShowIcons } from '@/hooks/usePreferences';
import { useCoarsePointer } from '@/hooks/useCoarsePointer';
import { translateLabel } from '@/i18n/content';

interface SliceLabelProps {
  slice: TimeSlice;
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
export function SliceLabel({ slice }: SliceLabelProps) {
  const { textPosition, label, icon: rawIcon } = slice;
  // Global "show icons" toggle — when off, every icon below renders as empty so
  // the chart shows text-only labels (and narrow icon-only slices show nothing).
  const showIcons = useShowIcons();
  const icon = showIcons ? rawIcon : '';
  // On desktop the label captures the pointer so the slice's scissors/cut cursor
  // and click-to-split are excluded over the "naming part". On touch it stays
  // click-through so tapping the name still opens the editor.
  const coarse = useCoarsePointer();
  const labelStyle: React.CSSProperties = {
    pointerEvents: coarse ? 'none' : 'auto',
    userSelect: 'none',
    cursor: coarse ? undefined : 'default',
  };
  const widthMin = sliceWidthMinutes(slice);
  // tooNarrow threshold: < 40 min means we only show the icon (no text label).
  // Increased from 30 to 40 because the larger font (22px text + 38px icon)
  // needs more angular space to avoid overflowing the wedge band.
  const tooNarrow = widthMin < 40 && textPosition === 'inside';

  // Inherit the user-selected font from the SVG root; scale label text size by
  // the font-scale preference (icons stay fixed-size emoji).
  const fontFamily = 'inherit';
  const labelFontSize = (px: number) => ({ fontSize: `calc(var(--app-font-scale, 1) * ${px}px)` });
  const { lang } = useTranslation();
  const truncated = truncateLabel(translateLabel(label, lang));

  // Per-slice text styling over readable defaults. Inside labels auto-pick
  // black/white from the slice's luminance; outside labels keep the dark tone.
  const insideFill = slice.textColor || idealTextColor(slice.color);
  const outsideFill = slice.textColor || LABEL_TEXT_DEFAULT;
  const fontWeight = slice.bold ? 700 : 400;
  const fontStyle = slice.italic ? 'italic' : 'normal';

  if (textPosition === 'inside') {
    const { x, y } = labelAnchorInside(slice);

    if (tooNarrow) {
      // Icon only — no text. Threshold is slice < 30 min; use larger icon size.
      if (!icon) return null;
      return (
        <text
          data-label-id={slice.id}
          data-label-kind="inside-narrow"
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={32}
          fontFamily={fontFamily}
          style={labelStyle}
        >
          {icon}
        </text>
      );
    }

    // Positioned via `transform` (children at relative offsets) so the boundary
    // drag engine can re-anchor the whole label by updating one attribute —
    // keeping the label tracking its wedge centroid live during a drag.
    return (
      <g
        data-label-id={slice.id}
        data-label-kind="inside"
        transform={`translate(${x} ${y})`}
        style={labelStyle}
      >
        {icon ? (
          <text
            x={0}
            y={-20}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={38}
            fontFamily={fontFamily}
          >
            {icon}
          </text>
        ) : null}
        {truncated ? (
          <text
            x={0}
            y={icon ? 14 : 0}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={fontFamily}
            fontWeight={fontWeight}
            fontStyle={fontStyle}
            fill={insideFill}
            style={labelFontSize(22)}
          >
            {truncated}
          </text>
        ) : null}
      </g>
    );
  }

  // Outside label
  const { x, y, leader } = labelAnchorOutside(slice);
  const [leaderStart, leaderEnd] = leader;

  return (
    <g
      data-label-id={slice.id}
      data-label-kind="outside"
      style={labelStyle}
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
