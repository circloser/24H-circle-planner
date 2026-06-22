import { Clock, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { CHART_VIEWS, type ChartView } from '@/lib/chart-view';
import type { TKey } from '@/i18n/translations';

const ICON: Record<ChartView, typeof Clock> = {
  full: Clock,
  day: Sun,
  night: Moon,
};

const LABEL_KEY: Record<ChartView, TKey> = {
  full: 'view.full',
  day: 'view.day',
  night: 'view.night',
};

/**
 * Independent top-of-title control that cycles the chart between the three view
 * windows: 24h → 12h day (06–18) → 12h night (18–06) → 24h. Shows the current
 * window; one click advances to the next. The schedule data is shared across all
 * views, so editing in any view edits the same underlying 24h timetable.
 */
export function ChartViewToggle() {
  const { prefs, setPreference } = usePreferences();
  const { t } = useTranslation();
  const view = prefs.chartView ?? 'full';
  const Icon = ICON[view];

  const cycle = () => {
    const i = CHART_VIEWS.indexOf(view);
    setPreference('chartView', CHART_VIEWS[(i + 1) % CHART_VIEWS.length]);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 px-2 sm:px-3"
      onClick={cycle}
      aria-label={t('view.cycle')}
      title={t('view.cycle')}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{t(LABEL_KEY[view])}</span>
    </Button>
  );
}
