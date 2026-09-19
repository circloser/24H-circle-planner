/**
 * The life timeline as one tall PNG (family occasions, a keepsake to share).
 *
 * Like the calendar image it is drawn straight from the data onto a canvas —
 * not photographed from the page — so it does not depend on the window, the
 * scroll position or which cards have faded in yet. Nothing is uploaded.
 * Layout width 1080; drawn at 2× (2160 px) unless the line is so long that a
 * canvas that tall would be refused, in which case the scale steps down.
 */
import { mix, roundRect } from './calendarImage';

export const LIFE_IMAGE_W = 1080;
const PAD = 56;
const GAP = 48; // card edge to the line
const CARD_W = (LIFE_IMAGE_W - PAD * 2 - GAP * 2) / 2;
const CENTER = LIFE_IMAGE_W / 2;
const CARD_PAD = 24;
const FONT = '"Pretendard", "Pretendard Variable", system-ui, sans-serif';
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
  | { kind: 'decade'; label: string; future: boolean }
  | { kind: 'today'; label: string }
  | {
    kind: 'card'; side: 'left' | 'right'; tight: boolean; future: boolean; plan: boolean;
    color: string; eyebrow: string; title: string; description?: string; photo?: CanvasImageSource | null;
  };

export interface LifeImageInput {
  title: string;
  summary: string;
  rootsLabel: string;
  family: { label: string; name: string; sub?: string; color: string }[];
  rows: LifeImageRow[];
  ending: { title: string; text: string; legal: string } | null;
  footer: string;
  colors: LifeImageColors;
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

const font = (px: number, weight = 400) => `${weight} ${px}px ${FONT}`;

interface Block { h: number; draw: (ctx: CanvasRenderingContext2D, y: number) => void }

function layout(ctx: CanvasRenderingContext2D, input: LifeImageInput): Block[] {
  const c = input.colors;
  const blocks: Block[] = [];
  const line = (x: number, y0: number, y1: number, dashed: boolean) => {
    ctx.save();
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 3;
    ctx.setLineDash(dashed ? [9, 7] : []);
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
    ctx.restore();
  };
  const card = (x: number, y: number, w: number, h: number, color: string, dashed: boolean) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = c.surface;
    roundRect(ctx, x, y, w, h, [18, 18, 18, 18]);
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, x, y, w, h, [18, 18, 18, 18]);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 5);
    ctx.restore();
    if (dashed) {
      ctx.save();
      ctx.strokeStyle = c.border;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      roundRect(ctx, x, y, w, h, [18, 18, 18, 18]);
      ctx.stroke();
      ctx.restore();
    }
  };

  // Title and summary.
  ctx.font = font(22);
  const summary = wrapText(ctx, input.summary, LIFE_IMAGE_W - PAD * 2);
  blocks.push({
    h: 60 + 58 + summary.length * 32 + 16,
    draw: (g, y) => {
      g.fillStyle = c.text;
      g.font = font(44, 800);
      g.textBaseline = 'top';
      g.fillText(input.title, PAD, y + 60);
      g.fillStyle = c.muted;
      g.font = font(22);
      summary.forEach((s, i) => g.fillText(s, PAD, y + 118 + i * 32));
    },
  });

  // Roots: two to a row, then the two lines that meet at the centre.
  if (input.family.length) {
    const rows = Math.ceil(input.family.length / 2);
    const fh = 104;
    blocks.push({
      h: 44 + rows * (fh + 16) + 60,
      draw: (g, y) => {
        g.fillStyle = c.muted;
        g.font = font(16, 700);
        g.textAlign = 'center';
        g.fillText(input.rootsLabel.toUpperCase(), CENTER, y + 16);
        g.textAlign = 'left';
        input.family.forEach((f, i) => {
          const x = i % 2 === 0 ? PAD : PAD + CARD_W + GAP * 2;
          const top = y + 44 + Math.floor(i / 2) * (fh + 16);
          card(x, top, CARD_W, fh, f.color, false);
          g.fillStyle = mix(f.color, c.text, 0.62);
          g.font = font(15, 700);
          g.fillText(f.label.toUpperCase(), x + CARD_PAD, top + 22);
          g.fillStyle = c.text;
          g.font = font(26, 800);
          g.fillText(wrapText(g, f.name, CARD_W - CARD_PAD * 2, 1)[0], x + CARD_PAD, top + 42);
          if (f.sub) {
            g.fillStyle = c.muted;
            g.font = font(17);
            g.fillText(f.sub, x + CARD_PAD, top + 74);
          }
        });
        const from = y + 44 + rows * (fh + 16) - 16;
        g.save();
        g.strokeStyle = c.border;
        g.lineWidth = 3;
        for (const x of [PAD + CARD_W / 2, LIFE_IMAGE_W - PAD - CARD_W / 2]) {
          g.beginPath();
          g.moveTo(x, from);
          g.bezierCurveTo(x, from + 44, CENTER, from + 30, CENTER, from + 76);
          g.stroke();
        }
        g.restore();
      },
    });
  }

  // The line.
  for (const row of input.rows) {
    if (row.kind === 'decade') {
      blocks.push({
        h: 44 + 34,
        draw: (g, y) => {
          line(CENTER, y, y + 78, row.future);
          g.font = font(17, 700);
          const w = g.measureText(row.label).width + 32;
          g.fillStyle = c.surface;
          g.strokeStyle = c.border;
          g.lineWidth = 1.5;
          g.setLineDash([]);
          roundRect(g, CENTER - w / 2, y + 44, w, 34, [17, 17, 17, 17]);
          g.fill();
          g.stroke();
          g.fillStyle = c.muted;
          g.textAlign = 'center';
          g.fillText(row.label, CENTER, y + 52);
          g.textAlign = 'left';
        },
      });
    } else if (row.kind === 'today') {
      blocks.push({
        h: 44 + 30,
        draw: (g, y) => {
          line(CENTER, y, y + 59, false);
          line(CENTER, y + 59, y + 74, true);
          g.fillStyle = mix(c.primary, c.surface, 0.18);
          g.beginPath();
          g.arc(CENTER, y + 59, 22, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = c.surface;
          g.beginPath();
          g.arc(CENTER, y + 59, 15, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = c.primary;
          g.beginPath();
          g.arc(CENTER, y + 59, 11, 0, Math.PI * 2);
          g.fill();
          g.font = font(20, 700);
          const w = g.measureText(row.label).width + 28;
          g.fillStyle = mix(c.primary, c.surface, 0.12);
          roundRect(g, CENTER + 32, y + 44, w, 32, [16, 16, 16, 16]);
          g.fill();
          g.fillStyle = c.primary;
          g.fillText(row.label, CENTER + 46, y + 50);
        },
      });
    } else {
      const inner = CARD_W - CARD_PAD * 2;
      ctx.font = font(27, 800);
      const title = wrapText(ctx, row.title, inner, 3);
      ctx.font = font(18);
      const desc = row.description ? wrapText(ctx, row.description, inner, 2) : [];
      const photoH = row.photo ? Math.round(inner * 9 / 16) : 0;
      const h = 5 + CARD_PAD + 22 + 10 + title.length * 36 + (desc.length ? 8 + desc.length * 28 : 0) + (photoH ? 14 + photoH : 0) + CARD_PAD;
      const gap = row.tight ? 28 : 44;
      blocks.push({
        h: gap + h,
        draw: (g, y) => {
          line(CENTER, y, y + gap + h, row.future);
          const top = y + gap;
          const x = row.side === 'left' ? PAD : LIFE_IMAGE_W - PAD - CARD_W;
          g.save();
          if (row.plan) g.globalAlpha = 0.85;
          // Pointer toward the line.
          const px = row.side === 'left' ? x + CARD_W : x;
          const dir = row.side === 'left' ? 1 : -1;
          g.fillStyle = c.surface;
          g.beginPath();
          g.moveTo(px, top + 22);
          g.lineTo(px + dir * 12, top + 32);
          g.lineTo(px, top + 42);
          g.closePath();
          g.fill();
          card(x, top, CARD_W, h, row.color, row.plan);
          let cy = top + 5 + CARD_PAD;
          g.fillStyle = mix(row.color, c.text, 0.62);
          g.font = font(16, 700);
          g.textBaseline = 'top';
          g.fillText(wrapText(g, row.eyebrow.toUpperCase(), inner, 1)[0], x + CARD_PAD, cy);
          cy += 32;
          g.fillStyle = c.text;
          g.font = font(27, 800);
          title.forEach((s) => { g.fillText(s, x + CARD_PAD, cy); cy += 36; });
          if (desc.length) {
            cy += 8;
            g.fillStyle = c.muted;
            g.font = font(18);
            desc.forEach((s) => { g.fillText(s, x + CARD_PAD, cy); cy += 28; });
          }
          if (row.photo && photoH) {
            cy += 14;
            g.save();
            roundRect(g, x + CARD_PAD, cy, inner, photoH, [12, 12, 12, 12]);
            g.clip();
            const img = row.photo as HTMLImageElement;
            const iw = img.naturalWidth || inner;
            const ih = img.naturalHeight || photoH;
            const s = Math.max(inner / iw, photoH / ih);
            g.drawImage(row.photo, x + CARD_PAD + (inner - iw * s) / 2, cy + (photoH - ih * s) / 2, iw * s, ih * s);
            g.restore();
          }
          g.restore();
          // The marker, on top of the line.
          g.fillStyle = c.surface;
          g.beginPath();
          g.arc(CENTER, top + 32, 15, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = row.color;
          g.beginPath();
          g.arc(CENTER, top + 32, 10, 0, Math.PI * 2);
          g.fill();
        },
      });
    }
  }

  // The words to leave behind, where the line ends.
  if (input.ending) {
    const e = input.ending;
    const w = 760;
    ctx.font = font(20);
    const text = wrapText(ctx, e.text, w - 64, 40);
    ctx.font = font(15);
    const legal = wrapText(ctx, e.legal, w - 64);
    const h = 32 + 34 + 16 + text.length * 32 + 24 + legal.length * 22 + 32;
    blocks.push({
      h: 60 + h,
      draw: (g, y) => {
        line(CENTER, y, y + 40, true);
        g.fillStyle = c.border;
        g.beginPath();
        g.arc(CENTER, y + 44, 7, 0, Math.PI * 2);
        g.fill();
        const x = CENTER - w / 2;
        const top = y + 60;
        card(x, top, w, h, c.primary, false);
        g.fillStyle = c.text;
        g.font = font(28, 800);
        g.fillText(e.title, x + 32, top + 32);
        g.font = font(20);
        let cy = top + 32 + 50;
        text.forEach((s) => { g.fillText(s, x + 32, cy); cy += 32; });
        cy += 12;
        g.strokeStyle = c.border;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + 32, cy);
        g.lineTo(x + w - 32, cy);
        g.stroke();
        cy += 12;
        g.fillStyle = c.muted;
        g.font = font(15);
        legal.forEach((s) => { g.fillText(s, x + 32, cy); cy += 22; });
      },
    });
  }

  blocks.push({
    h: 88,
    draw: (g, y) => {
      g.fillStyle = c.muted;
      g.font = font(18, 600);
      g.textAlign = 'center';
      g.fillText(input.footer, CENTER, y + 44);
      g.textAlign = 'left';
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
    await document.fonts?.ready;
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
