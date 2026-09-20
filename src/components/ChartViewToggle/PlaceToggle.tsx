import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { timetableView } from '@/lib/last-view';

/**
 * Place — the axis of where — gets a button of its own beside the relation
 * map's, and works the same way: one tap in, one tap back to the timetable
 * view you were on.
 */
export function PlaceToggle() {
  const { prefs, setPreference } = usePreferences();
  const { t } = useTranslation();
  const on = prefs.chartView === 'place';

  return (
    <Button
      variant={on ? 'default' : 'outline'}
      size="sm"
      data-place-toggle
      aria-pressed={on}
      aria-label={t('nav.place')}
      title={t('nav.place')}
      className="min-h-11 w-11 shrink-0 px-0"
      onClick={() => setPreference('chartView', on ? timetableView() : 'place')}
    >
      {/* An icon alone, like every other tab: the name is in the label. */}
      <Globe className="h-4 w-4 shrink-0" />
    </Button>
  );
}
