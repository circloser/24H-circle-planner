import { useEffect, useRef } from 'react';
import { BellRing, BellOff } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import { useNow, pad2, type Pos } from './clock-utils';
import type { AlarmState } from './useClockTools';
import { useTranslation } from '@/hooks/usePreferences';

interface AlarmWidgetProps {
  alarm: AlarmState;
  onChange: (patch: Partial<AlarmState>) => void;
  onMove: (p: Pos) => void;
  onClose: () => void;
  onRing: () => void;
}

export function AlarmWidget({ alarm, onChange, onMove, onClose, onRing }: AlarmWidgetProps) {
  const { t } = useTranslation();
  const now = useNow(alarm.enabled);
  const lastRef = useRef('');

  // Ring once when the clock reaches the alarm minute (guarded per day+minute, so
  // an enabled alarm fires again at the same time the next day).
  useEffect(() => {
    if (!alarm.enabled) return;
    const cur = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
    const stamp = `${now.toDateString()} ${cur}`;
    if (cur === alarm.time && lastRef.current !== stamp) {
      lastRef.current = stamp;
      onRing();
    }
  }, [now, alarm.enabled, alarm.time, onRing]);

  return (
    <FloatingPanel
      pos={alarm.pos}
      width={196}
      title={t('clock.alarm')}
      closeLabel={t('clock.close')}
      onMove={onMove}
      onClose={onClose}
    >
      <div className="flex items-center justify-center gap-2 py-1" data-no-drag>
        <input
          type="time"
          value={alarm.time}
          onChange={(e) => onChange({ time: e.target.value })}
          aria-label={t('clock.alarmTime')}
          className="rounded-md px-2 py-1 text-2xl font-bold"
          style={{
            fontVariantNumeric: 'tabular-nums',
            backgroundColor: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
          }}
        />
      </div>

      <button
        type="button"
        data-no-drag
        onClick={() => onChange({ enabled: !alarm.enabled })}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold transition-colors"
        style={
          alarm.enabled
            ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }
            : { backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }
        }
      >
        {alarm.enabled ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        {alarm.enabled ? t('clock.alarmOn') : t('clock.alarmOff')}
      </button>
    </FloatingPanel>
  );
}
