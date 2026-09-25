import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, Check, Copy, Download, Feather, Loader2, RefreshCw, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { track } from '@/lib/track';
import {
  MemoirError, buildMemoirRequest, downloadMemoir, formatMemoirPrice, memoirBlocks, startMemoirCheckout, writeMemoir,
  type MemoirState,
} from '@/lib/life-memoir';
import { MEMOIR_OTHERS_NEEDED, gatherRecords, memoirReadiness } from '@/lib/ai-records';
import { usePersistedState } from '@/hooks/usePersistedState';
import { MEMOIRS_KEY, addMemoir, memoirList, memoirsCodec } from '@/lib/memoir-history';
import type { LifeApi } from '@/hooks/useLife';
import type { TKey } from '@/i18n/translations';

const MAX_WISH = 200;

/** Whatever went wrong, in a sentence the reader can act on. */
function reason(err: unknown): 'life.memoir.noCredit' | 'life.memoir.tooLittle' | 'life.memoir.failed' {
  const code = err instanceof MemoirError ? err.code : '';
  if (code === 'no_credit') return 'life.memoir.noCredit';
  if (code === 'too_little') return 'life.memoir.tooLittle';
  return 'life.memoir.failed';
}

/**
 * 자서전 — the whole of the record, written out as one story.
 *
 * Opened from the card at the foot of the life page (LifeReadings). It is
 * written from everything the app holds — the life line, the people, the
 * diary, the places, "about me" — and so it is only offered once there is
 * enough of it: the checklist says what there is and what is still missing,
 * and the button waits until it is met. Photographs are never sent.
 */
