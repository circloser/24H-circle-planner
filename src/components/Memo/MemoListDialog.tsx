import { Eye, EyeOff, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useMemos } from '@/hooks/useMemos';
import { useTranslation } from '@/hooks/usePreferences';

interface MemoListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The full memo archive. Lists every memo (newest first, scrollable) even those
 * removed from the canvas. The eye toggles a memo on/off the screen; the trash
 * deletes it for good.
 */
export function MemoListDialog({ open, onOpenChange }: MemoListDialogProps) {
  const { memos, restoreMemo, archiveMemo, deleteMemo } = useMemos();
  const { t } = useTranslation();
  const sorted = [...memos].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('memo.listTitle')}</DialogTitle>
          <DialogDescription>{t('memo.listDesc')}</DialogDescription>
        </DialogHeader>

        {sorted.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
            {t('memo.listEmpty')}
          </p>
        ) : (
          <div className="-mx-1 flex max-h-[58vh] flex-col gap-1.5 overflow-y-auto px-1">
            {sorted.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-lg p-2"
                style={{ border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--surface))', opacity: m.onScreen ? 1 : 0.7 }}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-black/15"
                  style={{ backgroundColor: m.color }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm" style={{ color: 'hsl(var(--foreground))' }}>
                    {m.text.trim() || t('memo.placeholder')}
                  </p>
                  <p className="text-[11px]" style={{ color: 'hsl(var(--text-muted))' }}>
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={m.onScreen ? t('memo.hideFromScreen') : t('memo.restore')}
                  title={m.onScreen ? t('memo.hideFromScreen') : t('memo.restore')}
                  onClick={() => (m.onScreen ? archiveMemo(m.id) : restoreMemo(m.id))}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded transition-colors hover:bg-black/10"
                  style={{ color: 'hsl(var(--foreground))' }}
                >
                  {m.onScreen ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" style={{ opacity: 0.6 }} />}
                </button>
                <button
                  type="button"
                  aria-label={t('memo.deleteForever')}
                  title={t('memo.deleteForever')}
                  onClick={() => deleteMemo(m.id)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded transition-colors hover:bg-black/10"
                  style={{ color: 'hsl(var(--destructive))' }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
