import { useId } from 'react';
import { useTranslation } from '@/hooks/usePreferences';
import type { DateParts } from '@/lib/life';

/**
 * A life date to the precision the person knows: the year alone, the year and
 * month, or the whole date. Month and day may be left as "don't know", so the
 * precision follows from what is filled in (no separate switch to flip).
 */
const select = 'h-10 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

export function LifeDateInput({ value, onChange, label, idPrefix }: {
  value: DateParts;
  onChange: (next: DateParts) => void;
  label: string;
  idPrefix?: string;
}) {
  const { t } = useTranslation();
  const auto = useId();
  const id = idPrefix ?? auto;
  const days = value.y && value.m ? new Date(Number(value.y), Number(value.m), 0).getDate() : 31;
  /** A day past the end of the newly chosen month (31 → February) is dropped,
   *  not kept out of sight where it would make the date invalid. */
  const set = (next: DateParts) => {
    const last = next.y && next.m ? new Date(Number(next.y), Number(next.m), 0).getDate() : 31;
    onChange(!next.m || Number(next.d) > last ? { ...next, d: '' } : next);
  };
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium text-foreground">{label}</legend>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {t('life.field.year')}
          <input id={`${id}-y`} data-life-year-input inputMode="numeric" type="number" min={1800} max={2200}
            value={value.y} placeholder="YYYY"
            onChange={(e) => set({ ...value, y: e.target.value.slice(0, 4) })}
            className={`${select} w-24 tabular-nums text-foreground`} />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {t('life.field.month')}
          <select id={`${id}-m`} data-life-month-input value={value.m}
            onChange={(e) => set({ ...value, m: e.target.value })}
            className={`${select} text-foreground`}>
            <option value="">{t('life.field.unknown')}</option>
            {Array.from({ length: 12 }, (_, i) => <option key={i} value={String(i + 1)}>{i + 1}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {t('life.field.day')}
          <select id={`${id}-d`} data-life-day-input value={value.d} disabled={!value.m}
            onChange={(e) => onChange({ ...value, d: e.target.value })}
            className={`${select} text-foreground`}>
            <option value="">{t('life.field.unknown')}</option>
            {Array.from({ length: days }, (_, i) => <option key={i} value={String(i + 1)}>{i + 1}</option>)}
          </select>
        </label>
      </div>
    </fieldset>
  );
}
