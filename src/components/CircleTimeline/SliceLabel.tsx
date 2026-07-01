import type { TimeSlice } from '@/types/time-slice';
import { sliceWidthMinutes } from '@/lib/time-utils';
import {
  labelAnchorInside,
  labelAnchorOutside,
  truncateLabel,
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
  /** Kept for caller compatibility; labels no longer stagger (they sit on one ring). */
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
export function SliceLabel({ slice, onEdit, spec = FULL_SPEC }: SliceLabelProps) {
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
  // Labels sit on ONE clean circle (no radial staggering). To keep adjacent
  // labels from colliding we FIT each inside label within its own wedge's
  // tangential arc by SHRINKING the font — the text itself is NEVER abbreviated
  // (no "…"). Only when a wedge is too small even for the minimum font do we
  // pull the label OUTSIDE with a leader line.
  const AUTO_OUTSIDE = 16; // wedge width (min) below which the label goes outside
  const forceOutside = textPosition === 'inside' && widthMin < AUTO_OUTSIDE;
  const isInside = textPosition === 'inside' && !forceOutside;

  // Inherit the user-selected font from the SVG root; scale label text size by
  // the font-scale preference (icons stay fixed-size emoji).
  const fontFamily = 'inherit';
  const labelFontSize = (px: number) => ({ fontSize: `calc(var(--app-font-scale, 1) * ${px}px)` });
  const { lang } = useTranslation();
  const localized = translateLabel(label, lang);
  // Tangential space available at the label radius. labelAnchorInside places the
  // text at midR = innerR + band*0.55 ≈ 298; the wedge's arc length there is
  // proportional to its minute-width. Shrink the font until the whole name fits
  // that arc — never truncate.
  const LABEL_R = 298;
  const BASE_FONT = 22;
  const MIN_FONT = 12;
  const isCjk = (ch: string) =>
    /[ᄀ-ᇿ㄰-㆏가-힣぀-ヿ一-鿿]/.test(ch);
  const estWidth = (text: string, font: number) => {
    let w = 0;
    for (const ch of text) w += (isCjk(ch) ? 0.98 : 0.55) * font;
    return w;
  };
  const arc = (2 * Math.PI * LABEL_R * widthMin) / 1440;
  let textPx = BASE_FONT;
  if (isInside) {
    const fullW = estWidth(localized, BASE_FONT);
    if (fullW > arc) textPx = Math.max(MIN_FONT, Math.round((BASE_FONT * arc) / fullW));
  }
  const narrow = isInside && textPx < BASE_FONT;
  // "크기가 작아지면 아이콘 숨김": a wedge too narrow for a 38px icon to sit in
  // drops the icon so the NAME owns the whole wedge. Icons return once the wedge
  // is wide again.
  const SMALL_MIN = 30; // below ~30 min the 38px icon exceeds the wedge arc
  const showIcon = !!icon && widthMin >= SMALL_MIN;
  // Outside callouts (tiny slices) keep a hard cap so the page text stays short;
  // inside labels are shown in FULL (only the font shrinks, per the request).
  const outsideText = truncateLabel(localized, 12, 24);

  // Per-slice text styling over readable defaults. Inside labels auto-pick
  // black/white from the slice's luminance; outside labels keep the dark tone.
  const insideFill = slice.textColor || idealTextColor(slice.color);
  const outsideFill = slice.textColor || LABEL_TEXT_DEFAULT;
  const fontWeight = slice.bold ? 700 : 400;
  const fontStyle = slice.italic ? 'italic' : 'normal';

  if (isInside) {
    const { x, y } = labelAnchorInside(slice, undefined, spec);
    // Centre edit zone: a single click here opens the editor (text cursor), even
    // when the slice is empty. The slice body OUTSIDE it keeps the scissors cut
    // cursor. Smaller on narrow wedges so it doesn't bleed into neighbours.
    const hitR = narrow ? 24 : 38;
    const iconY = -20;
    const textY = showIcon ? 14 : 0;

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
        {showIcon ? (
          <text
            x={0}
            y={iconY}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={38}
            fontFamily={fontFamily}
          >
            {icon}
          </text>
        ) : null}
        {localized ? (
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
            {localized}
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
      {showIcon ? (
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
      {outsideText ? (
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
          {outsideText}
        </text>
      ) : null}
    </g>
  );
}
