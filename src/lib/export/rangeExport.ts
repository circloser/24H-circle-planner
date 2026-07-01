import type { TimeSlice } from '@/types/time-slice';
import { slicePath, labelAnchorInside, truncateLabel } from '@/lib/svg-geometry';

/**
 * Multi-day (date-range) export: compose several days' timetables into ONE image
 * — a grid of circular charts, or stacked tables — plus a multi-day CSV. Days are
 * the diary entries within the chosen range (dates without an entry are skipped).
 */
export interface RangeDay {
  date: string; // raw YYYY-MM-DD (for CSV)
  label: string; // display label, e.g. "1월 10일 (월) · 이름"
  slices: TimeSlice[];
}

const FONT = "Pretendard, system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function safeName(name: string | undefined): string {
  const cleaned = (name || '').replace(/[^\w가-힣 .-]/g, '').replace(/\s+/g, '_').slice(0, 48);
  return cleaned || '24houring-range';
}
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('range export: no 2d context');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob null'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Grid of per-day circular charts. */
export function buildRangeCircleSvg(days: RangeDay[], title: string, opts: { showIcons?: boolean } = {}): { svg: string; width: number; height: number } {
  const n = Math.max(1, days.length);
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(days.length / cols) || 1;
  const chart = 340;
  const labelH = 40;
  const cellW = chart + 44;
  const cellH = chart + labelH + 24;
  const padX = 24;
  const titleH = 58;
  const footerH = 44;
  const W = cols * cellW + padX * 2;
  const H = titleH + rows * cellH + footerH;
  const s = chart / 1000;

  let body = '';
  days.forEach((d, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = padX + col * cellW;
    const cellY = titleH + row * cellH;
    body += `<text x="${cellX + cellW / 2}" y="${cellY + 26}" text-anchor="middle" font-size="20" font-weight="700" fill="#1f2430">${esc(d.label)}</text>`;
    const gx = cellX + (cellW - chart) / 2;
    const gy = cellY + labelH;
    const wedges = d.slices
      .map((sl) => `<path d="${slicePath(sl)}" fill="${esc(sl.color || '#9ca3af')}" stroke="#ffffff" stroke-width="3"/>`)
      .join('');
    const labels = d.slices
      .map((sl) => {
        const a = labelAnchorInside(sl);
        const raw = (opts.showIcons && sl.icon ? sl.icon + ' ' : '') + (sl.label || '').trim();
        const lbl = truncateLabel(raw, 5, 10);
        if (!lbl) return '';
        return `<text x="${a.x.toFixed(1)}" y="${a.y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="34" font-weight="600" fill="#1f2937">${esc(lbl)}</text>`;
      })
      .join('');
    body += `<g transform="translate(${gx.toFixed(1)},${gy.toFixed(1)}) scale(${s.toFixed(4)})">${wedges}<circle cx="500" cy="500" r="100" fill="#ffffff"/><circle cx="500" cy="500" r="460" fill="none" stroke="#e3e6ec" stroke-width="4"/>${labels}</g>`;
  });

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">` +
    `<rect width="${W}" height="${H}" fill="#ffffff"/>` +
    `<text x="${W / 2}" y="38" text-anchor="middle" font-size="24" font-weight="800" fill="#1f2430">${esc(title)}</text>` +
    body +
    `<text x="${W / 2}" y="${H - 16}" text-anchor="middle" font-size="13" fill="rgba(120,130,150,0.7)">24houring.com</text>` +
    `</svg>`;
  return { svg, width: W, height: H };
}

/** Per-day tables stacked vertically. */
export function buildRangeTableSvg(days: RangeDay[], title: string, opts: { showIcons?: boolean } = {}): { svg: string; width: number; height: number } {
  const W = 540;
  const padX = 24;
  const titleH = 54;
  const dayHeaderH = 38;
  const rowH = 36;
  const gap = 16;
  const footerH = 42;
  let y = titleH;
  let body = '';
  for (const d of days) {
    body += `<text x="${padX}" y="${y + 24}" font-size="17" font-weight="700" fill="#1f2430">${esc(d.label)}</text>`;
    body += `<line x1="${padX}" y1="${y + dayHeaderH - 4}" x2="${W - padX}" y2="${y + dayHeaderH - 4}" stroke="#e3e6ec" stroke-width="1"/>`;
    y += dayHeaderH;
    for (const sc of d.slices) {
      const cy = y + rowH / 2;
      const label = (opts.showIcons && sc.icon ? sc.icon + ' ' : '') + ((sc.label || '').trim() || '—');
      body +=
        `<circle cx="${padX + 8}" cy="${cy}" r="6" fill="${esc(sc.color || '#9ca3af')}"/>` +
        `<text x="${padX + 26}" y="${cy}" dominant-baseline="middle" font-size="14" fill="#6b7280">${esc(sc.startTime)} ~ ${esc(sc.endTime)}</text>` +
        `<text x="${padX + 150}" y="${cy}" dominant-baseline="middle" font-size="14" fill="#1f2430">${esc(label)}</text>`;
      y += rowH;
    }
    y += gap;
  }
  const H = y + footerH;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">` +
    `<rect width="${W}" height="${H}" fill="#ffffff"/>` +
    `<text x="${padX}" y="34" font-size="20" font-weight="800" fill="#1f2430">${esc(title)}</text>` +
    body +
    `<text x="${W / 2}" y="${H - 14}" text-anchor="middle" font-size="12" fill="rgba(120,130,150,0.7)">24houring.com</text>` +
    `</svg>`;
  return { svg, width: W, height: H };
}

export async function exportRangePng(days: RangeDay[], title: string, format: 'circle' | 'table', opts: { showIcons?: boolean } = {}): Promise<void> {
  const { svg, width, height } = format === 'table' ? buildRangeTableSvg(days, title, opts) : buildRangeCircleSvg(days, title, opts);
  const blob = await svgToPngBlob(svg, width, height);
  triggerDownload(blob, `${safeName(title)}-${format}.png`);
}

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
export function exportRangeCsv(days: RangeDay[], title: string): void {
  const rows: string[][] = [['date', 'start', 'end', 'label', 'color']];
  for (const d of days) for (const s of d.slices) rows.push([d.date, s.startTime, s.endTime, (s.label || '').trim(), s.color || '']);
  const body = rows.map((r) => r.map((c) => csvCell(String(c))).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${safeName(title)}.csv`);
}
