import type { TimeSlice } from '@/types/time-slice';
import { sliceWidthMinutes } from '@/lib/time-utils';
import {
  labelAnchorInside,
  labelAnchorOutside,
  truncateLabel,
} from '@/lib/svg-geometry';
import { useTranslation, useShowIcons } from '@/hooks/usePreferences';
import { translateLabel } from '@/i18n/content';

interface SliceLabelProps {
  slice: TimeSlice;
}

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

  if (textPosition === 'inside') {
    const { x, y } = labelAnchorInside(slice);

    if (tooNarrow) {
      // Icon only — no text. Threshold is slice < 30 min; use larger icon size.
      if (!icon) return null;
      return (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={32}
          fontFamily={fontFamily}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {icon}
        </text>
      );
    }

    return (
      <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {icon ? (
          <text
            x={x}
            y={y - 20}
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
            x={x}
            y={icon ? y + 14 : y}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={fontFamily}
            fill="currentColor"
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
    <g style={{ pointerEvents: 'none', userSelect: 'none' }}>
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
          fill="currentColor"
          style={labelFontSize(20)}
        >
          {truncated}
        </text>
      ) : null}
    </g>
  );
}
