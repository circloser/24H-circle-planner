import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';
import type { Slot } from '@/types/slot';

interface WeekdayPromptDialogProps {
  /** The slot assigned to today's weekday, or null when nothing to prompt. */
  slot: Slot | null;
  /** Localized name of today's weekday. */
  dayName: string;
  onKeep: () => void;
  onLoad: (slot: Slot) => void;
}

/**
 * On opening the app on a weekday with an assigned default schedule, ask whether
 * to load it — the user keeps their current edit or loads that weekday's slot.
 */
export function WeekdayPromptDialog({ slot, dayName, onKeep, onLoad }: WeekdayPromptDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={slot !== null} onOpenChange={(o) => { if (!o) onKeep(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('weekday.promptTitle')}</DialogTitle>
          <DialogDescription>
            {t('weekday.promptBody', { day: dayName, name: slot?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onKeep}>{t('weekday.keep')}</Button>
          <Button
            className="bg-primary text-primary-foreground"
            onClick={() => { if (slot) onLoad(slot); }}
          >
            {t('weekday.load')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