export function MemoirDialog({ open, onOpenChange, api, state, onChanged, fallbackPrice }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  api: LifeApi;
  state: MemoirState;
  /** Something changed on the server's side (a credit spent). */
  onChanged: () => void;
  /** The launch price, shown while the till is not open. */
  fallbackPrice: string;
}) {
  const { t, lang } = useTranslation();
  const { user, login } = useAuth();
  const [wish, setWish] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const writing = useRef(false);
  const memoir = api.life.memoir;
  // Every memoir written, newest first; the one on screen is picked from it.
  const [history, setHistory] = usePersistedState(MEMOIRS_KEY, memoirsCodec);
  const legacy = memoir ? { text: memoir.text, createdAt: memoir.createdAt } : null;
  const list = memoirList(history, legacy);
  const [shownAt, setShownAt] = useState(0);
  const current = list[Math.min(shownAt, Math.max(0, list.length - 1))] ?? null;
  // The free first page: what the whole would read like, before paying.
  const [taste, setTaste] = useState<string | null>(null);
  const [tasting, setTasting] = useState(false);
  const { count } = gatherRecords(lang);
  const ready = memoirReadiness(count);
  const admin = Boolean(state.admin);
  const paid = admin || state.credits > 0;
  const price = formatMemoirPrice(state.price, lang) ?? fallbackPrice;

  const write = async () => {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    setDraft('');
    track('memoir_write');
    try {
      const req = { ...buildMemoirRequest(api.life, lang, wish), records: gatherRecords(lang).digest };
      const text = await writeMemoir(req, setDraft);
      api.setMemoir(text);
      setHistory((h) => addMemoir(h, { text, createdAt: new Date().toISOString() }, legacy));
      setShownAt(0);
      setWish('');
      toast.success(t('life.memoir.done'));
    } catch (err) {
      // An admin trying it out is told the writer's own reason.
      const why = admin && err instanceof MemoirError && err.detail ? ` (${err.detail})` : '';
      toast.error(`${t(reason(err))}${why}`, { duration: why ? 15000 : undefined });
    } finally {
      writing.current = false;
      setBusy(false);
      setDraft(null);
      onChanged();
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

  const go = () => {
    if (!user) return login();
    return paid ? void write() : void buy();
  };

  const readTaste = async () => {
    if (!user) return login();
    setTasting(true);
    setTaste('');
    track('memoir_taste');
    try {
      const req = { ...buildMemoirRequest(api.life, lang, '') };
      await writeMemoir(req, setTaste, undefined, '/api/life/memoir/taste');
    } catch (err) {
      setTaste(null);
      const used = err instanceof MemoirError && err.code === 'taste_used';
      const why = admin && err instanceof MemoirError && err.detail ? ` (${err.detail})` : '';
      toast.error(`${t(used ? 'life.memoir.taste.used' : 'life.memoir.taste.failed')}${why}`);
    } finally {
      setTasting(false);
    }
  };

  const forget = (at: string) => {
    const left = history.items.filter((m) => m.createdAt !== at);
    setHistory({ version: 1, items: left });
    // The life record keeps the latest; it follows what is left.
    if (current && current.createdAt === at && memoir?.text === current.text) api.setMemoir(left.at(-1)?.text ?? '');
    setShownAt(0);
  };
  const shown = draft !== null ? draft : current?.text ?? '';
  const blocks = memoirBlocks(shown);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-xl flex-col gap-4 overflow-y-auto" data-life-memoir data-life-memoir-dialog>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen aria-hidden className="h-5 w-5 text-muted-foreground" />
            {t('life.memoir.title')}
          </DialogTitle>
          <DialogDescription>{t('life.memoir.lead')}</DialogDescription>
        </DialogHeader>

        {/* Enough to write from? Every record, what there is and what it needs. */}
        <section className="rounded-xl border border-border p-3" data-life-memoir-ready={ready.ok || undefined}>
          <h4 className="text-[13px] font-semibold text-foreground">{t('life.memoir.ready.title')}</h4>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t('life.memoir.ready.rule')}</p>
          <ul className="mt-2 flex flex-col gap-1" data-life-memoir-checklist>
            {ready.items.map((i) => (
              <li key={i.key} className="flex items-center gap-2 text-[13px]" data-life-memoir-need={i.key} data-met={i.met || undefined}>
                <span aria-hidden className={`grid h-4 w-4 place-items-center rounded-full border ${
                  i.met ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
                  {i.met && <Check className="h-3 w-3" />}
                </span>
                <span className="flex-1 text-foreground">
                  {t(`life.memoir.ready.${i.key}` as TKey)}
                  {i.required && <span className="ml-1.5 text-[11px] text-muted-foreground">{t('life.memoir.ready.required')}</span>}
                </span>
                <span className="tabular-nums text-muted-foreground">{i.have} / {i.need}</span>
              </li>
            ))}
          </ul>
          {!ready.ok && (
            <p className="mt-2 text-[12px] font-medium text-foreground" role="status" data-life-memoir-not-ready
              data-others-needed={MEMOIR_OTHERS_NEEDED}>
              {t('life.memoir.notReady')}
            </p>
          )}
        </section>

        {count.moments >= 3 && !busy && (
          <section className="rounded-xl border border-dashed border-border p-3" data-life-memoir-taste>
            <div className="flex items-start gap-2">
              <Feather aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="flex-1 text-[12px] leading-relaxed text-muted-foreground">{t('life.memoir.taste.hint')}</p>
            </div>
            {taste === null && (
              <Button variant="outline" size="sm" className="mt-2 w-full gap-1.5" disabled={tasting} data-life-memoir-taste-go
                onClick={() => void readTaste()}>
                {tasting ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Feather aria-hidden className="h-4 w-4" />}
                {t('life.memoir.taste.open')}
              </Button>
            )}
            {taste !== null && (
              <blockquote className="life-serif mt-3 whitespace-pre-wrap border-l-2 border-primary/50 pl-3 text-[15px] leading-[1.9] text-foreground"
                data-life-memoir-taste-text>
                {taste || t('life.memoir.taste.writing')}
              </blockquote>
            )}
          </section>
        )}

        {ready.ok && !busy && (
          <div className="flex flex-col gap-3">
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
            <Button className="w-full gap-1.5" data-life-memoir-go data-life-memoir-start onClick={go}>
              {memoir ? <RefreshCw aria-hidden className="h-4 w-4" /> : <BookOpen aria-hidden className="h-4 w-4" />}
              {!user
                ? t('life.memoir.signIn')
                : admin ? `${t(memoir ? 'life.memoir.again' : 'life.memoir.write')} · ${t('life.readings.admin')}`
                : paid ? t(memoir ? 'life.memoir.again' : 'life.memoir.write')
                : t('life.memoir.buy', { price })}
            </Button>
            {!admin && state.credits > 0 && (
              <p className="text-center text-[13px] italic text-muted-foreground" data-life-memoir-credits>
                {t('life.memoir.credits', { n: String(state.credits) })}
              </p>
            )}
          </div>
        )}

        {busy && (
          <p className="flex items-center justify-center gap-2 text-[13px] italic text-muted-foreground" role="status" data-life-memoir-writing>
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            {t('life.memoir.writing')}
          </p>
        )}

        {blocks.length > 0 && (
          <>
            <article className="life-serif text-[16px] leading-[1.9] text-foreground" data-life-memoir-text>
              {blocks.map((b, i) => (
                b.kind === 'h'
                  ? <h4 key={i} className="mt-8 text-center text-[17px] font-bold first:mt-0">{b.text}</h4>
                  : <p key={i} className="mt-4 whitespace-pre-wrap">{b.text}</p>
              ))}
            </article>
            {current && !busy && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="ghost" size="sm" className="gap-1.5" data-life-memoir-copy
                  onClick={() => { void navigator.clipboard?.writeText(current.text).then(() => toast.success(t('life.memoir.copied'))); }}>
                  <Copy aria-hidden className="h-4 w-4" />
                  {t('life.memoir.copy')}
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5" data-life-memoir-download
                  onClick={() => downloadMemoir(current.text, api.life.profile.name)}>
                  <Download aria-hidden className="h-4 w-4" />
                  {t('life.memoir.download')}
                </Button>
              </div>
            )}
          </>
        )}

        {list.length > 1 && !busy && (
          <section className="flex flex-col gap-1.5 border-t border-border pt-3" data-life-memoir-past>
            <h4 className="text-[12px] font-semibold text-muted-foreground">{t('life.memoir.past')}</h4>
            <ul className="flex flex-wrap gap-1">
              {list.map((m, i) => (
                <li key={`${m.createdAt}-${i}`} className="flex items-center">
                  <button type="button" aria-pressed={i === shownAt} data-life-memoir-past-item={i}
                    className={`rounded-l-full border px-2.5 py-1 text-[12px] tabular-nums ${
                      i === shownAt ? 'border-foreground text-foreground' : 'border-border text-muted-foreground'}`}
                    onClick={() => setShownAt(i)}>
                    {m.createdAt ? m.createdAt.slice(0, 10) : t('life.memoir.pastUndated')}
                  </button>
                  <button type="button" aria-label={t('common.delete')} data-life-memoir-past-remove={i}
                    className="grid h-[26px] w-6 place-items-center rounded-r-full border border-l-0 border-border text-muted-foreground hover:bg-accent/20"
                    onClick={() => forget(m.createdAt)}>
                    <X aria-hidden className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
