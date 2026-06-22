import { FloatingPanel } from './FloatingPanel';
import { AnalogClock } from './AnalogClock';
import { useNow, pad2, type Pos } from './clock-utils';
import type { ClockState } from './useClockTools';
import { useTranslation } from '@/hooks/usePreferences';

interface ClockWidgetProps {
  clock: ClockState;
  onMove: (p: Pos) => void;
  onClose: () => void;
  onToggleMode: () => void;
}

export function ClockWidget({ clock, onMove, onClose, onToggleMode }: ClockWidgetProps) {
  const { t } = useTranslation();
  const now = useNow(true);

  const switchBtn = (
    <button
      type="button"
      data-no-drag
      onClick={onToggleMode}
      className="rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors"
      style={{
        backgroundColor: 'hsl(var(--accent) / 0.15)',
        color: 'hsl(var(--foreground))',
        border: '1px solid hsl(var(--border))',
      }}
    >
      {clock.mode === 'analog' ? t('clock.digital') : t('clock.analog')}
    </button>
  );

  return (
    <FloatingPanel
      pos={clock.pos}
      width={184}
      title={t('clock.clock')}
      closeLabel={t('clock.close')}
      onMove={onMove}
      onClose={onClose}
      headerRight={switchBtn}
    >
      {clock.mode === 'analog' ? (
        <div className="grid place-items-center py-1">
          <AnalogClock date={now} size={150} />
        </div>
      ) : (
        <div className="py-4 text-center" style={{ color: 'hsl(var(--foreground))' }}>
          <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 38, fontWeight: 800, letterSpacing: 1, lineHeight: 1 }}>
            {pad2(now.getHours())}:{pad2(now.getMinutes())}
            <span style={{ fontSize: 20, fontWeight: 700, opacity: 0.65 }}>:{pad2(now.getSeconds())}</span>
          </div>
          <div className="mt-1.5 text-xs" style={{ color: 'hsl(var(--text-muted))' }}>
            {now.toLocaleDateString()}
          </div>
        </div>
      )}
    </FloatingPanel>
  );
}
