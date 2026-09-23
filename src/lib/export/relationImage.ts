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
import { settle, tiesOf, type Body } from '../relation-force';
import { boundaryOf, drawBoundary } from '../relation-hull';
import { NAME_SIZE, nameBox } from '../relation-name';

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
  // The picture is the map, so it is settled by the same forces the page runs
  // (lib/relation-force) from the same seed — which is deterministic, so what
  // is saved is what was on screen.
  const world = new Map<string, Body>(layout.nodes.map((n) => {
    const home = xyOf(n);
    return [n.person.id, {
      id: n.person.id, x: home.x, y: home.y, vx: 0, vy: 0, r: n.r, want: n.d, pinned: n.fixed,
    }];
  }));
  settle([...world.values()], tiesOf(data.links, data.people, world));
  const spot = (id: string) => world.get(id) ?? { x: 0, y: 0 };
  let reach = ME_R;
  for (const body of world.values()) reach = Math.max(reach, Math.hypot(body.x, body.y) + body.r);
  const middle = size / 2;
  const scale = (size / 2) * (1 - MARGIN * 2) / Math.max(reach, 1);
  const at = (x: number, y: number) => ({ x: middle + x * scale, y: middle + y * scale });

  ctx.globalAlpha = 1;
  ctx.fillStyle = input.background;
  ctx.fillRect(0, 0, size, size);

  // The shape round each group, exactly as the page draws it: the picture
  // should be the map, not a diagram of the same data.
  ctx.lineWidth = Math.max(1, size / 1400);
  const spotsOf = (members: readonly { id: string }[]) => members.flatMap((p) => {
    const body = world.get(p.id);
    if (!body) return [];
    const point = at(body.x, body.y);
    return [{ x: point.x, y: point.y, r: body.r * scale + size / 500 }];
  });
  for (const group of new Set(data.people.map((p) => p.group))) {
    const members = data.people.filter((p) => p.group === group);
    const spots = spotsOf(members);
    if (!spots.length) continue;
    // The groups inside the group, as on the screen: a fainter shape each,
    // named in smaller letters over the middle of its people.
    for (const sub of new Set(members.flatMap((p) => (p.sub ? [p.sub] : [])))) {
      const inner = spotsOf(members.filter((p) => p.sub === sub));
      if (inner.length < 2) continue;
      const ring = boundaryOf(inner, size / 180);
      if (ring.length < 3) continue;
      drawBoundary(ctx, ring, size / 100);
      ctx.fillStyle = colors[group];
      ctx.globalAlpha = 0.05;
      ctx.fill();
      ctx.strokeStyle = colors[group];
      ctx.globalAlpha = 0.3;
      ctx.setLineDash([size / 800, size / 400]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = colors[group];
      ctx.font = `${Math.round(size / 130)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const cx = inner.reduce((s, p) => s + p.x, 0) / inner.length;
      const cy = Math.min(...inner.map((p) => p.y - p.r)) - size / 140;
      ctx.fillText(sub, cx, cy);
    }
    const shape = boundaryOf(spots, size / 90);
    if (shape.length < 3) continue;
    drawBoundary(ctx, shape, size / 60);
    ctx.fillStyle = colors[group];
    ctx.globalAlpha = 0.06;
    ctx.fill();
    ctx.strokeStyle = colors[group];
    ctx.globalAlpha = 0.24;
    ctx.setLineDash([size / 400, size / 260]);
    ctx.stroke();
    ctx.setLineDash([]);
    const label = input.groupLabel?.[group];
    if (label) {
      let top = shape[0];
      for (const point of shape) if (point[1] < top[1]) top = point;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = colors[group];
      ctx.font = `${Math.round(size / 110)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, top[0], top[1] - size / 220);
    }
  }

  // Me to each person.
  ctx.strokeStyle = ink;
  for (const n of layout.nodes) {
    const body = spot(n.person.id);
    const p = at(body.x, body.y);
    ctx.beginPath();
    ctx.moveTo(middle, middle);
    ctx.lineTo(p.x, p.y);
    ctx.globalAlpha = 0.3 * contactFade(n.person, today);
    ctx.stroke();
  }

  // Person to person, each tie with whatever it was called.
  for (const link of data.links) {
    const a = world.get(link.source);
    const b = world.get(link.target);
    if (!a || !b) continue;
    const pa = at(a.x, a.y);
    const pb = at(b.x, b.y);
    const close = link.closeness ?? 3;
    ctx.globalAlpha = 0.2 + 0.1 * close;
    ctx.lineWidth = Math.max(1, size / 1400) * (0.6 + 0.35 * close);
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, size / 1400);
    if (!link.label) continue;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = ink;
    ctx.font = `${Math.round(size / 150)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(link.label, (pa.x + pb.x) / 2, (pa.y + pb.y) / 2);
  }

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
    const body = spot(n.person.id);
    const p = at(body.x, body.y);
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
