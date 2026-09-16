import { useState } from 'react';
import { CalendarDays, Link2Off, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { requestUpgrade } from '@/lib/pro';
import type { IcalError, IcalFeed } from '@/hooks/useIcalFeed';
import type { TKey } from '@/i18n/translations';

const ERROR_KEY: Record<IcalError, TKey> = {
  pro_required: 'ical.proBody',
  unauthorized: 'ical.errSignIn',
  bad_url: 'ical.errBadUrl',
  feed_not_found: 'ical.errNotFound',
  failed: 'ical.errFailed',
};

/**
 * Pasting the private iCal address of a Google calendar (Pro). Read-only by
 * design: nothing here can write back to Google, and the address stays on this
 * device — see useIcalFeed for why.
 */
export function IcalConnect({ feed, open, onOpenChange }: {
  feed: IcalFeed; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('ical.title')}</DialogTitle>
        </DialogHeader>
        {/* Mounted with the dialog, so the field always opens on the saved address. */}
        <IcalBody feed={feed} />
      </DialogContent>
    </Dialog>
  );
}

function IcalBody({ feed }: { feed: IcalFeed }) {
  const { t, lang } = useTranslation();
  const isPro = useAuth().plan === 'pro';
  const [draft, setDraft] = useState(feed.url);

  const when = feed.fetchedAt
    ? new Date(feed.fetchedAt).toLocaleString(lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return !isPro ? (
    <div className="flex flex-col items-center gap-3 py-6 text-center" data-ical-pro>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10">
        <CalendarDays className="h-6 w-6 text-primary" />
      </span>
      <p className="text-sm font-medium text-foreground">{t('ical.proTitle')}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{t('ical.proBody')}</p>
      <Button onClick={requestUpgrade} className="mt-1">{t('billing.upgrade')}</Button>
    </div>
  ) : (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">{t('ical.how')}</p>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { e.preventDefault(); feed.connect(draft); } }}
        placeholder={t('ical.placeholder')}
        aria-label={t('ical.title')}
        data-ical-input
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
      />
      <p className="text-[11px] leading-relaxed text-muted-foreground">{t('ical.secretNote')}</p>

      {feed.error && <p className="text-xs text-red-500" data-ical-error>{t(ERROR_KEY[feed.error])}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button data-ical-connect disabled={!draft.trim() || draft.trim() === feed.url} onClick={() => feed.connect(draft)}>
          {t('ical.connect')}
        </Button>
        {feed.url && (
          <>
            <Button variant="outline" data-ical-refresh onClick={feed.refresh} className="gap-1.5">
              <RefreshCw className={`h-4 w-4 ${feed.status === 'loading' ? 'animate-spin' : ''}`} />
              {t('ical.refresh')}
            </Button>
            <Button variant="outline" data-ical-disconnect onClick={() => { feed.disconnect(); setDraft(''); }} className="gap-1.5">
              <Link2Off className="h-4 w-4" />
              {t('ical.disconnect')}
            </Button>
          </>
        )}
      </div>

      {feed.url && (
        <p className="text-[11px] text-muted-foreground" data-ical-state>
          {feed.status === 'loading' ? t('ical.loading') : when ? t('ical.syncedAt', { when }) : ''}
        </p>
      )}
    </div>
  );
}
