/**
 * A decorated month as a PNG, for saving or sharing (다꾸 인증샷).
 *
 * Drawn straight onto a canvas from the data (plans, highlighter, the
 * decoration layer, paper) rather than photographed from the page: the result
 * does not depend on the window size, scroll position, hover state or the
 * floating panel, and photo stickers come from this device's own store.
 * Nothing is uploaded — the image is made on the device.
 */
import { laneRows, type DayEvent } from '@/lib/calendar-events';
import { MONTH_ROWS, WEEK_DAYS, partsOf, type DayCell } from '@/lib/calendar-grid';
import { chipInk, shownColor } from '@/lib/calendar-theme';
import { stickerGlyph } from '@/lib/decor';
import { TAPE_COLORS, TAPE_DEFAULT, type CalendarPaper, type LayerItem, type TapePattern } from '@/lib/decor-layer';

/** Layout width; the file is drawn at IMAGE_SCALE× this (2160 px). */
export const IMAGE_W = 1080;
export const IMAGE_SCALE = 2;
const PAD = 40;
const TITLE_H = 76;
const WEEK_H = 38;
const CELL_H = 160;
const FOOT_H = 64;
const HEAD_H = 34;
const LINE_H = 27;
const FONT = '"Pretendard", "Pretendard Variable", system-ui, sans-serif';
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

/** Where everything goes on the image. */
export function imageLayout() {
  const gridW = IMAGE_W - PAD * 2;
  const grid = { x: PAD, y: PAD + TITLE_H + WEEK_H, w: gridW, h: CELL_H * MONTH_ROWS };
  return {
    width: IMAGE_W,
    height: grid.y + grid.h + FOOT_H,
    grid,
    cellW: gridW / WEEK_DAYS,
    cellH: CELL_H,
    /** Chip lines that fit under the day number. */
    lines: Math.floor((CELL_H - HEAD_H) / LINE_H),
  };
}

/** Resolved colours (plain CSS colours a canvas understands). */
export interface ImageColors {
  background: string;
  surface: string;
  outside: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  paperInk: string;
  paperDot: string;
  paperKraft: string;
  paperFleck: string;
}

export interface CalendarImageInput {
  title: string;
  weekdays: string[];
  cells: DayCell[];
  /** Days carried over from the month before (drawn as m/d). */
  carried: Set<string>;
  byDay: Record<string, DayEvent[]>;
  tints: Record<string, string>;
  items: LayerItem[];
  photos: Record<string, CanvasImageSource | null>;
  paper: CalendarPaper;
  theme: string | null;
  today: string;
  colors: ImageColors;
  moreLabel: (n: number) => string;
  footer: string;
}

const SUN = '#ef4444';
const SAT = '#3b82f6';

