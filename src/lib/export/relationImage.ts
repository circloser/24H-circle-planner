/**
 * The relation map as a picture.
 *
 * Drawn from the data rather than screenshotted, so it comes out at whatever
 * size is asked for and always with every name written — the map on screen
 * hides some of them at low zoom, but a picture has no zoom.
 *
 * The page's own background is used, and nothing is added but a small
 * wordmark: what is exported should look like the page it came from.
 */
import { contactFade, hasBirthdaySoon, type RelationData, type RelationGroup } from '../relation';
import { ME_R, layoutRelation, xyOf } from '../relation-layout';
import { NAME_SIZE, nameBox } from '../relation-name';

const TAU = Math.PI * 2;

export interface RelationImageInput {
  data: RelationData;
  colors: Record<RelationGroup, string>;
  today: string;
  /** Page background and ink, already resolved to real colours. */
  background: string;
  ink: string;
  accent: string;
  /** The word in the middle when no name is given. */
  meLabel: string;
  /** Faces, already loaded. */
  photos?: Record<string, CanvasImageSource | null>;
  /** The line under the picture, already translated. */
  caption?: string;
  /** What each group is called, written once on its own boundary. */
  groupLabel?: Record<RelationGroup, string>;
}

/** The widest edge of the exported picture. */
export const RELATION_IMAGE_SIZE = 2160;

/** Room around the outermost ring, as a share of the picture. */
const MARGIN = 0.09;

/**
 * Draw the whole map onto `ctx`, filling a square of `size` pixels. Exported
 * on its own so a test can draw onto a stub context and read back what was
 * asked for.
 */
export function drawRelation(ctx: CanvasRenderingContext2D, input: RelationImageInput, size = RELATION_IMAGE_SIZE): void {
  const { data, colors, today, ink, accent } = input;
  const layout = layoutRelation(data.people);
  const middle = size / 2;
  const scale = (size / 2) * (1 - MARGIN * 2) / Math.max(layout.extent, 1);
  const at = (x: number, y: number) => ({ x: middle + x * scale, y: middle + y * scale });

  ctx.globalAlpha = 1;
  ctx.fillStyle = input.background;
  ctx.fillRect(0, 0, size, size);

  // The boundary round each group, exactly as the page draws it: the picture
  // should be the map, not a diagram of the same data.
  ctx.lineWidth = Math.max(1, size / 1400);
  for (const b of layout.bounds) {
    const whole = b.span >= 1;
    const from = b.from * TAU - Math.PI / 2;
    const to = (b.from + b.span) * TAU - Math.PI / 2;
    const outer = Math.max(1, b.outer * scale);
    const inner = Math.max(0, b.inner * scale);
    ctx.beginPath();
    if (whole) {
      ctx.arc(middle, middle, outer, 0, TAU);
      ctx.arc(middle, middle, inner, 0, TAU, true);
    } else {
      ctx.arc(middle, middle, outer, from, to);
      ctx.arc(middle, middle, inner, to, from, true);
      ctx.closePath();
    }
    ctx.fillStyle = colors[b.group];
    ctx.globalAlpha = 0.055;
    ctx.fill();
    ctx.strokeStyle = colors[b.group];
    ctx.globalAlpha = 0.22;
    ctx.setLineDash([size / 400, size / 260]);
    ctx.stroke();
    ctx.setLineDash([]);
    const label = input.groupLabel?.[b.group];
    if (label) {
      const mid = whole ? -Math.PI / 2 : (b.from + b.span / 2) * TAU - Math.PI / 2;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = colors[b.group];
      ctx.font = `${Math.round(size / 110)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, middle + Math.cos(mid) * (outer + size / 150), middle + Math.sin(mid) * (outer + size / 150));
    }
  }

  const place = new Map(layout.nodes.map((n) => [n.person.id, n]));

  // Me to each person.
  ctx.strokeStyle = ink;
  for (const n of layout.nodes) {
    const p = at(xyOf(n).x, xyOf(n).y);
    ctx.beginPath();
    ctx.moveTo(middle, middle);
    ctx.lineTo(p.x, p.y);
    ctx.globalAlpha = 0.4 * contactFade(n.person, today);
    ctx.stroke();
  }

  // Person to person.
  ctx.setLineDash([size / 270, size / 270]);
  ctx.globalAlpha = 0.25;
  for (const link of data.links) {
    const a = place.get(link.source);
    const b = place.get(link.target);
    if (!a || !b) continue;
    const pa = at(xyOf(a).x, xyOf(a).y);
    const pb = at(xyOf(b).x, xyOf(b).y);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  /** A face, or the name itself written across the circle it belongs to. */
  const face = (
    name: string, photo: string | undefined, cx: number, cy: number, r: number,
    /** The same circle in layout units, which is what the name was fitted to. */
    unit: number,
    lines?: readonly string[],
  ) => {
    const img = photo ? input.photos?.[photo] : null;
    if (img) {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      return;
    }
    const rows = lines?.length ? lines : nameBox(name, unit).lines;
    if (!rows.length || unit <= 0) return;
    const font = NAME_SIZE * (r / unit);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = ink;
    ctx.font = `${font}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const step = font * 1.15;
    const top = cy - ((rows.length - 1) * step) / 2;
    rows.forEach((row, i) => ctx.fillText(row, cx, top + i * step));
  };

  // Me.
  const meR = ME_R * scale;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(middle, middle, meR, 0, Math.PI * 2);
  ctx.fillStyle = input.background;
  ctx.fill();
  ctx.lineWidth = Math.max(2, size / 900);
  ctx.strokeStyle = ink;
  ctx.stroke();
  face(data.me.name || input.meLabel, data.me.photo, middle, middle, meR, ME_R);

  // Everyone else, with every name written inside their own circle.
  for (const n of layout.nodes) {
    const p = at(xyOf(n).x, xyOf(n).y);
    const r = n.r * scale;
    const alpha = contactFade(n.person, today);
    if (hasBirthdaySoon(n.person, today)) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + size / 480, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(1, size / 1600);
      ctx.strokeStyle = accent;
      ctx.globalAlpha = alpha;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = input.background;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, size / 1200);
    ctx.strokeStyle = colors[n.person.group];
    ctx.globalAlpha = alpha;
    ctx.stroke();
    ctx.globalAlpha = alpha;
    face(n.person.name, n.person.photo, p.x, p.y, r, n.r, n.lines);
  }

  // The line under it, and where it came from.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ink;
  if (input.caption) {
    ctx.globalAlpha = 0.6;
    ctx.font = `${Math.round(size / 78)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(input.caption, middle, size - size / 26);
  }
  ctx.globalAlpha = 0.35;
  ctx.font = `${Math.round(size / 110)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText('24Houring', middle, size - size / 60);
  ctx.globalAlpha = 1;
}

/** The map as a PNG blob. */
export async function relationImage(input: RelationImageInput, size = RELATION_IMAGE_SIZE): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  drawRelation(ctx, input, size);
  return new Promise((done) => canvas.toBlob((b) => done(b), 'image/png'));
}
