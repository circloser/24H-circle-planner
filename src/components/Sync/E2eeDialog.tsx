import { useMemo, useState } from 'react';
import { ShieldCheck, ShieldAlert, Lock, Loader2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
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
import { useSyncStatus } from '@/hooks/useSync';
import {
  deriveKey, newSalt, rememberKey, verifyKey, forgetKey, requestRepush, requestDisable, isE2eeEnabled,
} from '@/lib/sync/e2ee';
import { fetchEncBlock } from '@/lib/sync/syncClient';

interface E2eeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MIN_PASSPHRASE = 8;

/** Outer shell. The body is always mounted (Radix shows/hides it from `open`);
 *  keying it on `open` remounts a fresh form each time it is opened, resetting
 *  fields without a setState-in-effect. */
export function E2eeDialog({ open, onOpenChange }: E2eeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <E2eeBody key={open ? 'open' : 'closed'} onOpenChange={onOpenChange} />
    </Dialog>
  );
}

/**
 * End-to-end encryption control for cloud sync. Three modes, chosen from the
 * live sync/E2EE state:
 *  - unlock  : the cloud is ciphertext this device can't read yet → enter passphrase
 *  - manage  : E2EE is set up + unlocked here → turn off / forget on this device
 *  - enable  : plaintext cloud → set a passphrase (irreversible: no recovery)
 */
function E2eeBody({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const { status } = useSyncStatus();
  const enabledHere = isE2eeEnabled();
  const mode: 'unlock' | 'manage' | 'enable' = status === 'locked' ? 'unlock' : enabledHere ? 'manage' : 'enable';

  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canEnable = pass.length >= MIN_PASSPHRASE && pass === pass2 && ack && !busy;
  const canUnlock = pass.length > 0 && !busy;

  async function doEnable() {
    if (!canEnable) return;
    setBusy(true); setErr(null);
    try {
      const salt = newSalt();
      const key = await deriveKey(pass, salt);
      await rememberKey(key, salt); // caches locally + fires E2EE_EVENT
      requestRepush(); // replace the plaintext cloud copy with ciphertext now
      toast.success(t('e2ee.enabled'));
      onOpenChange(false);
    } catch {
      setErr(t('e2ee.errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  async function doUnlock() {
    if (!canUnlock) return;
    setBusy(true); setErr(null);
    try {
      const block = await fetchEncBlock();
      if (!block) { setErr(t('e2ee.errorGeneric')); return; }
      const salt = Uint8Array.from(atob(block.salt), (c) => c.charCodeAt(0));
      const key = await deriveKey(pass, salt);
      if (!(await verifyKey(key, block))) { setErr(t('e2ee.errorWrong')); return; }
      await rememberKey(key, salt); // engine resumes on E2EE_EVENT
      toast.success(t('e2ee.unlocked'));
      onOpenChange(false);
    } catch {
      setErr(t('e2ee.errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  function doForget() {
    forgetKey(); // this device re-locks until the passphrase is entered again
    toast(t('e2ee.forgotten'));
    onOpenChange(false);
  }

  function doDisable() {
    requestDisable(); // engine forgets the key + re-uploads plaintext
    toast(t('e2ee.disabled'));
    onOpenChange(false);
  }

  const input = 'w-full rounded-md px-3 py-2 text-sm bg-background text-foreground border border-border';

  const title = useMemo(() => (
    mode === 'unlock' ? t('e2ee.unlockTitle') : mode === 'manage' ? t('e2ee.manageTitle') : t('e2ee.enableTitle')
  ), [mode, t]);

  return (
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'unlock' ? <Lock className="h-5 w-5 text-primary" /> : mode === 'manage' ? <ShieldCheck className="h-5 w-5 text-primary" /> : <ShieldAlert className="h-5 w-5 text-primary" />}
            {title}
          </DialogTitle>
          <DialogDescription>
            {mode === 'unlock' ? t('e2ee.unlockBody') : mode === 'manage' ? t('e2ee.manageBody') : t('e2ee.enableBody')}
          </DialogDescription>
        </DialogHeader>

        {mode === 'enable' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('e2ee.warnNoRecovery')}</span>
            </div>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={t('e2ee.passPlaceholder')} className={input} autoComplete="new-password" aria-label={t('e2ee.passPlaceholder')} />
            <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder={t('e2ee.passConfirm')} className={input} autoComplete="new-password" aria-label={t('e2ee.passConfirm')} />
            {pass.length > 0 && pass.length < MIN_PASSPHRASE && <p className="text-xs text-muted-foreground">{t('e2ee.passTooShort')}</p>}
            {pass2.length > 0 && pass !== pass2 && <p className="text-xs text-destructive">{t('e2ee.passMismatch')}</p>}
            <label className="flex items-start gap-2 text-xs text-foreground">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
              <span>{t('e2ee.ackLose')}</span>
            </label>
          </div>
        )}

        {mode === 'unlock' && (
          <div className="flex flex-col gap-3">
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void doUnlock(); }} placeholder={t('e2ee.passPlaceholder')} className={input} autoComplete="current-password" aria-label={t('e2ee.passPlaceholder')} autoFocus />
          </div>
        )}

        {mode === 'manage' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-md bg-primary/10 p-2.5 text-xs text-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              <span>{t('e2ee.activeHere')}</span>
            </div>
            <button type="button" onClick={doForget} className="rounded-md border border-border px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted">
              {t('e2ee.forgetHere')}
              <span className="mt-0.5 block text-xs text-muted-foreground">{t('e2ee.forgetHint')}</span>
            </button>
            <button type="button" onClick={doDisable} className="rounded-md border border-border px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10">
              {t('e2ee.disableAction')}
              <span className="mt-0.5 block text-xs text-muted-foreground">{t('e2ee.disableHint')}</span>
            </button>
          </div>
        )}

        {err && <p className="text-sm text-destructive">{err}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          {mode === 'enable' && (
            <Button onClick={doEnable} disabled={!canEnable} className="bg-primary text-primary-foreground">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('e2ee.enableAction')}
            </Button>
          )}
          {mode === 'unlock' && (
            <Button onClick={doUnlock} disabled={!canUnlock} className="bg-primary text-primary-foreground">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t('e2ee.unlockAction')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
  );
}
