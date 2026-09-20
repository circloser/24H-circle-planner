/**
 * The life line as an A4 PDF — something to print and keep, or hand to the
 * family at a gathering.
 *
 * The line is one very tall image, so the pages are slices of it, each cut at
 * the same width and overlapped slightly so a card is never sliced in half
 * without being whole on the next page. Nothing is uploaded: the image is
 * drawn on the device and the pages are cut from it there.
 */

/** A4 in millimetres, with a margin the printer can hold. */
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
/** How much of the previous page repeats at the top of the next one. */
export const OVERLAP = 0.06;

export interface PdfPage {
  /** Source rectangle in the tall image, in pixels. */
  sy: number;
  sh: number;
}

/**
 * How the image is cut into pages: each page shows a band as wide as the
 * image, as tall as the printable area allows, with `overlap` repeated.
 */
export function pdfPages(width: number, height: number, overlap = OVERLAP): PdfPage[] {
  const printW = PAGE_W - MARGIN * 2;
  const printH = PAGE_H - MARGIN * 2;
  // Pixels of the image that fit on one page, at the scale the width sets.
  const band = Math.max(1, Math.round((printH / printW) * width));
  if (height <= band) return [{ sy: 0, sh: height }];
  const step = Math.max(1, Math.round(band * (1 - overlap)));
  const pages: PdfPage[] = [];
  for (let sy = 0; sy < height; sy += step) {
    const sh = Math.min(band, height - sy);
    pages.push({ sy, sh });
    if (sy + band >= height) break;
  }
  return pages;
}

/** Cut a tall PNG into A4 pages. `png` is the image as a blob. */
export async function lifePdf(png: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(png);
  const pages = pdfPages(bitmap.width, bitmap.height);
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const printW = PAGE_W - MARGIN * 2;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  for (const [i, page] of pages.entries()) {
    canvas.width = bitmap.width;
    canvas.height = page.sh;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, page.sy, bitmap.width, page.sh, 0, 0, bitmap.width, page.sh);
    if (i > 0) doc.addPage();
    doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', MARGIN, MARGIN, printW, (page.sh / bitmap.width) * printW);
  }
  bitmap.close?.();
  return doc.output('blob');
}
