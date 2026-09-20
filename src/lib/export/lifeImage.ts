/**
 * The life timeline as one tall PNG (family occasions, a keepsake to share).
 *
 * Like the calendar image it is drawn straight from the data onto a canvas —
 * not photographed from the page — so it does not depend on the window, the
 * scroll position or which cards have faded in yet. Nothing is uploaded.
 * Layout width 1080; drawn at 2× (2160 px) unless the line is so long that a
 * canvas that tall would be refused, in which case the scale steps down.
 */
import { drawItem, mix, roundRect } from './calendarImage';
import type { LayerItem } from '@/lib/decor-layer';

export const LIFE_IMAGE_W = 1080;
const PAD = 56;
const GAP = 64; // the line to the text beside it
const CENTER = LIFE_IMAGE_W / 2;
/** Width of an entry's text, on either side of the line. */
const TEXT_W = CENTER - PAD - GAP;
const FONT = '"Pretendard", "Pretendard Variable", system-ui, sans-serif';
/** The page's serif: Georgia for Latin letters, Nanum Myeongjo for Hangul. */
const SERIF = 'Georgia, "Nanum Myeongjo", "Noto Serif KR", serif';
/** Browsers refuse canvases past ~32k px a side or ~268M px in all — and
 *  iPhone/iPad Safari past 16.7M px, which a long life reaches quickly. */
const MAX_SIDE = 32_000;
const MAX_AREA = 240_000_000;
const MAX_AREA_IOS = 16_000_000;

const isIos = (): boolean => typeof navigator !== 'undefined'
  && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export interface LifeImageColors {
  background: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
}

export type LifeImageRow =
  | { kind: 'decade'; label: string; future: boolean; row?: string }
  | { kind: 'today'; label: string; row?: string }
  | {
    kind: 'card'; side: 'left' | 'right'; tight: boolean; future: boolean; plan: boolean; row?: string;
    color: string; eyebrow: string; title: string; description?: string; photo?: CanvasImageSource | null;
  };

export interface LifeImageInput {
  title: string;
  summary: string;
  family: { slot: 'mother' | 'father' | 'other'; label: string; name: string; sub?: string; note?: string }[];
  rows: LifeImageRow[];
  ending: { title: string; text: string } | null;
  footer: string;
  colors: LifeImageColors;
  /** Decorations by row (다꾸), and the pictures any photo frames show. */
  decor?: Record<string, LayerItem[]>;
  decorPhotos?: Record<string, CanvasImageSource | null>;
}

/** Greedy line breaking that also breaks inside long words (Korean has few spaces). */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines = Infinity): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const token of para.split(/(\s+)/)) {
      if (!token) continue;
      if (ctx.measureText(line + token).width <= width) { line += token; continue; }
      if (line.trim()) { out.push(line.trimEnd()); line = ''; }
      if (/^\s+$/.test(token)) continue;
      for (const ch of token) {
        if (ctx.measureText(line + ch).width > width && line) { out.push(line); line = ''; }
        line += ch;
      }
    }
    out.push(line.trimEnd());
  }
  if (out.length > maxLines) {
    const kept = out.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return out;
}

const font = (px: number, weight = 400, family = FONT, italic = false) => `${italic ? 'italic ' : ''}${weight} ${px}px ${family}`;

interface Block { h: number; draw: (ctx: CanvasRenderingContext2D, y: number) => void }

