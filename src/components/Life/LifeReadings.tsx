import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, Sparkles } from 'lucide-react';
import { useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { track } from '@/lib/track';
import { claimMemoir, fetchMemoirState, formatMemoirPrice, type MemoirState } from '@/lib/life-memoir';
import { READING_PRICE, fetchSajuState, type SajuState } from '@/lib/saju-reading';
import type { LifeApi } from '@/hooks/useLife';
import { MemoirDialog } from './LifeMemoir';
import { SajuDialog } from './LifeSaju';

/**
 * The foot of the life page: two readings written from the whole record —
 * the 사주 on the left, the memoir on the right.
 *
 * They are being tried out by the admins first. The server says which of them
 * this account may see (worker/index.ts); anybody it does not name sees
 * nothing here at all, so nothing on this page is ever a dead button.
 */
export function LifeReadings({ api }: { api: LifeApi }) {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const [memoir, setMemoir] = useState<MemoirState | null>(null);
  const [saju, setSaju] = useState<SajuState | null>(null);
  const [opened, setOpened] = useState<'saju' | 'memoir' | null>(null);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    void Promise.all([fetchMemoirState(), fetchSajuState()]).then(([m, s]) => {
      if (!alive) return;
      setMemoir(m);
      setSaju(s);
    });
    return () => { alive = false; };
  }, [user, reload]);

  // Back from a paid checkout: count the credit, say so, and open the memoir.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('memoir') !== 'paid') return;
    // Polar puts the checkout id in the address it sends the buyer back to.
    const checkout = params.get('checkout_id') ?? '';
    params.delete('memoir');
    params.delete('checkout_id');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
    track('memoir_paid');
    void (checkout ? claimMemoir(checkout) : Promise.resolve())
      .then(fetchMemoirState)
      .then((s) => {
        setMemoir(s);
        setOpened('memoir');
        toast.success(t('life.memoir.paid'));
      });
  }, [t]);

  const money = (cents: number) => formatMemoirPrice({ amount: cents, currency: 'usd' }, lang) ?? `$${cents / 100}`;
  const showSaju = !!saju?.enabled;
  const showMemoir = !!memoir?.enabled;
  // An admin is told what is missing on the server rather than shown nothing.
  const missing = saju?.admin && !saju.enabled ? saju.missing : undefined;
  if (!showSaju && !showMemoir && !missing) return null;

  const card = 'flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:border-foreground/40 disabled:opacity-50';
  return (
    <section aria-labelledby="life-readings" className="mx-auto mt-14 w-full max-w-[720px] px-4" data-life-readings>
      <h3 id="life-readings" className="life-serif text-center text-xl font-bold tracking-tight text-foreground">
        {t('life.readings.title')}
      </h3>
      {(saju?.admin || memoir?.admin) && (
        <p className="mt-1 text-center text-[12px] text-muted-foreground" data-life-readings-admin>{t('life.readings.admin')}</p>
      )}
      {missing && (
        <p className="mt-2 text-center text-[12px] text-destructive" data-life-readings-missing>
          {t('life.readings.missing', { what: missing })}
        </p>
      )}
      {/* Left the 사주, right the memoir — on a phone as on a desk. */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" className={card} disabled={!showSaju} data-life-reading="saju"
          onClick={() => { track('saju_open'); setOpened('saju'); }}>
          <Sparkles aria-hidden className="h-5 w-5 text-muted-foreground" />
          <span className="text-base font-semibold text-foreground">{t('saju.title')}</span>
          <span className="text-[12px] leading-snug text-muted-foreground">{t('saju.card')}</span>
          <span className="mt-auto pt-1 text-[12px] font-semibold text-foreground" data-life-reading-price="saju">
            {t('life.readings.price', { price: money(READING_PRICE.saju) })}
          </span>
        </button>
        <button type="button" className={card} disabled={!showMemoir} data-life-reading="memoir"
          onClick={() => setOpened('memoir')}>
          <BookOpen aria-hidden className="h-5 w-5 text-muted-foreground" />
          <span className="text-base font-semibold text-foreground">{t('life.memoir.title')}</span>
          <span className="text-[12px] leading-snug text-muted-foreground">{t('life.memoir.card')}</span>
          <span className="mt-auto pt-1 text-[12px] font-semibold text-foreground" data-life-reading-price="memoir">
            {memoir?.admin || !memoir?.price
              ? t('life.readings.price', { price: money(READING_PRICE.memoir) })
              : formatMemoirPrice(memoir.price, lang)}
          </span>
        </button>
      </div>

      {showSaju && (
        <SajuDialog open={opened === 'saju'} onOpenChange={(o) => setOpened(o ? 'saju' : null)}
          birthDate={api.life.profile.birthDate} name={api.life.profile.name ?? ''} admin={Boolean(saju?.admin)}
          price={money(READING_PRICE.saju)} />
      )}
      {showMemoir && memoir && (
        <MemoirDialog open={opened === 'memoir'} onOpenChange={(o) => setOpened(o ? 'memoir' : null)}
          api={api} state={memoir} onChanged={refresh} fallbackPrice={money(READING_PRICE.memoir)} />
      )}
    </section>
  );
}
