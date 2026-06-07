/**
 * Inline the computed fill/stroke paint from a LIVE source SVG onto a CLONE,
 * so that elements styled via CSS classes (e.g. `.glass-hub-disc`,
 * `.glass-ring-backdrop`) keep their colour when the clone is serialized and
 * rendered as a standalone `<img>` (where the external stylesheet does not
 * apply, and unstyled fills default to black).
 *
 * Source and clone must have identical structure (clone = source.cloneNode(true))
 * so `querySelectorAll('*')` yields elements in the same order.
 */
export function inlineComputedPaint(source: SVGSVGElement, clone: SVGSVGElement): void {
  const srcEls = source.querySelectorAll('*');
  const cloneEls = clone.querySelectorAll('*');
  const n = Math.min(srcEls.length, cloneEls.length);

  for (let i = 0; i < n; i++) {
    const src = srcEls[i];
    const dst = cloneEls[i] as SVGElement;
    if (!(src instanceof SVGElement)) continue;

    const cs = getComputedStyle(src);

    // Only inline paint when it resolves to a real colour. This covers
    // class-driven fills/strokes; elements that already have an inline
    // attribute keep the same resolved value, so this is idempotent.
    const fill = cs.fill;
    if (fill && fill !== 'none' && !dst.getAttribute('fill')) {
      dst.setAttribute('fill', fill);
    }
    const fillOpacity = cs.fillOpacity;
    if (fillOpacity && fillOpacity !== '1' && !dst.getAttribute('fill-opacity')) {
      dst.setAttribute('fill-opacity', fillOpacity);
    }
    const stroke = cs.stroke;
    if (stroke && stroke !== 'none' && !dst.getAttribute('stroke')) {
      dst.setAttribute('stroke', stroke);
    }
  }
}
