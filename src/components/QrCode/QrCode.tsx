import qrcode from 'qrcode-generator';

interface QrCodeProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Renders a string as a scannable QR code (inline SVG, no network). Returns null
 * if the value is too large to encode — the caller shows an alternative.
 */
export function QrCode({ value, size = 200, className }: QrCodeProps) {
  let count: number;
  let path: string;
  try {
    const qr = qrcode(0, 'M'); // auto version, medium error correction
    qr.addData(value);
    qr.make();
    count = qr.getModuleCount();
    const parts: string[] = [];
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) parts.push(`M${c} ${r}h1v1h-1z`);
      }
    }
    path = parts.join('');
  } catch {
    return null; // exceeds QR capacity
  }
  const margin = 4; // quiet zone (modules)
  const dim = count + margin * 2;
  return (
    <svg
      viewBox={`0 0 ${dim} ${dim}`}
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR"
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      <path transform={`translate(${margin} ${margin})`} d={path} fill="#000000" />
    </svg>
  );
}
