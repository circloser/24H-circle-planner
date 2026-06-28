import { describe, it, expect } from 'vitest';
import { slicesToCsv, buildTableSvg } from '../tableExport';
import type { TimeSlice } from '@/types/time-slice';

const sl = (startTime: string, endTime: string, label: string, color = '#abc'): TimeSlice => ({
  id: 'x', label, startTime, endTime, color, icon: '', textPosition: 'inside',
});

describe('slicesToCsv', () => {
  it('has a BOM, header, and one quoted row per slice', () => {
    const csv = slicesToCsv([sl('00:00', '07:00', 'sleep'), sl('07:00', '24:00', 'a, b "c"')]);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM so Excel reads Korean
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('start,end,label,color');
    expect(lines[1]).toBe('00:00,07:00,sleep,#abc');
    expect(lines[2]).toBe('07:00,24:00,"a, b ""c""",#abc'); // comma + quotes escaped
  });
});

describe('buildTableSvg', () => {
  it('builds an SVG sized to the rows, escaping labels + branding', () => {
    const { svg, height } = buildTableSvg([sl('00:00', '24:00', '<x>')], 'My Day');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('&lt;x&gt;'); // label escaped
    expect(svg).toContain('24houring.com');
    expect(height).toBeGreaterThan(60);
  });
});
