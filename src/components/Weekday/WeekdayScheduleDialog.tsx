import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useTranslation } from '@/hooks/usePreferences';
import { loadSlots } from '@/lib/slots';
import { loadWeekdayMap, saveWeekdayMap, weekdayName, type WeekdayMap } from '@/lib/weekday-schedules';

interface WeekdayScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Assign a saved slot to each weekday. The body remounts per open (keyed on
 *  `open`) so it always reflects the latest slots + assignments. */
export function WeekdayScheduleDialog({ open, onOpenChange }: WeekdayScheduleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <Body key="weekday-body" />}
    </Dialog>
  );
}

function Body() {
  const { t, lang } = useTranslation();
  const slots = loadSlots();
  const slotList = Object.values(slots).sort((a, b) => a.name.localeCompare(b.name));
  const [map, setMap] = useState<WeekdayMap>(() => loadWeekdayMap());

  const assign = (weekday: number, slotId: string) => {
    setMap((prev) => {
      const next = { ...prev };
      if (slotId) next[weekday] = slotId;
      else delete next[weekday];
      saveWeekdayMap(next);
      return next;
    });
  };

  // Sunday-first (matches the diary calendar header 일 월 화 수 목 금 토).
  const order = [0, 1, 2, 3, 4, 5, 6];

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          {t('weekday.title')}
        </DialogTitle>
        <DialogDescription>{t('weekday.body')}</DialogDescription>
      </DialogHeader>

      {slotList.length === 0 ? (
        <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">{t('weekday.needSlots')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {order.map((w) => (
            <div key={w} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-sm font-medium text-foreground">{weekdayName(w, lang)}</span>
              <select
                value={map[w] ?? ''}
                onChange={(e) => assign(w, e.target.value)}
                aria-label={weekdayName(w, lang)}
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">{t('weekday.none')}</option>
                {slotList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </DialogContent>
  );
}
