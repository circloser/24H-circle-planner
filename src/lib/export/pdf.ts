import { pretendardRegularTtfUrl, pretendardBoldTtfUrl } from '@/data/fonts';
import { rasterizeBackdrop } from './rasterizeBackdrop';
import { stripFiltersAndBackdrop } from './stripFilters';
import { arrayBufferToBase64 } from './_internal';

/**
 * Exports the given SVG as an A4 PDF Blob using the hybrid jsPDF + svg2pdf pipeline.
 *
 * Pipeline:
 *  1. Rasterize the glass-ring-backdrop to PNG → addImage (raster layer)
 *  2. Strip filters + backdrop from SVG clone → svg2pdf overlay (vector layer)
 *  3. Add Pretendard TTF fonts via addFileToVFS so Korean text is selectable (C2)
 *
 * A4 layout: 210×297 mm, portrait, 10 mm margin, ring at x=10 y=50 w=190 h=190.
 * Title centered at y=30 mm.
 */
export async function exportPdf(
  sourceSvg: SVGSVGElement,
  opts: { scheduleName: string },
): Promise<Blob> {
  // 1. Dynamic-import jsPDF and svg2pdf (keeps them out of the main bundle)
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js'),
  ]);

  // 2. Fetch TTF bytes lazily (OTF format — same addFont API as TTF)
  const [regBuf, boldBuf] = await Promise.all([
    fetch(pretendardRegularTtfUrl).then((r) => r.arrayBuffer()),
    fetch(pretendardBoldTtfUrl).then((r) => r.arrayBuffer()),
  ]);

  const regBase64 = arrayBufferToBase64(regBuf);
  const boldBase64 = arrayBufferToBase64(boldBuf);

  // 3. Create jsPDF document
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.addFileToVFS('Pretendard-Regular.ttf', regBase64);
  doc.addFont('Pretendard-Regular.ttf', 'Pretendard', 'normal');
  doc.addFileToVFS('Pretendard-Bold.ttf', boldBase64);
  doc.addFont('Pretendard-Bold.ttf', 'Pretendard', 'bold');
  doc.setFont('Pretendard', 'normal');

  // 4. A4 layout constants (mm)
  // Page: 210×297 mm. Ring: x=10, y=50, w=190, h=190 (10mm margin, ~50mm top for title)
  const ringX = 10;
  const ringY = 50;
  const ringW = 190;
  const ringH = 190;

  // 5. Rasterize backdrop at 1900×1900 (matches ring w/h ratio in high-res)
  const backdropPngDataUrl = await rasterizeBackdrop(sourceSvg, {
    width: 1900,
    height: 1900,
  });
  doc.addImage(backdropPngDataUrl, 'PNG', ringX, ringY, ringW, ringH);

  // 6. Overlay vector layer (slices + text, no filters, no backdrop)
  const vectorSvg = stripFiltersAndBackdrop(sourceSvg);
  await svg2pdf(vectorSvg, doc, { x: ringX, y: ringY, width: ringW, height: ringH });

  // 7. Add title at top (centered)
  doc.setFontSize(14);
  doc.text(`'${opts.scheduleName}' 24시간 계획`, 105, 30, { align: 'center' });

  // 8. Return as Blob
  return doc.output('blob');
}
