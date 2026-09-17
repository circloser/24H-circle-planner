import { useState, useSyncExternalStore } from 'react';
import { CalendarDays, Lock, Plus, RefreshCw, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { requestUpgrade } from '@/lib/pro';
import { track } from '@/lib/track';
import { MAX_FEEDS, type IcalError, type IcalFeeds } from '@/hooks/useIcalFeed';
import { E2EE_EVENT, isE2eeEnabled, requestPassphrase } from '@/lib/sync/e2ee';
import type { TKey } from '@/i18n/translations';

/** Whether this device holds a passphrase, kept live (the dialog can turn it on
 *  from here, and the answer changes while this dialog is open). */
function useLocked(): boolean {
  return !useSyncExternalStore(
    (onChange) => {
      window.addEventListener(E2EE_EVENT, onChange);
      return () => window.removeEventListener(E2EE_EVENT, onChange);
    },
    () => isE2eeEnabled(),
    () => false,
  );
}

const ERROR_KEY: Record<IcalError, TKey> = {
  pro_required: 'ical.proBody',
  unauthorized: 'ical.errSignIn',
  bad_url: 'ical.errBadUrl',
  feed_not_found: 'ical.errNotFound',
  failed: 'ical.errFailed',
};

/**
 * Connecting Google calendars by their private iCal address (Pro). Several can
 * be listed, each with its own tone. Read-only by design: nothing here can
 * write back to Google, and the addresses stay on this device — see
 * useIcalFeed for why.
 */
export function IcalConnect({ feeds, open, onOpenChange }: {
  feeds: IcalFeeds; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('ical.title')}</DialogTitle>
        </DialogHeader>
        {/* Mounted with the dialog, so the field always opens empty. */}
        <IcalBody feeds={feeds} />
      </DialogContent>
    </Dialog>
  );
}

function IcalBody({ feeds }: { feeds: IcalFeeds }) {
  const { t, lang } = useTranslation();
  const isPro = useAuth().plan === 'pro';
  const locked = useLocked();
  const [draft, setDraft] = useState('');

  const stamp = (at: number) => (at
    ? new Date(at).toLocaleString(lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '');
  const submit = () => {
    if (!draft.trim() || feeds.full) return;
    feeds.add(draft);
    track('ical_connect');
    setDraft('');
  };

  if (!isPro) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" data-ical-pro>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10">
          <CalendarDays className="h-6 w-6 text-primary" />
        </span>
        <p className="text-sm font-medium text-foreground">{t('ical.proTitle')}</p>
        <p className="max-w-xs text-xs text-muted-foreground">{t('ical.proBody')}</p>
        <Button onClick={() => requestUpgrade('ical')} className="mt-1">{t('billing.upgrade')}</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {feeds.calendars.length > 0 && (
        <ul className="flex flex-col gap-1" data-ical-list>
          {feeds.calendars.map((cal) => (
            <li key={cal.id} data-ical-row className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
              <span className="h-3 w-3 shrink-0 rounded-sm border-2" style={{ borderColor: cal.color }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{cal.name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {cal.error
                    ? t(ERROR_KEY[cal.error])
                    : cal.status === 'loading'
                      ? t('ical.loading')
                      : cal.fetchedAt ? t('ical.syncedAt', { when: stamp(cal.fetchedAt) }) : ''}
                </span>
              </span>
              <button type="button" data-ical-remove={cal.id} aria-label={t('ical.disconnect')} title={t('ical.disconnect')}
                onClick={() => feeds.remove(cal.id)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded transition-colors hover:bg-black/10">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {locked ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-center" data-ical-locked>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </span>
          <p className="text-sm font-medium text-foreground">{t('ical.lockTitle')}</p>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{t('ical.lockBody')}</p>
          <Button data-ical-setlock onClick={requestPassphrase} className="mt-1 gap-1.5">
            <Lock className="h-4 w-4" />
            {t('ical.lockCta')}
          </Button>
        </div>
      ) : (
      <>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('ical.how')}</p>
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder={t('ical.placeholder')}
          aria-label={t('ical.title')}
          disabled={feeds.full}
          data-ical-input
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground disabled:opacity-50"
        />
        <Button data-ical-connect disabled={!draft.trim() || feeds.full} onClick={submit} className="shrink-0 gap-1">
          <Plus className="h-4 w-4" />
          {t('ical.connect')}
        </Button>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {feeds.full ? t('ical.full', { n: String(MAX_FEEDS) }) : t('ical.secretNote')}
      </p>
      </>
      )}

      {/* The one just pasted may not have a row yet, so its error shows here. */}
      {feeds.lastError && <p className="text-xs text-red-500" data-ical-error>{t(ERROR_KEY[feeds.lastError])}</p>}

      {feeds.calendars.length > 0 && (
        <div>
          <Button variant="outline" data-ical-refresh onClick={feeds.refresh} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${feeds.loading ? 'animate-spin' : ''}`} />
            {t('ical.refresh')}
          </Button>
        </div>
      )}
    </div>
  );
}
