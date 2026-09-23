import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Sparkles, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/usePreferences';
import { usePersistedState } from '@/hooks/usePersistedState';
import { track } from '@/lib/track';
import { isFullDate } from '@/lib/life';
import { memoirBlocks } from '@/lib/life-memoir';
import { gatherRecords } from '@/lib/ai-records';
import { ELEMENTS, ELEMENT_KO, pillarHanja, pillarKo, stemElement, type Element } from '@/lib/saju';
import {
  MAX_SAJU_READINGS, SAJU_KEY, buildSajuRequest, sajuCodec, viewChart, writeSaju,
} from '@/lib/saju-reading';
import type { TKey } from '@/i18n/translations';

/** The five elements in the muted colours of the rest of the app. */
const ELEMENT_COLOR: Record<Element, string> = {
  wood: '#5f8a5b', fire: '#b4544a', earth: '#b08a4a', metal: '#8a8f99', water: '#4d6f93',
};

/** The written reading, as chapters and paragraphs. */
function Reading({ text }: { text: string }) {
  return (
    <article className="life-serif text-[15px] leading-[1.85] text-foreground" data-saju-text>
      {memoirBlocks(text).map((b, i) => (
        b.kind === 'h'
          ? <h4 key={i} className="mt-6 text-[16px] font-bold first:mt-0">{b.text}</h4>
          : <p key={i} className="mt-3 whitespace-pre-wrap">{b.text}</p>
      ))}
    </article>
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
export function SajuDialog({ open, onOpenChange, birthDate, admin, price }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  birthDate: string;
  /** An admin trying it out: no till. */
  admin: boolean;
  price: string;
}) {
  const { t, lang } = useTranslation();
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
    } catch {
      toast.error(t('saju.failed'));
    } finally {
      writing.current = false;
      setDraft(null);
    }
  };
  const busy = draft !== null;
  const most = view ? Math.max(1, ...Object.values(view.elements)) : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] max-w-xl flex-col gap-4 overflow-y-auto" data-saju-dialog>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('saju.title')}
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-normal text-muted-foreground">{t('saju.badge')}</span>
          </DialogTitle>
          <DialogDescription>{t('saju.card')}</DialogDescription>
        </DialogHeader>

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
                      <span className="text-[11px] text-muted-foreground">{c.stemGod ?? '일간'}</span>
                      <span className="text-2xl font-semibold" style={{ color: ELEMENT_COLOR[stemElement(c.pillar.stem)] }}>
                        {pillarHanja(c.pillar)[0]}
                      </span>
                      <span className="text-2xl font-semibold text-foreground">{pillarHanja(c.pillar)[1]}</span>
                      <span className="text-[12px] text-muted-foreground">{pillarKo(c.pillar)}</span>
                      <span className="text-[11px] text-muted-foreground">{c.branchGod}</span>
                    </>
                  ) : (
                    <span className="py-6 text-[12px] text-muted-foreground">{t('saju.timeUnknown')}</span>
                  )}
                </div>
              ))}
            </section>

            <section className="flex flex-col gap-1.5" data-saju-elements>
              <h4 className="text-[12px] font-semibold text-muted-foreground">{t('saju.elements')}</h4>
              {ELEMENTS.map((e) => (
                <div key={e} className="flex items-center gap-2 text-[12px]">
                  <span className="w-12 shrink-0 text-muted-foreground">{ELEMENT_KO[e]}</span>
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

        {/* What leaves the device, said before it does. */}
        <section className="rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-[12px] leading-relaxed text-muted-foreground" data-saju-sends>
          <p>{t('saju.sends')}</p>
          <p className="mt-2 text-foreground/80" data-saju-count>
            {t('saju.count', {
              moments: String(count.moments), people: String(count.people), diary: String(count.diary),
              places: String(count.places), me: String(count.me),
            })}
          </p>
        </section>

        <Button className="w-full gap-1.5" disabled={!known || busy} data-saju-read onClick={() => void read()}>
          {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden className="h-4 w-4" />}
          {t('saju.read')} · {admin ? t('life.readings.admin') : price}
        </Button>
        {busy && <p className="text-center text-[12px] italic text-muted-foreground" role="status">{t('saju.writing')}</p>}

        {reading !== null && reading !== '' && <Reading text={reading} />}

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
