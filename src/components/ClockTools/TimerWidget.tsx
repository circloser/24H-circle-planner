import { useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { useNow, formatHMS, type Pos } from './clock-utils';
import type { TimerState } from './useClockTools';
import { useTranslation } from '@/hooks/usePreferences';

interface TimerWidgetProps {
  timer: TimerState;
  onChange: (patch: Partial<TimerState>) => void;
  onMove: (p: Pos) => void;
  onClose: () => void;
  onRing: () => void;
}

const quickBtn =
  'rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40';
const quickStyle: React.CSSProperties = {
  backgroundColor: 'hsl(var(--surface))',
  color: 'hsl(var(--foreground))',
  border: '1px solid hsl(var(--border))',
};

export function TimerWidget({ timer, onChange, onMove, onClose, onRing }: TimerWidgetProps) {
  const { t } = useTranslation();
  const now = useNow(timer.running);
  const firedRef = useRef(false);

  const remaining = timer.running && timer.endAt
    ? Math.max(0, Math.ceil((timer.endAt - now.getTime()) / 1000))
    : timer.remainingSec;

  // Fire once when a running countdown reaches zero.
  useEffect(() => {
    if (!timer.running) {
      firedRef.current = false;
      return;
    }
    if (remaining <= 0 && !firedRef.current) {
      firedRef.current = true;
      onRing();
      onChange({ running: false, endAt: null, remainingSec: 0 });
    }
  }, [timer.running, remaining, onRing, onChange]);

  const add = (sec: number) => {
    if (timer.running) return;
    onChange({ setSec: Math.max(0, timer.setSec + sec), remainingSec: Math.max(0, timer.remainingSec + sec) });
  };
  const start = () => {
    if (timer.remainingSec <= 0) return;
    onChange({ running: true, endAt: Date.now() + timer.remainingSec * 1000 });
  };
  const pause = () => {
    const rem = timer.endAt ? Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000)) : timer.remainingSec;
    onChange({ running: false, endAt: null, remainingSec: rem });
  };
  const reset = () => onChange({ running: false, endAt: null, remainingSec: timer.setSec });

  return (
    <FloatingPanel
      pos={timer.pos}
      width={196}
      title={t('clock.timer')}
      closeLabel={t('clock.close')}
      onMove={onMove}
      onClose={onClose}
    >
      <div
        className="mb-2 text-center"
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: 40,
          fontWeight: 800,
          letterSpacing: 1,
          lineHeight: 1.05,
          color: remaining <= 5 && timer.running ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))',
        }}
      >
        {formatHMS(remaining)}
      </div>

      <div className="mb-2 grid grid-cols-3 gap-1.5" data-no-drag>
        <button type="button" className={quickBtn} style={quickStyle} disabled={timer.running} onClick={() => add(60)}>
          +1:00
        </button>
        <button type="button" className={quickBtn} style={quickStyle} disabled={timer.running} onClick={() => add(10)}>
          +0:10
        </button>
        <button
          type="button"
          className={quickBtn}
          style={quickStyle}
          disabled={timer.running}
          onClick={() => onChange({ setSec: 0, remainingSec: 0 })}
        >
          {t('clock.clear')}
        </button>
      </div>

      <div className="flex gap-1.5" data-no-drag>
        <button
          type="button"
          onClick={timer.running ? pause : start}
          disabled={!timer.running && timer.remainingSec <= 0}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40"
          style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
        >
          {timer.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {timer.running ? t('clock.pause') : t('clock.start')}
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label={t('clock.reset')}
          title={t('clock.reset')}
          className="grid h-[34px] w-[34px] place-items-center rounded-md transition-colors"
          style={quickStyle}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </FloatingPanel>
  );
}
