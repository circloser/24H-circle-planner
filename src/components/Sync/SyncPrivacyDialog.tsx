import { CloudOff, Cloud, ShieldCheck, Lock } from 'lucide-react';
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
import { grantSyncConsent } from '@/lib/sync/consent';

/**
 * Where the diary actually lives — told plainly, at the two moments it matters:
 *
 *  - `variant="diary"`: right after the FIRST diary entry is saved. Informational;
 *    a Pro account can jump straight to setting the passphrase.
 *  - `variant="sync"`: BEFORE this device's first cloud upload. Required: the
 *    sync engine holds its first push until one of the two buttons is pressed
 *    (see lib/sync/consent), and the dialog cannot be dismissed any other way.
 */
export function SyncPrivacyDialog({
  open,
  onOpenChange,
  variant,
  isPro,
  onSetPassphrase,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: 'diary' | 'sync';
  isPro: boolean;
  /** Opens the E2EE passphrase dialog. */
  onSetPassphrase: () => void;
}) {
  const { t } = useTranslation();
  const gate = variant === 'sync';

  function choosePassphrase() {
    // Consent either way: the user has read this and is acting on it. Setting a
    // passphrase re-pushes as ciphertext the moment it is confirmed.
    grantSyncConsent();
    onOpenChange(false);
    onSetPassphrase();
  }

  function chooseLater() {
    if (gate) grantSyncConsent(); // plaintext sync, knowingly
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      // The gate must be answered, so a click outside / Esc cannot close it.
      onOpenChange={(next) => { if (!next && gate) return; onOpenChange(next); }}
    >
      <DialogContent className="max-w-sm" hideClose={gate}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t(gate ? 'privacy.syncTitle' : 'privacy.diaryTitle')}
          </DialogTitle>
          <DialogDescription>
            {t(gate ? 'privacy.syncBody' : 'privacy.diaryBody')}
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-2.5 text-sm text-foreground">
          <li className="flex items-start gap-2">
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{t('privacy.pointLocal')}</span>
          </li>
          <li className="flex items-start gap-2">
            <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{t('privacy.pointServer')}</span>
          </li>
          <li className="flex items-start gap-2">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="font-medium">{t('privacy.pointNoOperator')}</span>
          </li>
        </ul>

        <p className="text-xs text-muted-foreground">{t('privacy.noRecovery')}</p>

        <DialogFooter>
          <Button variant="outline" onClick={chooseLater}>
            {t(gate ? 'privacy.syncWithout' : 'privacy.gotIt')}
          </Button>
          {(isPro || gate) && (
            <Button onClick={choosePassphrase} className="bg-primary text-primary-foreground">
              {t('privacy.setPassphrase')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
