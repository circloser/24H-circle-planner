import { Clock, Sun, Moon, Table as TableIcon, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { CHART_VIEWS, type ChartView } from '@/lib/chart-view';
import type { TKey } from '@/i18n/translations';

const ICON: Record<ChartView, typeof Clock> = {
  full: Clock,
  day: Sun,
  night: Moon,
  table: TableIcon,
  record: Timer,
};

const SELECTABLE_VIEWS: ChartView[] = [...CHART_VIEWS, 'record'];

const LABEL_KEY: Record<ChartView, TKey> = {
  full: 'view.full',
  day: 'view.day',
  night: 'view.night',
  table: 'view.table',
  record: 'view.record',
};

/** Choose any view directly; all views edit the same underlying schedule. */
export function ChartViewToggle() {
  const { prefs, setPreference } = usePreferences();
  const { t } = useTranslation();
  const view = prefs.chartView ?? 'full';
  const Icon = ICON[view];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-11 gap-1.5 px-2 sm:px-3" aria-label={t('view.select')} title={t('view.select')}>
          <Icon className="h-4 w-4 shrink-0" />
          <span className="max-w-24 truncate">{t(LABEL_KEY[view])}</span>
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
