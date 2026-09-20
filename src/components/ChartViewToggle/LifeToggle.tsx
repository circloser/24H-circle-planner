import { GitCommitVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { useLifeNudge } from '@/hooks/useLifeNudge';
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
  // A plan coming up, or a year with nothing in it: one quiet dot, no words.
  const { nudge } = useLifeNudge();

  return (
    <Button
      variant={on ? 'default' : 'outline'}
      size="sm"
      data-life-toggle
      aria-pressed={on}
      aria-label={t('nav.life')}
      title={t('nav.life')}
      className="relative min-h-11 gap-1.5 px-2 sm:px-3"
      onClick={() => setPreference('chartView', on ? timetableView() : 'life')}
    >
      <GitCommitVertical className="h-4 w-4 shrink-0" />
      <span className="max-w-24 truncate">{t('nav.life')}</span>
      {nudge && !on && (
        <span aria-hidden data-life-dot className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-surface" />
      )}
    </Button>
  );
}
