import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { timetableView } from '@/lib/last-view';

/**
 * Relation — the first tab that is not a scale of time — gets a button of its
 * own beside the life line's, and works the same way: one tap in, one tap back
 * to the timetable view you were on.
 */
export function RelationToggle() {
  const { prefs, setPreference } = usePreferences();
  const { t } = useTranslation();
  const on = prefs.chartView === 'relation';

  return (
    <Button
      variant={on ? 'default' : 'outline'}
      size="sm"
      data-relation-toggle
      aria-pressed={on}
      aria-label={t('nav.relation')}
      title={t('nav.relation')}
      className="min-h-11 w-11 shrink-0 px-0"
      onClick={() => setPreference('chartView', on ? timetableView() : 'relation')}
    >
      {/* An icon alone, like every other tab: the name is in the label. */}
      <Share2 className="h-4 w-4 shrink-0" />
    </Button>
  );
}
