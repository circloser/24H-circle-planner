import { FloatingPanel } from './FloatingPanel';
import type { Pos } from './clock-utils';
import type { CalendarState } from './useClockTools';
import { useTranslation } from '@/hooks/usePreferences';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { NowNextCard } from '@/components/NowNext/NowNextCard';

interface NowNextWidgetProps {
  nownext: CalendarState; // { on, pos } — same shape as the calendar singleton
  onMove: (p: Pos) => void;
  onClose: () => void;
}

/** Floating "지금 & 다음" panel — reads the active schedule from the store and
 *  shows the current block + what's next. Draggable/closable like the other tools. */
export function NowNextWidget({ nownext, onMove, onClose }: NowNextWidgetProps) {
  const { t } = useTranslation();
  const slices = useStoreSelector((s) => s.history.present.slices);
  return (
    <FloatingPanel
      pos={nownext.pos}
      width={210}
      title={t('clock.nowNext')}
      closeLabel={t('clock.close')}
      onMove={onMove}
      onClose={onClose}
    >
      <NowNextCard slices={slices} />
    </FloatingPanel>
  );
}
