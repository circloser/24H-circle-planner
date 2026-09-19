import { useEffect } from 'react';
import { Clock, Sun, Moon, Table as TableIcon, Timer, CalendarDays, GitCommitVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { CHART_VIEWS, isPageView, type ChartView } from '@/lib/chart-view';
import { rememberTimetableView, timetableView } from '@/lib/last-view';
import type { TKey } from '@/i18n/translations';

const ICON: Record<ChartView, typeof Clock> = {
  full: Clock,
  day: Sun,
  night: Moon,
  table: TableIcon,
  record: Timer,
  calendar: CalendarDays,
  life: GitCommitVertical,
};

const SELECTABLE_VIEWS: ChartView[] = [...CHART_VIEWS, 'record'];

const LABEL_KEY: Record<ChartView, TKey> = {
  full: 'view.full',
  day: 'view.day',
  night: 'view.night',
  table: 'view.table',
  record: 'view.record',
  calendar: 'view.calendar',
  life: 'nav.life',
};

/** Choose any view directly; all views edit the same underlying schedule. */
export function ChartViewToggle() {
  const { prefs, setPreference } = usePreferences();
  const { t } = useTranslation();
  // While the calendar or the life page is on this stays the TIMETABLE button:
  // it shows the view the chart will come back to, and one press goes back.
  const onPage = isPageView(prefs.chartView);
  const view = onPage ? timetableView() : (prefs.chartView ?? 'full');
  const Icon = ICON[view];
  useEffect(() => { rememberTimetableView(prefs.chartView ?? 'full'); }, [prefs.chartView]);

  const face = (
    <>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="max-w-24 truncate">{t(LABEL_KEY[view])}</span>
    </>
  );
  // No menu while a page is on: the press itself is "back to the timetable".
  if (onPage) {
    return (
      <Button variant="outline" size="sm" className="min-h-11 gap-1.5 px-2 sm:px-3" data-view-toggle
        aria-label={t(LABEL_KEY[view])} title={t(LABEL_KEY[view])}
        onClick={() => setPreference('chartView', view)}>
        {face}
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-11 gap-1.5 px-2 sm:px-3" data-view-toggle aria-label={t('view.select')} title={t('view.select')}>
          {face}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={view} onValueChange={(value) => {
          if (SELECTABLE_VIEWS.includes(value as ChartView)) setPreference('chartView', value as ChartView);
        }}>
          {SELECTABLE_VIEWS.map((option) => <DropdownMenuRadioItem key={option} value={option} className="min-h-11">{t(LABEL_KEY[option])}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
