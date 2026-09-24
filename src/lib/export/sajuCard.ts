/**
 * The 사주 as a card to share: the four pillars, the one line and the three
 * words the reading opened with, the five elements, and a way back here.
 *
 * What is on it is only what the person chose to show and the chart itself —
 * never the reading's body, which is written from their records and names the
 * people and places in them. Portrait 4:5, the shape a feed shows whole.
 */
import qrcode from 'qrcode-generator';

export const SAJU_CARD_WIDTH = 1080;
export const SAJU_CARD_HEIGHT = 1350;

export interface SajuCardPillar {
  /** 시주, 일주… already translated. */
  label: string;
  /** The heavenly stem and earthly branch as characters, or null when the
   *  hour is not known. */
  stem: string | null;
  branch: string | null;
  /** Their reading, e.g. 병오. */
  reading: string;
  stemColor: string;
  branchColor: string;
}

export interface SajuCardInput {
  /** "나의 사주" or "김하루의 사주", already written. */
  title: string;
  /** Hour, day, month, year — the order a chart is read in. */
  pillars: readonly SajuCardPillar[];
  dayMaster: string;
  headline: string;
  keywords: readonly string[];
  elements: readonly { label: string; n: number; color: string }[];
  /** The line beside the code, already translated. */
  cta: string;
  url: string;
}

const PAPER = '#f7f3ec';
const INK = '#2a2622';
const MUTED = '#8a8178';
const LINE = '#e3dcd0';
const SERIF = "'Noto Serif KR', 'Nanum Myeongjo', 'Apple SD Gothic Neo', serif";
const SANS = "Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif";

/**
 * Lines that fit a width. Korean, Chinese and Japanese break between any two
 * characters; everything else between words, as a reader expects.
 */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, max: number, maxLines: number): string[] {
  const tokens = text.match(/[⺀-鿿가-힯぀-ヿ][.,!?。、」』)]*|[^\s⺀-鿿가-힯぀-ヿ]+|\s+/g) ?? [];
  const lines: string[] = [];
  let line = '';
  for (const token of tokens) {
    const next = line + token;
    if (ctx.measureText(next.trimEnd()).width <= max || !line.trim()) {
      line = next;
      continue;
    }
    lines.push(line.trim());
    line = token.trimStart();
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line.trim()) lines.push(line.trim());
  // Whatever did not fit ends in an ellipsis rather than being cut mid-thought.
  if (lines.length === maxLines && tokens.join('').trim() !== lines.join(' ').trim()) {
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > max) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function qrModules(url: string): boolean[][] | null {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const n = qr.getModuleCount();
    return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
  } catch {
    return null;
  }
}

export function drawSajuCard(ctx: CanvasRenderingContext2D, input: SajuCardInput): void {
  const W = SAJU_CARD_WIDTH;
  const H = SAJU_CARD_HEIGHT;
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  // A thin frame, the way a printed card has one.
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = MUTED;
  ctx.font = `600 28px ${SANS}`;
  ctx.fillText('24Houring · 四柱', W / 2, 120);
  ctx.fillStyle = INK;
  ctx.font = `700 58px ${SERIF}`;
  ctx.fillText(input.title, W / 2, 198);

  // The four pillars.
  const colW = 196;
  const gap = 22;
  const left = (W - (colW * 4 + gap * 3)) / 2;
  const top = 250;
  input.pillars.forEach((p, i) => {
    const x = left + i * (colW + gap);
    const cx = x + colW / 2;
    ctx.fillStyle = '#fffdf8';
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, top, colW, 360, 26);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.font = `500 28px ${SANS}`;
    ctx.fillText(p.label, cx, top + 52);
    if (p.stem && p.branch) {
      ctx.font = `700 112px ${SERIF}`;
      ctx.fillStyle = p.stemColor;
      ctx.fillText(p.stem, cx, top + 180);
      ctx.fillStyle = p.branchColor;
      ctx.fillText(p.branch, cx, top + 300);
      ctx.fillStyle = MUTED;
      ctx.font = `500 28px ${SANS}`;
      ctx.fillText(p.reading, cx, top + 344);
    } else {
      ctx.fillStyle = LINE;
      ctx.font = `700 96px ${SERIF}`;
      ctx.fillText('?', cx, top + 230);
    }
  });

  ctx.fillStyle = MUTED;
  ctx.font = `500 30px ${SANS}`;
  ctx.fillText(input.dayMaster, W / 2, top + 420);

  // The one line, as large as it can be and still fit three lines.
  let y = top + 500;
  if (input.headline) {
    ctx.fillStyle = INK;
    ctx.font = `700 50px ${SERIF}`;
    const lines = wrapText(ctx, `“${input.headline}”`, W - 200, 3);
    for (const line of lines) {
      ctx.fillText(line, W / 2, y);
      y += 68;
    }
  }

  // The three words, as tags.
  const words = input.keywords.slice(0, 3).map((k) => `#${k.replace(/^#/, '')}`);
  if (words.length) {
    ctx.font = `600 32px ${SANS}`;
    const pad = 26;
    const widths = words.map((w) => ctx.measureText(w).width + pad * 2);
    const total = widths.reduce((a, b) => a + b, 0) + (words.length - 1) * 16;
    let x = (W - total) / 2;
    const tagY = y + 10;
    words.forEach((w, i) => {
      ctx.fillStyle = '#efe7da';
      ctx.beginPath();
      ctx.roundRect(x, tagY, widths[i], 60, 30);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.textAlign = 'center';
      ctx.fillText(w, x + widths[i] / 2, tagY + 42);
      x += widths[i] + 16;
    });
    y = tagY + 60;
  }

  // The five elements, as five short bars.
  const most = Math.max(1, ...input.elements.map((e) => e.n));
  const barTop = Math.max(y + 50, 1040);
  const barW = 150;
  const barGap = 24;
  const barLeft = (W - (barW * input.elements.length + barGap * (input.elements.length - 1))) / 2;
  input.elements.forEach((e, i) => {
    const x = barLeft + i * (barW + barGap);
    ctx.fillStyle = '#ece5d8';
    ctx.beginPath();
    ctx.roundRect(x, barTop, barW, 14, 7);
    ctx.fill();
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.roundRect(x, barTop, Math.max(14, (barW * e.n) / most), 14, 7);
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.font = `500 26px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${e.label} ${e.n}`, x + barW / 2, barTop + 52);
  });

  // The way back: a code, and a line beside it.
  const qr = qrModules(input.url);
  const size = 132;
  const qx = W - 80 - size;
  const qy = H - 80 - size;
  if (qr) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qx - 10, qy - 10, size + 20, size + 20);
    const m = size / qr.length;
    ctx.fillStyle = INK;
    qr.forEach((row, r) => row.forEach((dark, c) => {
      if (dark) ctx.fillRect(qx + c * m, qy + r * m, Math.ceil(m), Math.ceil(m));
    }));
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `600 30px ${SANS}`;
  const ctaLines = wrapText(ctx, input.cta, qx - 130, 2);
  ctaLines.forEach((line, i) => ctx.fillText(line, 90, qy + 44 + i * 42));
  ctx.fillStyle = MUTED;
  ctx.font = `500 26px ${SANS}`;
  ctx.fillText('24houring.com', 90, qy + 44 + ctaLines.length * 42 + 8);
  ctx.textAlign = 'center';
}

export function sajuCardBlob(input: SajuCardInput): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = SAJU_CARD_WIDTH;
  canvas.height = SAJU_CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  drawSajuCard(ctx, input);
  return new Promise((done) => canvas.toBlob((b) => done(b), 'image/png'));
}
