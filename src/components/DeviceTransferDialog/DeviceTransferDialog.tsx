import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AdSlot } from '@/components/Ads/AdSlot';
import { QrCode } from '@/components/QrCode/QrCode';
import { buildShareUrl, copyToClipboard } from '@/lib/share-link';
import { useStoreSelector } from '@/hooks/useScheduleStore';
import { useTranslation } from '@/hooks/usePreferences';

interface DeviceTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * No-backend "send to another device": encodes the current timetable into a
 * share URL (#p=…) and shows it as a scannable QR. Scanning opens the link on
 * the other device, where the existing share-import confirm restores it. Full
 * data (multiple days, diary, memos) still goes through Export → Backup.
 */
export function DeviceTransferDialog({ open, onOpenChange }: DeviceTransferDialogProps) {
  const present = useStoreSelector((s) => s.history.present);
  const { t } = useTranslation();
  const url = buildShareUrl(present);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (await copyToClipboard(url)) {
      setCopied(true);
      toast.success(t('sharelink.copied'));
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error(t('sharelink.copyFail'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('transfer.title')}</DialogTitle>
        </DialogHeader>

        <p className="text-sm" style={{ color: 'hsl(var(--text-muted))' }}>{t('transfer.body')}</p>

        <div className="mx-auto rounded-xl bg-white p-3" style={{ border: '1px solid hsl(var(--border))' }}>
          <QrCode value={url} size={216} />
        </div>

        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-xs outline-none"
            style={{ backgroundColor: 'hsl(var(--surface))', color: 'hsl(var(--text-muted))', border: '1px solid hsl(var(--border))' }}
          />
          <Button size="sm" onClick={copy} className="shrink-0 gap-1.5"
            style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {t('sharelink.copy')}
          </Button>
        </div>

        <p className="text-xs" style={{ color: 'hsl(var(--text-muted) / 0.85)' }}>{t('transfer.note')}</p>

        <AdSlot slot="transfer" className="mt-1" />
      </DialogContent>
    </Dialog>
  );
}
