import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from '@/hooks/usePreferences';
import { createPersistenceBackup, getPersistenceStatus, retryPersistence, subscribePersistence } from '@/lib/persistence';

function downloadBackup() {
  const url = URL.createObjectURL(new Blob([createPersistenceBackup()], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `24houring-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SaveIndicator() {
  const phase = useSyncExternalStore(subscribePersistence, getPersistenceStatus, getPersistenceStatus);
  const { t } = useTranslation();
  if (phase === 'idle') return null;
  const failed = phase === 'failed';
  const label = t(failed ? 'app.saveFailed' : phase === 'saving' ? 'app.saving' : 'app.saved');
  const indicator = (
    <div className={`flex flex-wrap items-center gap-1 text-xs ${failed ? 'fixed left-4 right-4 top-16 z-[100] mx-auto max-w-xl rounded-lg border border-destructive bg-background p-3 text-destructive shadow-lg' : 'text-muted-foreground'}`} data-save-indicator>
      <span role="status" aria-live="polite" className="inline-flex items-center gap-1" title={label}>
        {failed ? <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" /> : phase === 'saving' ?
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 motion-safe:animate-spin" /> : <Check aria-hidden="true" className="h-3.5 w-3.5" />}
        <span className={failed ? '' : 'sr-only sm:not-sr-only'}>{label}</span>
      </span>
      {failed && <>
        <button type="button" className="min-h-11 px-2 underline" onClick={retryPersistence}>{t('app.retrySave')}</button>
        <button type="button" className="min-h-11 px-2 underline" onClick={downloadBackup}>{t('app.backupSave')}</button>
      </>}
    </div>
  );
  return failed ? createPortal(indicator, document.body) : indicator;
}
