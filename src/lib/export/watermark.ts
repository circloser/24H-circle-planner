import qrcode from 'qrcode-generator';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The brand wordmark stamped onto exports/shares. */
export const WATERMARK_TEXT = '24houring.com';

/** Canonical app URL the share QR points to (see [[production-domain]]). */
export const APP_URL = 'https://24houring.com';

/**
 * Stamp a small, subtle brand wordmark into the bottom margin of an export SVG
 * clone (below the 12 o'clock label, inside the padded viewBox). Baked in before
 * rasterization so every downloaded/shared image carries the source — the viral
 * loop (free tier). A future Pro tier can skip this by passing the clone through
 * without calling addWatermark. The colour is a resolved rgba (no CSS var) so it
 * survives standalone `<img>` rendering, and reads on light or transparent bgs.
 */
export function addWatermark(svg: SVGSVGElement): void {
  // Avoid double-stamping (preview + export share the same clone pipeline only
  // one at a time, but be defensive).
  if (svg.querySelector('[data-watermark]')) return;
  const text = document.createElementNS(SVG_NS, 'text');
  text.setAttribute('x', '500');
  text.setAttribute('y', '1026');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('font-size', '21');
  text.setAttribute('font-weight', '600');
  text.setAttribute('letter-spacing', '0.5');
  text.setAttribute('fill', 'rgba(120, 130, 150, 0.62)');
  text.setAttribute('font-family', 'inherit');
  text.setAttribute('data-watermark', '1');
  text.textContent = WATERMARK_TEXT;
  svg.appendChild(text);
}

/**
 * Stamp a small, scannable QR into the bottom-right corner of an export SVG clone
 * (in the padded margin, OUTSIDE the ring annulus — so it never touches the chart
 * or the visual-diff gate). Makes a shared image directly actionable: scan → open
 * the app. Baked in before rasterization; the viral loop's actionable half
 * alongside the wordmark. Silently skips if the URL exceeds QR capacity.
 *
 * The chart viewBox is `-36 -36 1072 1072` (edges at -36 … 1036); the QR sits in
 * the free bottom-right corner beyond the ring (radius 460 from centre 500).
 */
export function addShareQr(svg: SVGSVGElement, url: string = APP_URL): void {
  if (svg.querySelector('[data-share-qr]')) return;
  let count: number;
  let dark: boolean[][];
  try {
    const qr = qrcode(0, 'M'); // auto version, medium error correction
    qr.addData(url);
    qr.make();
    count = qr.getModuleCount();
    dark = Array.from({ length: count }, (_, r) =>
      Array.from({ length: count }, (_, c) => qr.isDark(r, c)),
    );
  } catch {
    return; // exceeds QR capacity — skip rather than break the export
  }

  const QR = 132; // module-grid size in viewBox units
  const PAD = 12; // white quiet-zone padding around the grid
  const CARD = QR + PAD * 2;
  const EDGE = 1036; // viewBox max (‑36 + 1072)
  const INSET = 6;
  const x0 = EDGE - INSET - CARD;
  const y0 = EDGE - INSET - CARD;
  const m = QR / count; // per-module size

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('data-share-qr', '1');

  const card = document.createElementNS(SVG_NS, 'rect');
  card.setAttribute('x', String(x0));
  card.setAttribute('y', String(y0));
  card.setAttribute('width', String(CARD));
  card.setAttribute('height', String(CARD));
  card.setAttribute('rx', '14');
  card.setAttribute('fill', 'rgba(255,255,255,0.94)');
  g.appendChild(card);

  // One <path> for all dark modules (keeps the serialized SVG small).
  const parts: string[] = [];
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (dark[r][c]) {
        const px = (x0 + PAD + c * m).toFixed(2);
        const py = (y0 + PAD + r * m).toFixed(2);
        parts.push(`M${px} ${py}h${m.toFixed(2)}v${m.toFixed(2)}h-${m.toFixed(2)}z`);
      }
    }
  }
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', parts.join(''));
  path.setAttribute('fill', '#1f2937');
  path.setAttribute('shape-rendering', 'crispEdges');
  g.appendChild(path);

  svg.appendChild(g);
}
