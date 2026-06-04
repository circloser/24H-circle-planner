import { injectFontFaceStyle } from './inlineFonts';

/**
 * Returns a deep-cloned SVGSVGElement with:
 *  - The .glass-ring-backdrop path removed
 *  - All filter= attributes removed from every element
 *  - All <filter> definitions removed from <defs>
 *  - All fill-opacity attributes removed from [data-slice-id] paths (G7: 100% opaque slices)
 *  - @font-face declarations injected (so svg2pdf can map text to Pretendard)
 *
 * The returned element is NOT attached to the document.
 */
export function stripFiltersAndBackdrop(sourceSvg: SVGSVGElement): SVGSVGElement {
  // 1. Deep-clone
  const clone = sourceSvg.cloneNode(true) as SVGSVGElement;

  // 2. Remove the .glass-ring-backdrop path
  const backdrop = clone.querySelector('.glass-ring-backdrop');
  if (backdrop) {
    backdrop.remove();
  }

  // 2a. Remove any elements tagged data-export-exclude (e.g. now-indicator line)
  for (const el of Array.from(clone.querySelectorAll('[data-export-exclude]'))) {
    el.remove();
  }

  // 3. Walk all elements; remove filter attributes and <filter> definitions
  const allElements = Array.from(clone.querySelectorAll('*'));
  for (const el of allElements) {
    if (el.hasAttribute('filter')) {
      el.removeAttribute('filter');
    }
    if (el.tagName === 'filter') {
      el.remove();
    }
  }

  // Also remove any remaining <filter> elements inside <defs>
  const defs = clone.querySelector('defs');
  if (defs) {
    for (const child of Array.from(defs.querySelectorAll('filter'))) {
      child.remove();
    }
  }

  // 4. For every [data-slice-id] path, remove fill-opacity (G7: 100% opaque fills)
  const slicePaths = clone.querySelectorAll('[data-slice-id]');
  for (const path of Array.from(slicePaths)) {
    path.removeAttribute('fill-opacity');
  }

  // 5. Inject @font-face so svg2pdf can map text to Pretendard
  injectFontFaceStyle(clone);

  return clone;
}
