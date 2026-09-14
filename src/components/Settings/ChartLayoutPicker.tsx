import { useTranslation } from '@/hooks/usePreferences';
import { CHART_LAYOUTS, type ChartLayout } from '@/lib/chart-layout';
import type { TKey } from '@/i18n/translations';

const LABEL: Record<ChartLayout, TKey> = {
  center: 'settings.layoutCenter',
  left: 'settings.layoutLeft',
  right: 'settings.layoutRight',
  hidden: 'settings.layoutHidden',
};

/** A tiny screen with the circle where that layout puts it (dashed = hidden). */
function LayoutThumb({ layout }: { layout: ChartLayout }) {
  const cx = layout === 'left' ? 13 : layout === 'right' ? 35 : 24;
  return (
    <svg viewBox="0 0 48 30" className="h-7 w-11" aria-hidden>
      <rect x="0.75" y="0.75" width="46.5" height="28.5" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
      {layout === 'hidden' ? (
        <circle cx="24" cy="15" r="9" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="2.5 2.5" />
      ) : (
        <circle cx={cx} cy="15" r="9" fill="currentColor" fillOpacity="0.85" />
      )}
    </svg>
  );
}

/** The four chart layouts as picture chips — shared by Settings → 레이아웃 and
 *  the design magician's last step. */
export function ChartLayoutPicker({ value, onChange, compact = false }: {
  value: ChartLayout;
  onChange: (layout: ChartLayout) => void;
  /** Smaller type for the magician's 300px panel. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2" data-layout-picker>
      <div className="grid grid-cols-2 gap-1.5">
        {CHART_LAYOUTS.map((layout) => (
          <button
            key={layout}
            type="button"
            data-layout={layout}
            onClick={() => onChange(layout)}
            aria-pressed={value === layout}
            className={`opt-chip flex flex-col items-center gap-1 rounded-md px-2 py-2 ${compact ? 'text-xs' : 'text-sm'}`}
          >
            <LayoutThumb layout={layout} />
            {t(LABEL[layout])}
          </button>
        ))}
      </div>
      {/* keep-all: Korean wraps at spaces, not mid-word, in the magician's narrow panel. */}
      <p className="break-keep text-[11px] text-muted-foreground">{t('settings.layoutHint')}</p>
    </div>
  );
}
