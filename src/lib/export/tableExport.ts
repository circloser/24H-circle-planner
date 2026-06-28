import type { TimeSlice } from '@/types/time-slice';

// ─── Download helper ──────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function safeName(name: string | undefined): string {
  const cleaned = (name || '').replace(/[^\w가-힣 .-]/g, '').trim().slice(0, 40);
  return cleaned || '24houring';
}

// ─── CSV ───────────────────────────────────────────────────────────────────────

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Build a CSV (with BOM, so Excel reads UTF-8/Korean) for the timetable. */
export function slicesToCsv(slices: TimeSlice[]): string {
  const header = ['start', 'end', 'label', 'color'];
  const rows = slices.map((s) => [s.startTime, s.endTime, (s.label || '').trim(), s.color || '']);
  const body = [header, ...rows].map((r) => r.map((c) => csvCell(String(c))).join(',')).join('\r\n');
  return '﻿' + body;
}

export function exportTableCsv(slices: TimeSlice[], name?: string): void {
  const blob = new Blob([slicesToCsv(slices)], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `${safeName(name)}.csv`);
}

// ─── PNG image of the table ─────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Build a standalone SVG that mirrors the table view (one row per slice). */
export function buildTableSvg(slices: TimeSlice[], title?: string): { svg: string; width: number; height: number } {
  const W = 520;
  const padX = 24;
  const padTop = 60;
  const rowH = 40;
  const padBottom = 44;
  const H = padTop + slices.length * rowH + padBottom;

  const rows = slices
    .map((s, i) => {
      const y = padTop + i * rowH;
      const cy = y + rowH / 2;
      const label = (s.label || '').trim() || '—';
      const text = (s.icon ? `${s.icon} ` : '') + label;
      return [
        `<circle cx="${padX + 8}" cy="${cy}" r="7" fill="${esc(s.color || '#9ca3af')}"/>`,
        `<text x="${padX + 28}" y="${cy}" dominant-baseline="middle" font-size="15" fill="#6b7280">${esc(s.startTime)} ~ ${esc(s.endTime)}</text>`,
        `<text x="${padX + 150}" y="${cy}" dominant-baseline="middle" font-size="15" fill="#1f2430">${esc(text)}</text>`,
        `<line x1="${padX}" y1="${y + rowH}" x2="${W - padX}" y2="${y + rowH}" stroke="#e3e6ec" stroke-width="1"/>`,
      ].join('');
    })
    .join('');

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ` +
    `font-family="Pretendard, system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif">` +
    `<rect width="${W}" height="${H}" fill="#ffffff"/>` +
    `<text x="${padX}" y="36" font-size="20" font-weight="700" fill="#1f2430">${esc(title || '내 하루')}</text>` +
    `<line x1="${padX}" y1="${padTop}" x2="${W - padX}" y2="${padTop}" stroke="#e3e6ec" stroke-width="1"/>` +
    rows +
    `<text x="${W / 2}" y="${H - 16}" text-anchor="middle" font-size="12" fill="rgba(120,130,150,0.7)">24houring.com</text>` +
    `</svg>`;
  return { svg, width: W, height: H };
}

async function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = 2; // crisp on retina
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('exportTablePng: no 2d context');
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

export async function exportTablePng(slices: TimeSlice[], name?: string): Promise<void> {
  const { svg, width, height } = buildTableSvg(slices, name);
  const blob = await svgToPngBlob(svg, width, height);
  triggerDownload(blob, `${safeName(name)}-table.png`);
}
