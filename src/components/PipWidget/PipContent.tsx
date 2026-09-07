import { CircleTimeline } from '@/components/CircleTimeline/CircleTimeline';
import { useStoreSelector } from '@/hooks/useScheduleStore';

/** The widget's content — rendered into the PiP window through a portal.
 *  Ring only (user feedback dropped the now/next card), with the chart's own
 *  font-scale var boosted so labels read at a glance: the ring grew 230→360
 *  (×1.56) and the 1.3 var multiplies on top — ≈2× text overall. */
export function PipContent() {
  const slices = useStoreSelector((s) => s.history.present.slices);
  return (
    <div
      className="grid h-full w-full place-items-center overflow-hidden bg-surface text-foreground"
      style={{ '--app-font-scale': '1.3' } as React.CSSProperties}
    >
      {/* Square sized to the PiP window's own viewport — Chrome doesn't honour
          the requested window size exactly (chrome/clamping), and the user can
          resize; a fixed ring size clipped. The chart is responsive (no `size`),
          so it always fills this square edge to edge. */}
      <div style={{ width: 'min(100vw, 100vh)', height: 'min(100vw, 100vh)', padding: 6 }}>
        <CircleTimeline slices={slices} mode="preview" />
      </div>
    </div>
  );
}

