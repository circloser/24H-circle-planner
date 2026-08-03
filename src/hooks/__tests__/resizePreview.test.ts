import { describe, it, expect } from 'vitest';
import { applyResizePreview } from '../useSliceInteraction';
import { resizeBoundary } from '@/lib/schedule';
import { slicePath, RING } from '@/lib/svg-geometry';
import { FULL_SPEC } from '@/lib/chart-view';
import { minutesToHhmm } from '@/lib/time-utils';
import type { Schedule } from '@/types/schedule';
import type { TimeSlice } from '@/types/time-slice';

/** Minimal fake SVG root: resolves path[data-slice-id] and [data-label-id]
 *  selectors to recording stubs, mirroring the real DOM contract the preview
 *  writes through. */
function fakeSvg(sliceIds: string[]) {
  const paths = new Map<string, { attrs: Record<string, string> }>();
  const labels = new Map<string, { style: { display: string }; transform: string }>();
  sliceIds.forEach((id) => {
    paths.set(id, { attrs: { d: 'ORIG' } });
    labels.set(id, { style: { display: '' }, transform: '' });
  });
  const pathEl = (id: string) => {
    const rec = paths.get(id)!;
    return { setAttribute: (k: string, v: string) => { rec.attrs[k] = v; } };
  };
  const labelEl = (id: string) => {
    const rec = labels.get(id)!;
    return {
      getAttribute: (k: string) => (k === 'data-label-kind' ? 'inside' : null),
      setAttribute: (k: string, v: string) => { if (k === 'transform') rec.transform = v; },
      style: rec.style,
    };
  };
  const svg = {
    querySelector: (sel: string) => {
      let m = sel.match(/path\[data-slice-id="([^"]+)"\]/);
      if (m) return paths.has(m[1]) ? pathEl(m[1]) : null;
      m = sel.match(/\[data-label-id="([^"]+)"\]/);
      if (m) return labels.has(m[1]) ? labelEl(m[1]) : null;
      return null;
    },
    querySelectorAll: () => [],
  } as unknown as SVGSVGElement;
  return { svg, paths, labels };
}

function mk(starts: number[]): Schedule {
  const slices: TimeSlice[] = starts.map((st, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : 1440;
    return {
      id: `s${i}`, label: `L${i}`, icon: '', color: '#abcdef', textPosition: 'inside',
      startTime: minutesToHhmm(st), endTime: end === 1440 ? '24:00' : minutesToHhmm(end),
    };
  });
  return { id: 'x', version: 1, name: 't', slices, updatedAt: '', presetSource: null } as Schedule;
}

describe('applyResizePreview (over-drag absorption)', () => {
  it('absorbs the neighbour: blanks its wedge + hides its label, survivors get new geometry', () => {
    // 4 slices at 00,06,12,18. Drag boundary 0 (end of s0, at 06:00) FORWARD past
    // s1 entirely (target 13:00) → resizeBoundary absorbs s1; s0 extends over it.
    const snapshot = mk([0, 360, 720, 1080]);
    const preview = resizeBoundary(snapshot, 0, '13:00');
    // Sanity: s1 is gone from the committed preview.
    expect(preview.slices.some((s) => s.id === 's1')).toBe(false);

    const { svg, paths, labels } = fakeSvg(['s0', 's1', 's2', 's3']);
    const hidden = applyResizePreview(svg, snapshot.slices, preview, FULL_SPEC);

    // Absorbed slice: wedge blanked, label hidden, reported.
    expect(paths.get('s1')!.attrs.d).toBe('');
    expect(labels.get('s1')!.style.display).toBe('none');
    expect(hidden.has('s1')).toBe(true);

    // Survivor s0 redrawn to its NEW (extended) geometry, label shown.
    const s0New = preview.slices.find((s) => s.id === 's0')!;
    expect(paths.get('s0')!.attrs.d).toBe(slicePath(s0New, RING));
    expect(labels.get('s0')!.style.display).toBe('');
    expect(hidden.has('s0')).toBe(false);
  });

  it('identity preview (cancel path) restores every wedge + un-hides all labels', () => {
    const snapshot = mk([0, 360, 720, 1080]);
    const { svg, paths, labels } = fakeSvg(['s0', 's1', 's2', 's3']);
    // Pretend a prior over-drag hid s1.
    labels.get('s1')!.style.display = 'none';
    paths.get('s1')!.attrs.d = '';

    const hidden = applyResizePreview(svg, snapshot.slices, snapshot, FULL_SPEC);

    expect(hidden.size).toBe(0);
    for (const s of snapshot.slices) {
      expect(labels.get(s.id)!.style.display).toBe('');
      expect(paths.get(s.id)!.attrs.d).toBe(slicePath(s, RING));
    }
  });
});
