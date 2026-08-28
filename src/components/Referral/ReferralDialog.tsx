import { useEffect, useState } from 'react';
import { UserPlus, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/usePreferences';

interface ReferralDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Invite-a-friend: shows the signed-in user's personal invite link (?ref=code).
 * When a NEW user opens that link and signs in, the server rewards the inviter
 * with 1 month of Pro (grants table) — the sign-in requirement keeps it honest.
 */
export function ReferralDialog({ open, onOpenChange }: ReferralDialogProps) {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [invited, setInvited] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    void fetch('/api/referral/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => { if (j.code) { setCode(j.code); setInvited(j.invited ?? 0); } })
      .catch(() => { /* leave empty */ });
  }, [open, user]);

  const link = code ? `https://24houring.com/?ref=${code}` : '';

  const copy = () => {
    if (!link) return;
    void navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      toast.success(t('referral.copied'));
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />{t('referral.title')}</DialogTitle>
          <DialogDescription>{t('referral.desc')}</DialogDescription>
        </DialogHeader>

        {user ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <input readOnly value={link} aria-label={t('referral.title')}
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
              <Button onClick={copy} className="gap-1.5 shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {t('referral.copy')}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{t('referral.invited', { n: String(invited) })}</p>
          </div>
        ) : (
          <Button onClick={login} className="w-full">{t('referral.login')}</Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
