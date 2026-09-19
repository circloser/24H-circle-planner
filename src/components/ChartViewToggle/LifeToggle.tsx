import { GitCommitVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { timetableView } from '@/lib/last-view';

/**
 * Life — the third time scale (a day, a month, a whole life) — gets a button
 * of its own beside the calendar's, and works the same way: one tap in, one
 * tap back to the timetable view you were on.
 */
export function LifeToggle() {
  const { prefs, setPreference } = usePreferences();
  const { t } = useTranslation();
  const on = prefs.chartView === 'life';

  return (
    <Button
      variant={on ? 'default' : 'outline'}
      size="sm"
      data-life-toggle
      aria-pressed={on}
      aria-label={t('nav.life')}
      title={t('nav.life')}
      className="min-h-11 gap-1.5 px-2 sm:px-3"
      onClick={() => setPreference('chartView', on ? timetableView() : 'life')}
    >
      <GitCommitVertical className="h-4 w-4 shrink-0" />
      <span className="max-w-24 truncate">{t('nav.life')}</span>
    </Button>
  );
}
