import { useEffect, useRef, useState } from 'react';
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
  rememberDismissal,
  saveMarketing,
  wasRecentlyDismissed,
  type MarketingState,
} from '@/lib/marketing';

/** A signed-in user settles in before being asked anything. */
export const AUTO_ASK_DELAY_MS = 4000;

/**
 * The news-email opt-in. The only way an address gets onto the mailing list.
 *
 * Asked once, a few seconds after a signed-in user who has never answered
 * arrives — which is how people who signed in before this existed get asked:
 * in the app, never by an email asking for consent, since that email would
 * itself be advertising. Changeable any time from the ⚙ menu (`manageOpen`).
 *
 * The notice lists what the law asks a separate consent to disclose: the item,
 * the purpose (advertising included), how long it is kept, and the right to
 * refuse without penalty. The two answers are styled identically on purpose —
 * consent that is nudged toward "yes" is not freely given.
 */
export function MarketingConsent({
  manageOpen,
  onManageClose,
  suppressAutoAsk,
}: {
  /** Opened from the ⚙ menu. */
  manageOpen: boolean;
  onManageClose: () => void;
  /** Another flow is on screen (onboarding, a privacy gate…) — don't ask now. */
  suppressAutoAsk: boolean;
}) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'ask' | 'manage'>('ask');
  const [state, setState] = useState<MarketingState | null>(null);
  const [saving, setSaving] = useState(false);
  const askedRef = useRef(false);

  useEffect(() => {
    if (loading || !user || suppressAutoAsk || askedRef.current || wasRecentlyDismissed()) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      void fetchMarketing().then((s) => {
        if (cancelled || !s || s.decided) return;
        askedRef.current = true;
        setState(s);
        setMode('ask');
        setOpen(true);
      });
    }, AUTO_ASK_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [loading, user, suppressAutoAsk]);

  useEffect(() => {
    if (!manageOpen) return;
    let cancelled = false;
    void fetchMarketing().then((s) => {
      if (cancelled) return;
      setState(s);
      setMode('manage');
      setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [manageOpen]);

  function finish(answered: boolean) {
    // Walking away from the question is not an answer; hold it back a while.
    if (!answered && mode === 'ask') rememberDismissal();
    setOpen(false);
    if (mode === 'manage') onManageClose();
  }

  async function choose(optIn: boolean) {
    setSaving(true);
    const result = await saveMarketing(optIn);
    setSaving(false);
    if (result === 'stale') {
      toast.error(t('marketing.stale'));
      finish(true);
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
    finish(true);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) finish(false); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {t('marketing.title')}
          </DialogTitle>
          <DialogDescription>{t('marketing.body')}</DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-3 text-xs text-foreground" data-marketing-notice>
          <li>{t('marketing.items')}</li>
          <li>{t('marketing.purpose')}</li>
          <li>{t('marketing.retention')}</li>
        </ul>

        <p className="text-xs text-muted-foreground">{t('marketing.refuse')}</p>

        {mode === 'manage' && state?.decided ? (
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
      </DialogContent>
    </Dialog>
  );
}
