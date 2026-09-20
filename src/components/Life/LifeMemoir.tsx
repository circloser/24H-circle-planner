import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, Copy, Download, Loader2, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { track } from '@/lib/track';
import {
  MemoirError, buildMemoirRequest, canWriteMemoir, downloadMemoir, fetchMemoirState,
  formatMemoirPrice, memoirBlocks, startMemoirCheckout, writeMemoir, type MemoirState,
} from '@/lib/life-memoir';
import type { LifeApi } from '@/hooks/useLife';

const MAX_WISH = 200;

/** Whatever went wrong, in a sentence the reader can act on. */
function reason(err: unknown): 'life.memoir.noCredit' | 'life.memoir.tooLittle' | 'life.memoir.failed' {
  const code = err instanceof MemoirError ? err.code : '';
  if (code === 'no_credit') return 'life.memoir.noCredit';
  if (code === 'too_little') return 'life.memoir.tooLittle';
  return 'life.memoir.failed';
}

/**
 * 자서전 — where the line ends, the life written out.
 *
 * Bought once, not part of Pro (see lib/life-memoir). The whole section is
 * absent unless the server has a writer set up, so nothing here is ever a
 * dead button. Photographs are not sent, and are not even carried to this
 * side of the call.
 */
export function LifeMemoir({ api, lang }: { api: LifeApi; lang: string }) {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const [state, setState] = useState<MemoirState | null>(null);
  const [open, setOpen] = useState(false);
  const [wish, setWish] = useState('');
  const [draft, setDraft] = useState<string | null>(null); // the text as it arrives
  const [busy, setBusy] = useState(false);
  const memoir = api.life.memoir;
  const writing = useRef(false);

  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    void fetchMemoirState().then((s) => { if (alive) setState(s); });
    return () => { alive = false; };
  }, [user, reload]);

  // Back from a paid checkout: count the credit, say so, and open the form the
  // buyer was in the middle of.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('memoir') !== 'paid') return;
    params.delete('memoir');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    track('memoir_paid');
    void fetchMemoirState().then((s) => {
      setState(s);
      setOpen(true);
      toast.success(t('life.memoir.paid'));
    });
  }, [t]);

  const write = async () => {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setOpen(false);
    setDraft('');
    track('memoir_write');
    try {
      const text = await writeMemoir(buildMemoirRequest(api.life, lang, wish), setDraft);
      api.setMemoir(text);
      setWish('');
      toast.success(t('life.memoir.done'));
    } catch (err) {
      toast.error(t(reason(err)));
    } finally {
      writing.current = false;
      setBusy(false);
      setDraft(null);
      void refresh();
    }
  };

  const buy = async () => {
    setBusy(true);
    track('memoir_buy');
    try {
      await startMemoirCheckout();
    } catch {
      toast.error(t('life.memoir.checkoutFailed'));
      setBusy(false);
    }
  };

  // Nothing to write about yet, or no writer on the server: say nothing at all.
  if (!state?.enabled || !canWriteMemoir(api.life)) return null;

  const price = formatMemoirPrice(state.price, lang);
  const paid = state.credits > 0;
  const shown = draft !== null ? draft : memoir?.text ?? '';
  const blocks = memoirBlocks(shown);

  return (
    <section aria-labelledby="life-memoir" className="mx-auto w-full max-w-[960px]" data-life-memoir>
      <div className="mx-4 mt-14 max-w-[640px] min-[900px]:mx-auto">
        <h3 id="life-memoir" className="life-serif flex items-center justify-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <BookOpen aria-hidden className="h-5 w-5 text-muted-foreground" />
          {t('life.memoir.title')}
        </h3>

        {blocks.length > 0 ? (
          <article className="life-serif mt-6 text-[16px] leading-[1.9] text-foreground" data-life-memoir-text>
            {blocks.map((b, i) => (
              b.kind === 'h'
                ? <h4 key={i} className="mt-8 text-center text-[17px] font-bold first:mt-0">{b.text}</h4>
                : <p key={i} className="mt-4 whitespace-pre-wrap">{b.text}</p>
            ))}
          </article>
        ) : (
          <p className="mt-4 text-center text-[15px] italic text-muted-foreground">{t('life.memoir.lead')}</p>
        )}

        {busy && (
          <p className="mt-6 flex items-center justify-center gap-2 text-[13px] italic text-muted-foreground" role="status" data-life-memoir-writing>
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            {t('life.memoir.writing')}
          </p>
        )}

        {!busy && (
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            <Button variant={memoir ? 'outline' : 'default'} size="sm" className="gap-1.5" data-life-memoir-start
              onClick={() => (user ? setOpen(true) : login())}>
              {memoir ? <RefreshCw aria-hidden className="h-4 w-4" /> : <BookOpen aria-hidden className="h-4 w-4" />}
              {memoir
                ? t('life.memoir.again')
                : !user ? t('life.memoir.signIn')
                : paid ? t('life.memoir.write')
                : price ? t('life.memoir.buy', { price }) : t('life.memoir.write')}
            </Button>
            {memoir && (
              <>
                <Button variant="ghost" size="sm" className="gap-1.5" data-life-memoir-copy
                  onClick={() => { void navigator.clipboard?.writeText(memoir.text).then(() => toast.success(t('life.memoir.copied'))); }}>
                  <Copy aria-hidden className="h-4 w-4" />
                  {t('life.memoir.copy')}
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5" data-life-memoir-download
                  onClick={() => downloadMemoir(memoir.text, api.life.profile.name)}>
                  <Download aria-hidden className="h-4 w-4" />
                  {t('life.memoir.download')}
                </Button>
              </>
            )}
          </div>
        )}

        {paid && !memoir && !busy && (
          <p className="mt-3 text-center text-[13px] italic text-muted-foreground" data-life-memoir-credits>
            {t('life.memoir.credits', { n: String(state.credits) })}
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto" data-life-memoir-dialog>
          <DialogHeader>
            <DialogTitle>{t('life.memoir.title')}</DialogTitle>
            <DialogDescription>{t('life.memoir.lead')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">{t('life.memoir.wish')}</span>
              <textarea value={wish} maxLength={MAX_WISH} rows={2} placeholder={t('life.memoir.wishHint')}
                data-life-memoir-wish
                onChange={(e) => setWish(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            {/* What leaves the device, said before it does. */}
            <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">
              <p>{t('life.memoir.sends')}</p>
              <p className="mt-2">{t('life.memoir.privacy')}</p>
              {!paid && <p className="mt-2">{t('life.memoir.once')}</p>}
            </div>
            <Button className="w-full" disabled={busy} data-life-memoir-go
              onClick={() => (paid ? void write() : void buy())}>
              {paid ? t('life.memoir.write') : price ? t('life.memoir.buy', { price }) : t('life.memoir.write')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
