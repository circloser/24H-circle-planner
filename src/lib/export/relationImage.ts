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
import { ME_R, initialsOf, layoutRelation, xyOf } from '../relation-layout';

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

  // Guide rings. Transparency is set on the context rather than mixed into
  // the colour, because the page's ink arrives as whatever CSS said it was.
  ctx.lineWidth = Math.max(1, size / 1400);
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.06;
  for (const ring of layout.rings) {
    ctx.beginPath();
    ctx.arc(middle, middle, ring.d * scale, 0, Math.PI * 2);
    ctx.stroke();
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

  const face = (name: string, photo: string | undefined, cx: number, cy: number, r: number) => {
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
    const letters = initialsOf(name);
    if (!letters) return;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = ink;
    ctx.font = `${Math.round(r * 0.8)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letters, cx, cy);
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
  face(data.me.name || input.meLabel, data.me.photo, middle, middle, meR);

  // Everyone else, with every name written.
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
    if (r > size / 120) face(n.person.name, n.person.photo, p.x, p.y, r);
    ctx.globalAlpha = 0.7 * alpha;
    ctx.fillStyle = ink;
    ctx.font = `${Math.round(size / 96)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(n.person.name, p.x, p.y + r + size / 200);
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
