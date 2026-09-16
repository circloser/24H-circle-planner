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
      className="min-h-11 gap-1.5 px-2 sm:px-3"
      onClick={() => setPreference('chartView', on ? timetableView() : 'calendar')}
    >
      <CalendarDays className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">{t('view.calendar')}</span>
    </Button>
  );
}
