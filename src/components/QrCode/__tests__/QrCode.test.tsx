import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { QrCode } from '../QrCode';

describe('QrCode', () => {
  it('renders an SVG QR with modules for a normal value', () => {
    const { container } = render(<QrCode value="https://24houring.com/#p=abc123" />);
    const svg = container.querySelector('svg[aria-label="QR"]');
    expect(svg).toBeTruthy();
    const d = svg?.querySelector('path')?.getAttribute('d') || '';
    expect(d.length).toBeGreaterThan(50); // dark modules drawn
  });

  it('returns null when the value is too large to encode', () => {
    const { container } = render(<QrCode value={'x'.repeat(5000)} />);
    expect(container.querySelector('svg[aria-label="QR"]')).toBeNull();
  });
});
