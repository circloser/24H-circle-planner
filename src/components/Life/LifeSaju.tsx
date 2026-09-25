import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, Link2, Loader2, Share2, Sparkles, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/usePreferences';
import { usePersistedState } from '@/hooks/usePersistedState';
import { track } from '@/lib/track';
import { isFullDate } from '@/lib/life';
import { memoirBlocks } from '@/lib/life-memoir';
import { gatherRecords } from '@/lib/ai-records';
import { ELEMENTS, ELEMENT_KO, STEMS, branchElement, pillarHanja, pillarKo, stemElement, type Element, type Pillar } from '@/lib/saju';
import {
  MAX_SAJU_READINGS, SAJU_KEY, SAJU_SHARE_URL, buildSajuRequest, sajuCodec, sajuParts, viewChart, writeSaju,
  type ChartView,
} from '@/lib/saju-reading';
import { downloadBlob } from '@/lib/share';
import { todayKey } from '@/lib/calendar-grid';
import type { TKey } from '@/i18n/translations';
import {
  BRANCH_ROMAN, STEM_ROMAN, asLang, dayMasterOf, elementLabel, ELEMENT_NAME, tenGodLabel,
} from '@/lib/saju-daymaster';

/** The five elements in the muted colours of the rest of the app. */
const ELEMENT_COLOR: Record<Element, string> = {
  wood: '#5f8a5b', fire: '#b4544a', earth: '#b08a4a', metal: '#8a8f99', water: '#4d6f93',
};

/**
 * The written reading: the one line and its three words at the top, as the
 * card will show them, then the chapters and paragraphs.
 */
function Reading({ text }: { text: string }) {
  const { headline, keywords, body } = sajuParts(text);
  return (
    <div className="flex flex-col gap-4" data-saju-text>
      {headline && (
        <figure className="rounded-2xl border border-border bg-muted/30 px-5 py-4 text-center" data-saju-headline>
          <blockquote className="life-serif text-[18px] font-semibold leading-snug text-foreground">“{headline}”</blockquote>
          {keywords.length > 0 && (
            <figcaption className="mt-3 flex flex-wrap justify-center gap-1.5">
              {keywords.map((k) => (
                <span key={k} className="rounded-full bg-accent/30 px-2.5 py-0.5 text-[12px] font-medium text-foreground" data-saju-keyword>#{k}</span>
              ))}
            </figcaption>
          )}
        </figure>
      )}
      <article className="life-serif text-[15px] leading-[1.85] text-foreground">
        {memoirBlocks(body).map((b, i) => (
          b.kind === 'h'
            ? <h4 key={i} className="mt-7 border-l-2 border-primary/60 pl-2.5 text-[16px] font-bold first:mt-0">{b.text}</h4>
            : <p key={i} className="mt-3 whitespace-pre-wrap">{b.text}</p>
        ))}
      </article>
    </div>
  );
}

/** Words for the chart in the reader's language (Korean readers keep the Korean). */
function useChartWords() {
  const { lang } = useTranslation();
  const l = asLang(lang);
  const ko = l === 'ko';
  return {
    lang: l,
    element: (e: Element) => (ko ? ELEMENT_KO[e] : ELEMENT_NAME[l][e]),
    god: (g: string | undefined) => (g ? tenGodLabel(l, g) : ''),
    reading: (p: Pillar) => (ko ? pillarKo(p) : `${STEM_ROMAN[p.stem]}-${BRANCH_ROMAN[p.branch].toLowerCase()}`),
    /** "Yang Wood · 甲 (Gap)" — the day master as a reader abroad would say it. */
    master: (stem: number) => `${elementLabel(l, stemElement(stem), stem % 2 === 0)} · ${STEMS[stem]}${ko ? '' : ` (${STEM_ROMAN[stem]})`}`,
  };
}

/**
 * The card to share, and the three ways out with it. Only the chart, the one
 * line and the three words go on it — never the reading, which is written from
 * the person's records — and their name only if they tick the box.
 */
