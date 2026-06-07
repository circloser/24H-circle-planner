import { exportPng } from './png';

/**
 * Exports the given SVG as an A4 PDF Blob.
 *
 * The chart (including the center-hub title) is rasterized to a high-resolution
 * PNG via the browser's own font pipeline — the same path the PNG export uses,
 * which renders Korean correctly. The PNG is then placed on an A4 page.
 *
 * Why rasterize instead of svg2pdf vector text: jsPDF embeds TTF (glyf)
 * fonts reliably but mangles OTF/CFF outlines (Pretendard ships as OTF), which
 * produced broken/garbled Korean glyphs. Rasterizing sidesteps font embedding
 * entirely. Trade-off: the PDF text is not selectable, but it renders correctly.
 */
export async function exportPdf(
  sourceSvg: SVGSVGElement,
  opts: { scheduleName: string },
): Promise<Blob> {
  void opts; // schedule name is rendered inside the chart hub, not as PDF text

  // 1. Rasterize the whole chart at high resolution (solid background).
  const pngBlob = await exportPng(sourceSvg, { size: 2160, transparent: false });
  const dataUrl = await blobToDataURL(pngBlob);

  // 2. Place it centered on an A4 portrait page (210×297 mm), 10 mm margins.
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const pageW = 210;
  const pageH = 297;
  const margin = 10;
  const side = pageW - margin * 2; // 190 mm square
  const x = margin;
  const y = (pageH - side) / 2; // vertically centered

  doc.addImage(dataUrl, 'PNG', x, y, side, side);

  return doc.output('blob');
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('blobToDataURL failed'));
    reader.readAsDataURL(blob);
  });
}