function layout(ctx: CanvasRenderingContext2D, input: LifeImageInput): Block[] {
  const c = input.colors;
  const ink = mix(c.text, c.background, 0.85);
  const faint = mix(c.text, c.background, 0.45);
  const blocks: Block[] = [];
  const line = (x: number, y0: number, y1: number, dashed: boolean) => {
    ctx.save();
    ctx.strokeStyle = dashed ? faint : ink;
    ctx.lineWidth = 2;
    ctx.setLineDash(dashed ? [7, 7] : []);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
    ctx.restore();
  };
  /** A hollow marker, the page background showing through. */
  const ring = (x: number, y: number, dashed: boolean) => {
    ctx.save();
    ctx.fillStyle = c.background;
    ctx.strokeStyle = dashed ? faint : c.text;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(dashed ? [4, 4] : []);
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  /** A row's decorations, over the whole width of the line, as on the page. */
  const decorate = (g: CanvasRenderingContext2D, row: string | undefined, y: number, h: number) => {
    const items = row ? input.decor?.[row] : undefined;
    if (!items?.length) return;
    for (const item of items) drawItem(g, item, { x: 0, y, w: LIFE_IMAGE_W, h }, input.decorPhotos ?? {});
  };
  const text = (s: string, x: number, y: number, align: CanvasTextAlign) => {
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  };

  // Title and summary.
  ctx.font = font(22);
  const summary = wrapText(ctx, input.summary, LIFE_IMAGE_W - PAD * 2);
  blocks.push({
    h: 64 + 64 + summary.length * 32 + 24,
    draw: (g, y) => {
      g.fillStyle = c.text;
      g.font = font(46, 700, SERIF);
      g.fillText(input.title, PAD, y + 64);
      g.fillStyle = c.muted;
      g.font = font(22, 400, FONT, true);
      summary.forEach((s, i) => g.fillText(s, PAD, y + 128 + i * 32));
    },
  });

  // Roots: the parents side by side (everyone else beneath them, shared
  // between the columns), a marker under each, and their two lines meeting.
  if (input.family.length) {
    const cols: LifeImageInput['family'][] = [[], []];
    const mother = input.family.find((f) => f.slot === 'mother');
    const father = input.family.find((f) => f.slot === 'father');
    if (mother) cols[0].push(mother);
    if (father) cols[1].push(father);
    input.family.filter((f) => f.slot === 'other').forEach((f, i) => cols[i % 2].push(f));
    const memberH = (f: LifeImageInput['family'][number]) => 26 + 8 + 38 + (f.sub ? 30 : 0) + (f.note ? 30 : 0);
    const colH = cols.map((col) => col.reduce((s, f, i) => s + memberH(f) + (i ? 32 : 0), 0));
    const body = Math.max(...colH);
    const xs = [LIFE_IMAGE_W / 4, (LIFE_IMAGE_W * 3) / 4];
    blocks.push({
      h: 16 + body + 40 + 14 + 76,
      draw: (g, y) => {
        cols.forEach((col, ci) => {
          let cy = y + 16;
          col.forEach((f) => {
            const w = LIFE_IMAGE_W / 2 - 80;
            g.fillStyle = c.muted;
            g.font = font(18, 400, FONT, true);
            text(f.label, xs[ci], cy, 'center');
            g.fillStyle = c.text;
            g.font = font(30, 700, SERIF);
            text(wrapText(g, f.name, w, 1)[0], xs[ci], cy + 34, 'center');
            let ny = cy + 34 + 38 + 4;
            g.fillStyle = mix(c.text, c.background, 0.75);
            g.font = font(18);
            if (f.sub) { text(f.sub, xs[ci], ny, 'center'); ny += 30; }
            if (f.note) text(wrapText(g, f.note, w, 1)[0], xs[ci], ny, 'center');
            cy += memberH(f) + 32;
          });
        });
        const my = y + 16 + body + 40;
        const bottom = my + 14 + 76;
        g.save();
        g.strokeStyle = ink;
        g.lineWidth = 2;
        for (const x of xs) {
          g.beginPath();
          g.moveTo(x, my + 14);
          g.bezierCurveTo(x, my + 60, CENTER, my + 40, CENTER, bottom);
          g.stroke();
        }
        g.restore();
        xs.forEach((x, i) => ring(x, my, !(i === 0 ? mother : father)));
      },
    });
  }

  // The line.
  for (const row of input.rows) {
    if (row.kind === 'decade') {
      blocks.push({
        h: 56 + 30,
        draw: (g, y) => {
          line(CENTER, y, y + 86, row.future);
          g.font = font(20, 700, SERIF);
          const w = g.measureText(row.label).width + 20;
          g.fillStyle = c.background;
          g.fillRect(CENTER - w / 2, y + 52, w, 32);
          g.fillStyle = c.muted;
          text(row.label, CENTER, y + 56, 'center');
          decorate(g, row.row, y, 86);
        },
      });
    } else if (row.kind === 'today') {
      blocks.push({
        h: 56 + 30,
        draw: (g, y) => {
          const cy = y + 56 + 15;
          line(CENTER, y, cy, false);
          line(CENTER, cy, y + 86, true);
          g.fillStyle = c.background;
          g.beginPath();
          g.arc(CENTER, cy, 17, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = c.primary;
          g.lineWidth = 2.5;
          g.beginPath();
          g.arc(CENTER, cy, 15, 0, Math.PI * 2);
          g.stroke();
          g.fillStyle = c.primary;
          g.beginPath();
          g.arc(CENTER, cy, 8, 0, Math.PI * 2);
          g.fill();
          g.font = font(20, 700, FONT, true);
          g.fillText(row.label, CENTER + 32, cy - 12);
          decorate(g, row.row, y, 86);
        },
      });
    } else {
      ctx.font = font(30, 700, SERIF);
      const title = wrapText(ctx, row.title, TEXT_W, 3);
      ctx.font = font(19);
      const desc = row.description ? wrapText(ctx, row.description, TEXT_W, 4) : [];
      const photoH = row.photo ? Math.round(TEXT_W * 9 / 16) : 0;
      const h = 26 + 10 + title.length * 40 + (desc.length ? 14 + desc.length * 30 : 0) + (photoH ? 18 + photoH : 0);
      const gap = row.tight ? 32 : 56;
      blocks.push({
        h: gap + h,
        draw: (g, y) => {
          line(CENTER, y, y + gap + h, row.future);
          const top = y + gap;
          const left = row.side === 'left';
          const x = left ? CENTER - GAP : CENTER + GAP;
          const align: CanvasTextAlign = left ? 'right' : 'left';
          g.save();
          if (row.plan) g.globalAlpha = 0.8;
          g.fillStyle = c.muted;
          g.font = font(19, 400, FONT, true);
          text(wrapText(g, row.eyebrow, TEXT_W, 1)[0], x, top, align);
          let cy = top + 36;
          g.fillStyle = c.text;
          g.font = font(30, 700, SERIF);
          title.forEach((s) => { text(s, x, cy, align); cy += 40; });
          if (desc.length) {
            cy += 14;
            g.fillStyle = mix(c.text, c.background, 0.75);
            g.font = font(19);
            desc.forEach((s) => { text(s, x, cy, align); cy += 30; });
          }
          if (row.photo && photoH) {
            cy += 18;
            const px = left ? x - TEXT_W : x;
            g.save();
            roundRect(g, px, cy, TEXT_W, photoH, [12, 12, 12, 12]);
            g.clip();
            const img = row.photo as HTMLImageElement;
            const iw = img.naturalWidth || TEXT_W;
            const ih = img.naturalHeight || photoH;
            const s = Math.max(TEXT_W / iw, photoH / ih);
            g.drawImage(row.photo, px + (TEXT_W - iw * s) / 2, cy + (photoH - ih * s) / 2, iw * s, ih * s);
            g.restore();
          }
          g.restore();
          // The marker, level with the title.
          ring(CENTER, top + 36 + 20, row.plan);
          decorate(g, row.row, y, gap + h);
        },
      });
    }
  }

  // The words to leave behind, where the line ends.
  if (input.ending) {
    const e = input.ending;
    const w = 760;
    ctx.font = font(20);
    const body = wrapText(ctx, e.text, w, 40);
    const h = 44 + 24 + body.length * 32;
    blocks.push({
      h: 56 + 12 + 48 + h,
      draw: (g, y) => {
        line(CENTER, y, y + 56, true);
        g.fillStyle = faint;
        g.beginPath();
        g.arc(CENTER, y + 62, 6, 0, Math.PI * 2);
        g.fill();
        const x = CENTER - w / 2;
        let cy = y + 56 + 12 + 48;
        g.fillStyle = c.text;
        g.font = font(34, 700, SERIF);
        text(e.title, CENTER, cy, 'center');
        cy += 44 + 24;
        g.fillStyle = mix(c.text, c.background, 0.85);
        g.font = font(20);
        body.forEach((s) => { g.fillText(s, x, cy); cy += 32; });
      },
    });
  }

  blocks.push({
    h: 96,
    draw: (g, y) => {
      g.fillStyle = c.muted;
      g.font = font(18, 400, SERIF, true);
      text(input.footer, CENTER, y + 52, 'center');
    },
  });
  return blocks;
}

/** The layout height, and the scale a canvas of that size can be drawn at. */
export function lifeImageScale(height: number, want = 2, maxArea = isIos() ? MAX_AREA_IOS : MAX_AREA): number {
  const byArea = Math.sqrt(maxArea / (LIFE_IMAGE_W * height));
  return Math.max(0.25, Math.min(want, MAX_SIDE / height, byArea));
}

export async function renderLifeImage(input: LifeImageInput, want = 2): Promise<Blob> {
  try {
    // The serif is only fetched once something uses it: ask for it first.
    await Promise.all([document.fonts?.load('700 30px "Nanum Myeongjo"'), document.fonts?.ready]);
  } catch {
    // fonts are a nicety
  }
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) throw new Error('no canvas');
  probe.textBaseline = 'top';
  const blocks = layout(probe, input);
  const height = Math.ceil(blocks.reduce((s, b) => s + b.h, 0));
  const scale = lifeImageScale(height, want);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(LIFE_IMAGE_W * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.scale(scale, scale);
  ctx.fillStyle = input.colors.background;
  ctx.fillRect(0, 0, LIFE_IMAGE_W, height);
  ctx.textBaseline = 'top';
  // Measure and draw with the same context settings: re-run the layout on the
  // real canvas so the text metrics match exactly.
  let y = 0;
  for (const b of layout(ctx, input)) {
    b.draw(ctx, y);
    y += b.h;
  }
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}
