import { injectFontFaceStyle } from './inlineFonts';

/**
 * Rasterizes the glass-ring-backdrop element from the source SVG to a PNG data URL.
 *
 * Only the backdrop path, its referenced <filter>, and <defs> are preserved in the
 * clone — everything else is stripped so the canvas captures only the glass effect.
 *
 * Used in the hybrid PDF pipeline: rasterized layer goes into jsPDF via addImage,
 * then the vector layer (slices + text) is overlaid via svg2pdf.
 */
export async function rasterizeBackdrop(
  sourceSvg: SVGSVGElement,
  options: { width: number; height: number },
): Promise<string /* PNG data URL */> {
  const { width, height } = options;

  // 1. Deep-clone the SVG
  const clone = sourceSvg.cloneNode(true) as SVGSVGElement;

  // 2. Find the backdrop node in the clone
  const backdrop = clone.querySelector('.glass-ring-backdrop') as SVGElement | null;

  // 3. Collect all top-level children that are NOT defs and NOT the backdrop
  //    We walk children of the SVG root and remove everything except defs + backdrop's parent chain
  const toRemove: Element[] = [];
  for (const child of Array.from(clone.children)) {
    if (child.tagName === 'defs') {
      // Keep defs, but strip all <filter> elements that are NOT referenced by backdrop
      const backdropFilter = backdrop?.getAttribute('filter');
      const referencedFilterId = backdropFilter
        ? backdropFilter.replace(/^url\(#/, '').replace(/\)$/, '')
        : null;

      // Remove filter definitions that are NOT the glass-blur filter
      for (const defChild of Array.from(child.children)) {
        if (defChild.tagName === 'filter') {
          if (!referencedFilterId || defChild.id !== referencedFilterId) {
            defChild.remove();
          }
        }
      }
      continue;
    }

    if (backdrop && (child === backdrop || child.contains(backdrop))) {
      // Keep this element — it is or contains the backdrop
      continue;
    }

    // Remove everything else (rect backgrounds, slice groups, label groups, etc.)
    toRemove.push(child);
  }

  for (const el of toRemove) {
    el.remove();
  }

  // If backdrop was nested inside a removed element it won't be in the DOM any more.
  // Re-append it directly if it's no longer attached.
  if (backdrop && !clone.contains(backdrop)) {
    clone.appendChild(backdrop);
  }

  // 4. Inject font-face (defensive — in case backdrop renders any text)
  injectFontFaceStyle(clone);

  // 5. Serialize, create Blob, object URL
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const objectUrl = URL.createObjectURL(blob);

  try {
    // 6. Load into Image, await decode
    const img = new Image();
    img.src = objectUrl;
    await img.decode();

    // 7. Render to OffscreenCanvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('rasterizeBackdrop: could not get 2d context from OffscreenCanvas');
    ctx.drawImage(img, 0, 0, width, height);

    // 8. Convert to PNG blob → data URL
    const pngBlob = await canvas.convertToBlob({ type: 'image/png' });

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('rasterizeBackdrop: FileReader failed'));
      reader.readAsDataURL(pngBlob);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
