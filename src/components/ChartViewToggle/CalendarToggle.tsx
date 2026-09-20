import { CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { timetableView } from '@/lib/last-view';

/**
 * The calendar gets a button of its own beside the timetable toggle: one tap in,
 * one tap back to the timetable view you were on, without opening the view menu.
 */
export function CalendarToggle() {
  const { prefs, setPreference } = usePreferences();
  const { t } = useTranslation();
  const on = (prefs.chartView ?? 'full') === 'calendar';

  return (
    <Button
      variant={on ? 'default' : 'outline'}
      size="sm"
      data-calendar-toggle
      aria-pressed={on}
      aria-label={t('view.calendar')}
      title={t('view.calendar')}
      className="min-h-11 w-11 shrink-0 px-0"
      onClick={() => setPreference('chartView', on ? timetableView() : 'calendar')}
    >
      {/* An icon alone, like every other tab: the name is in the label. */}
      <CalendarDays className="h-4 w-4 shrink-0" />
    </Button>
  );
}