/** `a` mixed into `b` by `t` (0..1), both #rrggbb or rgb(). */
export function mix(a: string, b: string, t: number): string {
  const pa = rgbOf(a);
  const pb = rgbOf(b);
  if (!pa || !pb) return b;
  const c = pa.map((v, i) => Math.round(v * t + pb[i] * (1 - t)));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

function rgbOf(c: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(c);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

/** A tiny deterministic random, so kraft flecks look the same every time. */
function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: [number, number, number, number]) {
  ctx.beginPath();
  ctx.moveTo(x + r[0], y);
  ctx.lineTo(x + w - r[1], y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r[1]);
  ctx.lineTo(x + w, y + h - r[2]);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
  ctx.lineTo(x + r[3], y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r[3]);
  ctx.lineTo(x, y + r[0]);
  ctx.quadraticCurveTo(x, y, x + r[0], y);
  ctx.closePath();
}

function drawPaper(ctx: CanvasRenderingContext2D, paper: CalendarPaper, x: number, y: number, w: number, h: number, c: ImageColors, seed: number) {
  if (paper === 'none') return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (paper === 'grid' || paper === 'lined') {
    ctx.strokeStyle = c.paperInk;
    ctx.lineWidth = 1;
    const step = paper === 'grid' ? 16 : 22;
    ctx.beginPath();
    for (let yy = y + step; yy < y + h; yy += step) { ctx.moveTo(x, yy + 0.5); ctx.lineTo(x + w, yy + 0.5); }
    if (paper === 'grid') for (let xx = x + step; xx < x + w; xx += step) { ctx.moveTo(xx + 0.5, y); ctx.lineTo(xx + 0.5, y + h); }
    ctx.stroke();
  } else if (paper === 'dot') {
    ctx.fillStyle = c.paperDot;
    for (let yy = y + 8; yy < y + h; yy += 16) for (let xx = x + 8; xx < x + w; xx += 16) {
      ctx.beginPath();
      ctx.arc(xx, yy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (paper === 'kraft') {
    ctx.fillStyle = c.paperKraft;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = c.paperFleck;
    const r = rand(seed);
    for (let i = 0; i < (w * h) / 120; i++) ctx.fillRect(x + r() * w, y + r() * h, 1.4, 1.4);
  }
  ctx.restore();
}

function tapeFill(ctx: CanvasRenderingContext2D, p: TapePattern, color: string, w: number, h: number) {
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  const u = Math.max(6, h / 3);
  if (p === 'stripe') {
    ctx.lineWidth = u * 0.5;
    ctx.beginPath();
    for (let x = -w / 2 - h; x < w / 2 + h; x += u * 1.3) { ctx.moveTo(x, h / 2); ctx.lineTo(x + h, -h / 2); }
    ctx.stroke();
  } else if (p === 'dot') {
    for (let y = -h / 2 + u / 2; y < h / 2; y += u) for (let x = -w / 2 + u / 2; x < w / 2; x += u) {
      ctx.beginPath();
      ctx.arc(x, y, u * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p === 'check') {
    for (let y = -h / 2, j = 0; y < h / 2; y += u / 1.5, j++) for (let x = -w / 2, i = 0; x < w / 2; x += u / 1.5, i++) {
      if ((i + j) % 2) ctx.fillRect(x, y, u / 1.5, u / 1.5);
    }
  } else if (p === 'grid') {
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = -h / 2; y < h / 2; y += u * 0.8) { ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); }
    for (let x = -w / 2; x < w / 2; x += u * 0.8) { ctx.moveTo(x, -h / 2); ctx.lineTo(x, h / 2); }
    ctx.stroke();
  }
}

function drawItem(ctx: CanvasRenderingContext2D, item: LayerItem, grid: { x: number; y: number; w: number; h: number }, photos: CalendarImageInput['photos']) {
  // Sizes follow the page: fractions of the grid's width (the layer's cqw).
  const cq = grid.w / 100;
  ctx.save();
  ctx.translate(grid.x + item.x * grid.w, grid.y + item.y * grid.h);
  ctx.rotate((item.r * Math.PI) / 180);
  if (item.k === 'sticker') {
    const size = 3.6 * item.s * cq;
    ctx.font = `${size}px ${EMOJI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = size * 0.08;
    ctx.fillText(stickerGlyph(item.g ?? '') ?? '', 0, size * 0.04);
  } else if (item.k === 'tape') {
    const w = (item.w ?? TAPE_DEFAULT) * grid.w;
    const h = 2.4 * item.s * cq;
    const z = w * 0.012;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2, -h / 2);
    for (let i = 1; i <= 5; i++) ctx.lineTo(w / 2 - (i % 2 ? z : 0), -h / 2 + (h * i) / 5);
    ctx.lineTo(-w / 2, h / 2);
    for (let i = 4; i >= 0; i--) ctx.lineTo(-w / 2 + (i % 2 ? z : 0), -h / 2 + (h * i) / 5);
    ctx.closePath();
    ctx.clip();
    tapeFill(ctx, item.p ?? 'solid', item.c ?? TAPE_COLORS[0], w, h);
  } else {
    const w = 9 * item.s * cq;
    const pad = w * 0.06;
    const inner = w - pad * 2;
    const h = pad + inner + w * 0.2;
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = w * 0.06;
    ctx.shadowOffsetY = w * 0.02;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.shadowColor = 'transparent';
    const img = item.ph ? photos[item.ph] : null;
    const ix = -w / 2 + pad;
    const iy = -h / 2 + pad;
    if (img) {
      const sw = (img as { width: number }).width;
      const sh = (img as { height: number }).height;
      const side = Math.min(sw, sh);
      ctx.drawImage(img, (sw - side) / 2, (sh - side) / 2, side, side, ix, iy, inner, inner);
    } else {
      ctx.fillStyle = '#e5e5e5';
      ctx.fillRect(ix, iy, inner, inner);
    }
  }
  ctx.restore();
}

function clipText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y - LINE_H, maxW, LINE_H * 2);
  ctx.clip();
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Draw the month. The canvas must be imageLayout().width × height. */
export function drawCalendar(ctx: CanvasRenderingContext2D, input: CalendarImageInput): void {
  const L = imageLayout();
  const { grid, cellW, cellH } = L;
  const c = input.colors;

  ctx.fillStyle = c.background;
  ctx.fillRect(0, 0, L.width, L.height);

  ctx.fillStyle = c.text;
  ctx.font = `700 40px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(input.title, L.width / 2, PAD + TITLE_H / 2);

  ctx.font = `500 20px ${FONT}`;
  input.weekdays.forEach((w, i) => {
    ctx.fillStyle = i === 0 ? SUN : i === 6 ? SAT : c.muted;
    ctx.fillText(w, grid.x + cellW * (i + 0.5), PAD + TITLE_H + WEEK_H / 2);
  });

  // The grid: rounded, clipped, cells on their grounds.
  ctx.save();
  roundRect(ctx, grid.x, grid.y, grid.w, grid.h, [14, 14, 14, 14]);
  ctx.clip();
  const weeks = Array.from({ length: MONTH_ROWS }, (_, r) =>
    laneRows(input.cells.slice(r * 7, r * 7 + 7).map((cell) => cell.key), input.byDay));

  input.cells.forEach((cell, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = grid.x + col * cellW;
    const y = grid.y + row * cellH;
    const ground = cell.inMonth ? c.surface : c.outside;
    const tint = input.tints[cell.key];
    ctx.fillStyle = tint ? mix(tint, ground, 0.55) : ground;
    ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);
    drawPaper(ctx, input.paper, x, y, cellW, cellH, c, i + 1);
  });

  // Grid lines.
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 1; i < 7; i++) { ctx.moveTo(grid.x + i * cellW, grid.y); ctx.lineTo(grid.x + i * cellW, grid.y + grid.h); }
  for (let r = 1; r < MONTH_ROWS; r++) { ctx.moveTo(grid.x, grid.y + r * cellH); ctx.lineTo(grid.x + grid.w, grid.y + r * cellH); }
  ctx.stroke();

  input.cells.forEach((cell, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = grid.x + col * cellW;
    const y = grid.y + row * cellH;
    const fade = cell.inMonth ? 1 : input.carried.has(cell.key) ? 0.8 : 0.45;

    // The day number.
    const label = input.carried.has(cell.key) ? `${partsOf(cell.key).m + 1}/${cell.day}` : String(cell.day);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (cell.key === input.today) {
      ctx.font = `700 19px ${FONT}`;
      const w = Math.max(30, ctx.measureText(label).width + 14);
      ctx.fillStyle = c.accent;
      roundRect(ctx, x + cellW / 2 - w / 2, y + 5, w, 26, [13, 13, 13, 13]);
      ctx.fill();
      ctx.fillStyle = chipInk(c.accent);
    } else {
      ctx.font = `500 19px ${FONT}`;
      ctx.globalAlpha = fade;
      ctx.fillStyle = col === 0 ? SUN : col === 6 ? SAT : c.text;
    }
    ctx.fillText(label, x + cellW / 2, y + 18);
    ctx.globalAlpha = 1;

    // The plans, lane by lane, as on the page.
    const list = input.byDay[cell.key] ?? [];
    const lanes = weeks[row];
    let rows = lanes.slice(0, L.lines).map((lane) => lane[col]);
    let hidden = list.length - rows.filter(Boolean).length;
    if (hidden > 0) {
      rows = lanes.slice(0, L.lines - 1).map((lane) => lane[col]);
      hidden = list.length - rows.filter(Boolean).length;
    }
    ctx.globalAlpha = cell.inMonth ? 1 : 0.75;
    ctx.textAlign = 'left';
    rows.forEach((ev, lane) => {
      if (!ev) return;
      const ly = y + HEAD_H + lane * LINE_H;
      const raw = ev.color ?? '#6366f1';
      const color = ev.src ? raw : shownColor(raw, input.theme);
      ctx.font = `500 17px ${FONT}`;
      if (!ev.time) {
        const first = ev.index === 0;
        const last = ev.index === ev.length - 1;
        const x0 = x + (first ? 4 : 0);
        const x1 = x + cellW - (last ? 4 : 0);
        const radius: [number, number, number, number] = [first ? 5 : 0, last ? 5 : 0, last ? 5 : 0, first ? 5 : 0];
        roundRect(ctx, x0, ly, x1 - x0, LINE_H - 3, radius);
        if (ev.src) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = c.text;
        } else {
          ctx.fillStyle = color;
          ctx.fill();
          ctx.fillStyle = chipInk(color);
        }
        // A bar's title is written where it starts, and again on each new week.
        if (first || col === 0) clipText(ctx, ev.text, x0 + 6, ly + (LINE_H - 3) / 2 + 1, x1 - x0 - 10);
      } else {
        ctx.beginPath();
        ctx.arc(x + 12, ly + LINE_H / 2 - 1, 5, 0, Math.PI * 2);
        if (ev.src) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.fill();
        }
        ctx.fillStyle = c.text;
        clipText(ctx, ev.text, x + 22, ly + LINE_H / 2, cellW - 28);
      }
    });
    if (hidden > 0) {
      ctx.font = `400 15px ${FONT}`;
      ctx.fillStyle = c.muted;
      ctx.fillText(input.moreLabel(hidden), x + 8, y + HEAD_H + (L.lines - 1) * LINE_H + LINE_H / 2);
    }
    ctx.globalAlpha = 1;
  });

  // The decoration layer, over everything, like on the page.
  for (const item of input.items) drawItem(ctx, item, grid, input.photos);
  ctx.restore();

  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1.5;
  roundRect(ctx, grid.x, grid.y, grid.w, grid.h, [14, 14, 14, 14]);
  ctx.stroke();

  ctx.font = `600 20px ${FONT}`;
  ctx.fillStyle = c.muted;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.fillText(input.footer, L.width - PAD, grid.y + grid.h + FOOT_H / 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = c.text;
  ctx.fillText('24Houring', PAD, grid.y + grid.h + FOOT_H / 2);
}

/** Resolve CSS colour expressions (vars, color-mix, hsl…) as the page sees
 *  them inside `root`, into rgb()/rgba() a canvas always understands. */
export function resolveColors<K extends string>(root: HTMLElement, exprs: Record<K, string>): Record<K, string> {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  root.appendChild(probe);
  const px = document.createElement('canvas');
  px.width = px.height = 1;
  const g = px.getContext('2d', { willReadFrequently: true });
  const out = {} as Record<K, string>;
  for (const [k, expr] of Object.entries(exprs) as [K, string][]) {
    probe.style.backgroundColor = '';
    probe.style.backgroundColor = expr;
    const css = getComputedStyle(probe).backgroundColor;
    let value = css || '#ffffff';
    if (g) {
      g.clearRect(0, 0, 1, 1);
      g.fillStyle = '#000';
      g.fillStyle = css;
      g.fillRect(0, 0, 1, 1);
      const [r, gg, b, a] = g.getImageData(0, 0, 1, 1).data;
      value = a === 255 ? `rgb(${r}, ${gg}, ${b})` : `rgba(${r}, ${gg}, ${b}, ${(a / 255).toFixed(3)})`;
    }
    out[k] = value;
  }
  probe.remove();
  return out;
}

export async function renderCalendarImage(input: CalendarImageInput, scale = IMAGE_SCALE): Promise<Blob> {
  try {
    await document.fonts?.ready;
  } catch {
    // fonts are a nicety
  }
  const L = imageLayout();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(L.width * scale);
  canvas.height = Math.round(L.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.scale(scale, scale);
  drawCalendar(ctx, input);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'));
}
