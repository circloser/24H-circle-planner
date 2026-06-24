const SVG_NS = 'http://www.w3.org/2000/svg';

/** The brand wordmark stamped onto exports/shares. */
export const WATERMARK_TEXT = '24houring.com';

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
