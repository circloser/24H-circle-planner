import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { resetAllData } from '@/lib/backup';
import { useTranslation } from '@/hooks/usePreferences';

/** Full reset — wipes all app data, then reloads to a fresh state. */
export function ResetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('settings.reset')}</DialogTitle>
          <DialogDescription>{t('settings.resetBody')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            style={{ backgroundColor: 'hsl(var(--destructive))', color: 'hsl(var(--destructive-foreground))' }}
            onClick={() => {
              resetAllData();
              onOpenChange(false);
              // Reload so every provider re-initialises to first-launch defaults.
              setTimeout(() => window.location.reload(), 100);
            }}
          >
            {t('settings.resetConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