function SajuShare({ view, text, name, free }: {
  view: ChartView;
  text: string;
  name: string;
  /** With no written reading, the free birth element is what the card says. */
  free?: { headline: string; keywords: string[] };
}) {
  const { t } = useTranslation();
  const words = useChartWords();
  const [withName, setWithName] = useState(false);
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const parts = sajuParts(text);
  const { headline, keywords } = parts.headline ? parts : free ?? parts;

  const make = async (named: boolean) => {
    setBusy(true);
    try {
      const { sajuCardBlob } = await import('@/lib/export/sajuCard');
      const blob = await sajuCardBlob({
        title: named && name ? t('saju.card.titleOf', { name }) : t('saju.card.title'),
        pillars: view.columns.map((c) => ({
          label: t(`saju.col.${c.label}` as TKey),
          stem: c.pillar ? pillarHanja(c.pillar)[0] : null,
          branch: c.pillar ? pillarHanja(c.pillar)[1] : null,
          reading: c.pillar ? words.reading(c.pillar) : '',
          stemColor: c.pillar ? ELEMENT_COLOR[stemElement(c.pillar.stem)] : '#999',
          branchColor: c.pillar ? ELEMENT_COLOR[branchElement(c.pillar.branch)] : '#999',
        })),
        dayMaster: `${t('saju.dayMaster')} ${words.master(view.chart.day.stem)}`,
        headline,
        keywords,
        elements: ELEMENTS.map((e) => ({ label: words.element(e), n: view.elements[e], color: ELEMENT_COLOR[e] })),
        // A card from the free part asks the next person to find their own.
        cta: parts.headline ? t('saju.card.cta') : t('saju.card.ctaFree'),
        url: SAJU_SHARE_URL,
      });
      if (!blob) throw new Error('no card');
      setCard({ blob, url: URL.createObjectURL(blob) });
    } catch {
      toast.error(t('saju.share.failed'));
    } finally {
      setBusy(false);
    }
  };
  // The picture's address is let go of when the card is closed.
  useEffect(() => () => { if (card) URL.revokeObjectURL(card.url); }, [card]);

  const file = () => new File([card!.blob], `24houring-saju-${todayKey()}.png`, { type: 'image/png' });
  const canShareFile = !!card && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file()] });
  const message = parts.headline ? t('saju.share.text', { line: headline }) : headline ? t('saju.share.textFree', { line: headline }) : t('saju.card.cta');

  const share = async () => {
    try {
      await navigator.share({ files: [file()], text: `${message}\n${SAJU_SHARE_URL}` });
      track('saju_share', { kind: 'shared' });
    } catch { /* closed without sharing */ }
  };
  const save = () => {
    downloadBlob(card!.blob, `24houring-saju-${todayKey()}.png`);
    track('saju_share', { kind: 'downloaded' });
  };
  const copy = () => {
    void navigator.clipboard?.writeText(`${message}\n${SAJU_SHARE_URL}`).then(() => toast.success(t('saju.share.copied')));
    track('saju_share', { kind: 'link' });
  };

  if (!card) {
    return (
      <Button variant="outline" className="w-full gap-1.5" disabled={busy} data-saju-share-open onClick={() => void make(withName)}>
        {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Share2 aria-hidden className="h-4 w-4" />}
        {t('saju.share.open')}
      </Button>
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border p-3" data-saju-share>
      <h4 className="text-[13px] font-semibold text-foreground">{t('saju.share.title')}</h4>
      <img src={card.url} alt={t('saju.share.title')} className="mx-auto max-h-[360px] rounded-lg border border-border" data-saju-card />
      <p className="text-[12px] leading-relaxed text-muted-foreground">{t('saju.share.privacy')}</p>
      {name && (
        <label className="flex items-center gap-2 text-[13px] text-foreground">
          <input type="checkbox" className="h-4 w-4" checked={withName} data-saju-share-name
            onChange={(e) => { setWithName(e.target.checked); void make(e.target.checked); }} />
          {t('saju.share.name')}
        </label>
      )}
      <div className="grid grid-cols-3 gap-1.5">
        <Button size="sm" className="gap-1" disabled={!canShareFile} data-saju-share-go onClick={() => void share()}>
          <Share2 aria-hidden className="h-4 w-4" />{t('saju.share.share')}
        </Button>
        <Button size="sm" variant="outline" className="gap-1" data-saju-share-save onClick={save}>
          <Download aria-hidden className="h-4 w-4" />{t('saju.share.save')}
        </Button>
        <Button size="sm" variant="outline" className="gap-1" data-saju-share-link onClick={copy}>
          <Link2 aria-hidden className="h-4 w-4" />{t('saju.share.link')}
        </Button>
      </div>
    </section>
  );
}

