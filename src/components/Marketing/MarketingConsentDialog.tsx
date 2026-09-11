import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/usePreferences';
import {
  fetchMarketing,
  localDate,
  rememberMarketingResume,
  saveMarketing,
  type MarketingState,
} from '@/lib/marketing';

/**
 * Join or leave the mailing list. Opened only from the ⚙ menu — it never
 * appears on its own.
 *
 * Signed in: shows what a separate consent has to disclose (the item, the
 * purpose including advertising, how long it is kept, the right to refuse
 * without penalty), the current choice, and two identically styled answers —
 * consent that is nudged toward "yes" is not freely given.
 *
 * Signed out: the list uses the Google account's email, so the dialog offers
 * sign-in and reopens itself after the round trip (see consumeMarketingResume).
 */
export function MarketingConsent({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { user, loading, login } = useAuth();
  const [state, setState] = useState<MarketingState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    void fetchMarketing().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  function signIn() {
    rememberMarketingResume();
    login();
  }

  async function choose(optIn: boolean) {
    setSaving(true);
    const result = await saveMarketing(optIn);
    setSaving(false);
    if (result === 'stale') {
      toast.error(t('marketing.stale'));
      onOpenChange(false);
      return;
    }
    if (!result) {
      toast.error(t('marketing.fail'));
      return;
    }
    setState(result);
    // Telling the person what was recorded, and when, is part of handling it.
    const date = localDate(result.decidedAt ?? Date.now());
    toast.success(t(optIn ? 'marketing.doneIn' : 'marketing.doneOut', { date }), { duration: 8000 });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {t('marketing.title')}
          </DialogTitle>
          <DialogDescription>{t(user || loading ? 'marketing.body' : 'marketing.signInBody')}</DialogDescription>
        </DialogHeader>

        {user ? (
          <>
            <ul className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-3 text-xs text-foreground" data-marketing-notice>
              <li>{t('marketing.items')}</li>
              <li>{t('marketing.purpose')}</li>
              <li>{t('marketing.retention')}</li>
            </ul>

            <p className="text-xs text-muted-foreground">{t('marketing.refuse')}</p>

            {state?.decided ? (
              <p className="text-xs font-medium text-foreground" data-marketing-current>
                {state.optIn ? t('marketing.currentIn', { date: localDate(state.decidedAt ?? 0) }) : t('marketing.currentOut')}
              </p>
            ) : null}

            <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
              <Button variant="outline" onClick={() => void choose(false)} disabled={saving}>
                {t('marketing.decline')}
              </Button>
              <Button variant="outline" onClick={() => void choose(true)} disabled={saving}>
                {t('marketing.accept')}
              </Button>
            </DialogFooter>
          </>
        ) : !loading ? (
          <DialogFooter>
            <Button onClick={signIn}>{t('auth.login')}</Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
