import { Smartphone, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';

/** Chrome/Edge's non-standard install-prompt event (not in the DOM lib types). */
export interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt: () => Promise<void>;
}

interface AddToHomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Captured beforeinstallprompt event, if the browser offered one. */
  installPrompt: BeforeInstallPromptEvent | null;
  /** Called after the install prompt has been consumed (so it isn't reused). */
  onConsumePrompt: () => void;
}

/**
 * "Add to home screen" helper. Triggers the native install prompt when the
 * browser offers one; otherwise shows concise per-platform instructions plus a
 * copy-link button so the user can pin/bookmark 24Houring as their first screen.
 */
export function AddToHomeDialog({
  open,
  onOpenChange,
  installPrompt,
  onConsumePrompt,
}: AddToHomeDialogProps) {
  const { t } = useTranslation();

  async function handleInstall() {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') toast.success(t('home.installed'));
    } catch {
      // user dismissed or prompt failed — nothing to do
    }
    onConsumePrompt();
    onOpenChange(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t('home.copied'));
    } catch {
      toast.error(t('home.copyLink'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {t('home.title')}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--text-muted))' }}>
          {t('home.body')}
        </p>

        <div className="flex flex-col gap-2 pt-1">
          {installPrompt ? (
            <Button
              onClick={handleInstall}
              className="w-full gap-2"
              style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
            >
              <Download className="h-4 w-4" />
              {t('home.install')}
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={handleCopy}
            className="w-full gap-2"
            style={{ backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}
          >
            <Copy className="h-4 w-4" />
            {t('home.copyLink')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