/**
 * 사주 — the chart of a birth, and a reading of it written from the person's
 * own records (lib/saju, lib/saju-reading, worker/readings.ts).
 *
 * The chart is drawn here for free and at once: it is arithmetic. The reading
 * is the part that is written, and it is written from the life line, the
 * people, the places, the diary and "about me" — so it is about this person.
 */
export function SajuDialog({ open, onOpenChange, birthDate, name, admin, price, canRead }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  birthDate: string;
  /** The name on the life line, offered (never forced) for the shared card. */
  name: string;
  /** An admin trying it out: no till. */
  admin: boolean;
  price: string;
  /** Whether the written reading is open to this account. The chart and the
   *  birth element are free for everyone, always. */
  canRead: boolean;
}) {
  const { t, lang } = useTranslation();
  const words = useChartWords();
  const [store, setStore] = usePersistedState(SAJU_KEY, sajuCodec);
  const [draft, setDraft] = useState<string | null>(null);
  const [shown, setShown] = useState(0);
  const writing = useRef(false);
  const known = isFullDate(birthDate);
  const view = known ? viewChart(birthDate, store.time, store.gender) : null;
  const { count } = gatherRecords(lang);
  const readings = [...store.readings].reverse();
  const reading = draft ?? readings[shown]?.text ?? null;

  const read = async () => {
    if (writing.current || !known) return;
    writing.current = true;
    setDraft('');
    track('saju_read');
    try {
      const body = buildSajuRequest(lang, birthDate, store, gatherRecords(lang).digest);
      const text = await writeSaju(body, setDraft);
      setStore((s) => ({ ...s, readings: [...s.readings, { text, createdAt: new Date().toISOString() }].slice(-MAX_SAJU_READINGS) }));
      setShown(0);
      toast.success(t('saju.done'));
    } catch (err) {
      // An admin trying it out is told why, so the server can be put right.
      toast.error(admin && err instanceof Error ? `${t('saju.failed')} (${err.message})` : t('saju.failed'), { duration: admin ? 15000 : undefined });
    } finally {
      writing.current = false;
      setDraft(null);
    }
  };
  const busy = draft !== null;
  const most = view ? Math.max(1, ...Object.values(view.elements)) : 1;
  // The free part: the day master's portrait, read on the device.
  const master = view ? dayMasterOf(lang, view.chart.day.stem) : null;
  const strongest = view ? ELEMENTS.reduce((a, b) => (view.elements[b] > view.elements[a] ? b : a)) : null;
  const free = view && master && strongest
    ? { headline: master.title, keywords: [words.element(stemElement(view.chart.day.stem)), words.element(strongest), t('saju.free.keyword')] }
    : undefined;
  // For a reader who has never heard of saju, the explanation starts open.
  const [whatOpen, setWhatOpen] = useState(lang !== 'ko');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-xl flex-col gap-4 overflow-y-auto" data-saju-dialog>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('saju.title')}
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-normal text-muted-foreground">{t('saju.badge')}</span>
          </DialogTitle>
          <DialogDescription>{t('saju.subtitle')}</DialogDescription>
        </DialogHeader>

        {/* What saju is, for anyone meeting it for the first time. */}
        <section className="rounded-xl border border-border bg-muted/30 px-3.5 py-2.5" data-saju-what>
          <button type="button" aria-expanded={whatOpen} className="flex w-full items-center justify-between text-left text-[13px] font-semibold text-foreground"
            data-saju-what-toggle onClick={() => setWhatOpen((o) => !o)}>
            {t('saju.what.title')}
            <span aria-hidden className="text-muted-foreground">{whatOpen ? '−' : '+'}</span>
          </button>
          {whatOpen && <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{t('saju.what.body')}</p>}
        </section>

        {/* When: the birthday is the life line's; the hour and the gender are asked here. */}
        <section className="grid grid-cols-[88px_1fr] items-center gap-x-3 gap-y-2 text-sm">
          <span className="text-muted-foreground">{t('saju.birth')}</span>
          <span className="tabular-nums text-foreground" data-saju-birth>{known ? birthDate : t('saju.noBirth')}</span>
          <span className="text-muted-foreground">{t('saju.time')}</span>
          <span className="flex items-center gap-2">
            <Input type="time" value={store.time ?? ''} disabled={!known} data-saju-time className="h-9 w-[130px]"
              onChange={(e) => setStore((s) => {
                const time = e.target.value;
                const { time: _drop, ...rest } = s;
                void _drop;
                return /^\d{2}:\d{2}$/.test(time) ? { ...rest, time } : rest;
              })} />
            <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <input type="checkbox" checked={!store.time} data-saju-time-unknown
                onChange={(e) => { if (e.target.checked) setStore(({ time: _drop, ...rest }) => { void _drop; return rest; }); }} />
              {t('saju.timeUnknown')}
            </label>
          </span>
          <span className="text-muted-foreground">{t('saju.gender')}</span>
          <span className="flex flex-col gap-1">
            <span className="flex gap-1.5">
              {(['male', 'female'] as const).map((g) => (
                <button key={g} type="button" data-saju-gender={g} aria-pressed={store.gender === g} disabled={!known}
                  onClick={() => setStore((s) => ({ ...s, gender: g }))}
                  className={`min-h-8 rounded-full border px-3 text-[13px] ${
                    store.gender === g ? 'border-foreground bg-accent/20 text-foreground' : 'border-border text-muted-foreground'}`}>
                  {t(g === 'male' ? 'saju.male' : 'saju.female')}
                </button>
              ))}
            </span>
            <span className="text-[12px] text-muted-foreground">{t('saju.genderHint')}</span>
          </span>
        </section>

        {view && (
          <>
            {/* The four pillars, read right to left as a chart is. */}
            <section className="grid grid-cols-4 gap-1.5 text-center" data-saju-chart>
              {view.columns.map((c) => (
                <div key={c.label} className="flex flex-col items-center gap-0.5 rounded-xl border border-border py-2"
                  data-saju-pillar={c.label}>
                  <span className="text-[11px] text-muted-foreground">{t(`saju.col.${c.label}` as TKey)}</span>
                  {c.pillar ? (
                    <>
                      <span className="text-[11px] text-muted-foreground">{words.god(c.stemGod ?? '일간')}</span>
                      <span className="text-2xl font-semibold" style={{ color: ELEMENT_COLOR[stemElement(c.pillar.stem)] }}>
                        {pillarHanja(c.pillar)[0]}
                      </span>
                      <span className="text-2xl font-semibold text-foreground">{pillarHanja(c.pillar)[1]}</span>
                      <span className="text-[12px] text-muted-foreground">{words.reading(c.pillar)}</span>
                      <span className="text-[11px] text-muted-foreground">{words.god(c.branchGod)}</span>
                    </>
                  ) : (
                    <span className="py-6 text-[12px] text-muted-foreground">{t('saju.timeUnknown')}</span>
                  )}
                </div>
              ))}
            </section>

            {/* The free part: who the day master says you are, in a paragraph. */}
            {master && (
              <section className="flex items-start gap-3 rounded-2xl border border-border bg-surface px-4 py-3" data-saju-daymaster>
                <span className="text-4xl font-semibold leading-none" style={{ color: ELEMENT_COLOR[stemElement(view.chart.day.stem)] }}>
                  {STEMS[view.chart.day.stem]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-muted-foreground">{t('saju.free.title')} · {words.master(view.chart.day.stem)}</p>
                  <h4 className="life-serif text-[17px] font-bold text-foreground" data-saju-daymaster-title>{master.title}</h4>
                  <p className="mt-1 text-[13px] leading-relaxed text-foreground/85">{master.text}</p>
                </div>
              </section>
            )}

            <section className="flex flex-col gap-1.5" data-saju-elements>
              <h4 className="text-[12px] font-semibold text-muted-foreground">{t('saju.elements')}</h4>
              {ELEMENTS.map((e) => (
                <div key={e} className="flex items-center gap-2 text-[12px]">
                  <span className="w-14 shrink-0 text-muted-foreground">{words.element(e)}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full" style={{ width: `${(view.elements[e] / most) * 100}%`, background: ELEMENT_COLOR[e] }} />
                  </span>
                  <span className="w-4 shrink-0 text-right tabular-nums text-foreground">{view.elements[e]}</span>
                </div>
              ))}
            </section>

            <section className="flex flex-col gap-1.5" data-saju-daeun>
              <h4 className="text-[12px] font-semibold text-muted-foreground">{t('saju.daeun')}</h4>
              {view.daeun ? (
                <div className="grid grid-cols-5 gap-1 sm:grid-cols-10">
                  {view.daeun.periods.map((d, i) => (
                    <div key={d.startAge} data-saju-daeun-cell={i} data-now={i === view.current || undefined}
                      className={`flex flex-col items-center rounded-lg border py-1 text-center ${
                        i === view.current ? 'border-primary bg-primary/10' : i < view.current ? 'border-border' : 'border-dashed border-border'}`}>
                      <span className="text-[10px] tabular-nums text-muted-foreground">{d.startAge}</span>
                      <span className="text-[13px] font-semibold text-foreground">{pillarHanja(d.pillar)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground">{t('saju.daeunNeeds')}</p>
              )}
            </section>
          </>
        )}

        {!canRead && view && !reading && <SajuShare key="free" view={view} text="" name={name} free={free} />}
        {!canRead && <p className="text-center text-[12px] text-muted-foreground" data-saju-soon>{t('saju.soon')}</p>}

        {/* What leaves the device, said before it does. */}
        {canRead && <section className="rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-[12px] leading-relaxed text-muted-foreground" data-saju-sends>
          <p>{t('saju.sends')}</p>
          <p className="mt-2 text-foreground/80" data-saju-count>
            {t('saju.count', {
              moments: String(count.moments), people: String(count.people), diary: String(count.diary),
              places: String(count.places), me: String(count.me),
            })}
          </p>
        </section>}

        {canRead && (
          <Button className="w-full gap-1.5" disabled={!known || busy} data-saju-read onClick={() => void read()}>
            {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden className="h-4 w-4" />}
            {t('saju.read')} · {admin ? t('life.readings.admin') : price}
          </Button>
        )}
        {busy && <p className="text-center text-[12px] italic text-muted-foreground" role="status">{t('saju.writing')}</p>}

        {reading !== null && reading !== '' && <Reading text={reading} />}
        {/* Keyed by the reading shown, so a different one starts a new card. */}
        {view && !busy && reading && <SajuShare key={readings[shown]?.createdAt ?? 'draft'} view={view} text={reading} name={name} free={free} />}

        {readings.length > 1 && !busy && (
          <section className="flex flex-col gap-1" data-saju-past>
            <h4 className="text-[12px] font-semibold text-muted-foreground">{t('saju.past')}</h4>
            <ul className="flex flex-wrap gap-1">
              {readings.map((r, i) => (
                <li key={r.createdAt} className="flex items-center">
                  <button type="button" aria-pressed={i === shown} data-saju-past-item={i}
                    className={`rounded-l-full border px-2.5 py-1 text-[12px] tabular-nums ${
                      i === shown ? 'border-foreground text-foreground' : 'border-border text-muted-foreground'}`}
                    onClick={() => setShown(i)}>
                    {r.createdAt.slice(0, 10)}
                  </button>
                  <button type="button" aria-label={t('common.delete')} data-saju-past-remove={i}
                    className="grid h-[26px] w-6 place-items-center rounded-r-full border border-l-0 border-border text-muted-foreground hover:bg-accent/20"
                    onClick={() => {
                      setStore((s) => ({ ...s, readings: s.readings.filter((x) => x.createdAt !== r.createdAt) }));
                      setShown(0);
                    }}>
                    <X aria-hidden className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground" data-saju-disclaimer>
          {t('saju.disclaimer')} {t('saju.convention')}
        </p>
      </DialogContent>
    </Dialog>
  );
}
