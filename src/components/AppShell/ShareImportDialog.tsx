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
import type { Schedule } from '@/types/schedule';

interface ShareImportDialogProps {
  /** The schedule parsed from an incoming share link (#p=…); null = closed. */
  schedule: Schedule | null;
  onClose: () => void;
  onImport: (schedule: Schedule) => void;
}

/** Incoming share link (#p=…) → confirm before replacing the schedule. */
export function ShareImportDialog({ schedule, onClose, onImport }: ShareImportDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={schedule !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('sharelink.importTitle')}</DialogTitle>
          <DialogDescription>{t('sharelink.importBody')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              if (schedule) onImport(schedule);
              onClose();
            }}
            style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            {t('sharelink.importConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
