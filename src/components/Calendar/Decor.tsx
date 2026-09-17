import { useState } from 'react';
import { Lock, Sticker, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { useDecor } from '@/hooks/useDecor';
import { requestUpgrade } from '@/lib/pro';
import { MAX_STICKERS, STICKER_GROUPS, TINTS, stickerGlyph, type StickerGroup } from '@/lib/decor';
import type { TKey } from '@/i18n/translations';

/**
 * Diary decorating (다꾸) — Pro. Two surfaces: a stamp tray under the calendar
 * toolbar (arm a sticker, then tap days to stamp it), and a section in the day
 * editor (the day's stickers, a picker, and a highlighter). Decor that is
 * already stored is always SHOWN; only changing it needs Pro.
 */

const GROUP_LABEL: Record<StickerGroup['id'], TKey> = {
  mood: 'decor.groupMood',
  weather: 'decor.groupWeather',
  life: 'decor.groupLife',
  moment: 'decor.groupMoment',
};

const usePro = () => useAuth().plan === 'pro';

/** The sticker picker, grouped. `picked` is shown pressed. */
function Picker({ picked, onPick }: { picked?: string | null; onPick: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5" data-sticker-picker>
      {STICKER_GROUPS.map((g) => (
        <div key={g.id} className="flex flex-wrap items-center gap-0.5">
          <span className="w-10 shrink-0 text-[10px] text-muted-foreground">{t(GROUP_LABEL[g.id])}</span>
          {g.items.map((s) => (
            <button
              key={s.id}
              type="button"
              data-sticker={s.id}
              aria-pressed={picked === s.id}
              aria-label={s.id}
              onClick={() => onPick(s.id)}
              className={`grid h-7 w-7 place-items-center rounded-md text-base leading-none transition-colors hover:bg-accent/15 ${
                picked === s.id ? 'bg-primary/15 ring-2 ring-primary' : ''
              }`}
            >
              {s.glyph}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Toolbar button: opens the stamp tray, or the Pro offer. */
export function StickerButton({ open, armed, onToggle }: { open: boolean; armed: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const pro = usePro();
  return (
    <button
      type="button"
      data-sticker-tray-toggle
      aria-pressed={open}
      onClick={pro ? onToggle : requestUpgrade}
      title={t('decor.stickers')}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors hover:bg-accent/10 ${
        open || armed ? 'border-primary text-foreground' : 'border-border text-muted-foreground'
      }`}
    >
      <Sticker className="h-3.5 w-3.5" />
      {t('decor.stickers')}
      {!pro && <Lock className="h-3 w-3" aria-hidden />}
    </button>
  );
}

/** The stamp tray: arm a sticker, then every day tapped gets it. */
export function StickerTray({ armed, onArm, onClose }: {
  armed: string | null; onArm: (id: string | null) => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-2" data-sticker-tray>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[11px] text-muted-foreground">
          {armed ? t('decor.trayArmed', { glyph: stickerGlyph(armed) ?? '' }) : t('decor.trayHint')}
        </span>
        <button type="button" onClick={onClose} aria-label={t('common.close')} data-sticker-tray-close
          className="grid h-6 w-6 place-items-center rounded hover:bg-black/10">
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
      <Picker picked={armed} onPick={(id) => onArm(armed === id ? null : id)} />
    </div>
  );
}

/** The day editor's 다꾸 section. */
export function DayDecorEditor({ day }: { day: string }) {
  const { t } = useTranslation();
  const pro = usePro();
  const { dayDecor, addSticker, removeSticker, setTint } = useDecor();
  const [picking, setPicking] = useState(false);
  const deco = dayDecor(day);
  const stickers = deco.s ?? [];

  if (!pro) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-2" data-decor-locked>
        <Lock className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1 text-xs text-muted-foreground">{t('decor.proBody')}</span>
        <Button size="sm" variant="outline" onClick={requestUpgrade}>{t('billing.upgrade')}</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-decor-editor>
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-muted-foreground">{t('decor.title')}</span>
        {stickers.map((id, i) => (
          <button key={`${id}-${i}`} type="button" data-day-sticker={id}
            onClick={() => removeSticker(day, i)} title={t('decor.remove')} aria-label={t('decor.remove')}
            className="group relative grid h-7 w-7 place-items-center rounded-md text-base leading-none hover:bg-accent/15">
            {stickerGlyph(id)}
            <X className="absolute -right-0.5 -top-0.5 hidden h-3 w-3 rounded-full bg-foreground text-background group-hover:block" />
          </button>
        ))}
        {stickers.length < MAX_STICKERS ? (
          <button type="button" data-decor-add onClick={() => setPicking((v) => !v)} aria-pressed={picking}
            className="rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent/10">
            + {t('decor.addSticker')}
          </button>
        ) : (
          <span className="text-[10px] text-muted-foreground">{t('decor.full', { n: String(MAX_STICKERS) })}</span>
        )}
      </div>
      {picking && stickers.length < MAX_STICKERS && <Picker onPick={(id) => addSticker(day, id)} />}
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">{t('decor.highlight')}</span>
        <button type="button" data-tint="none" aria-pressed={!deco.t} onClick={() => setTint(day, null)}
          aria-label={t('decor.none')} title={t('decor.none')}
          className="grid h-5 w-5 place-items-center rounded-full border border-border text-[10px] text-muted-foreground">
          ∅
        </button>
        {TINTS.map((c) => (
          <button key={c} type="button" data-tint={c} aria-pressed={deco.t === c} aria-label={c}
            onClick={() => setTint(day, c)}
            className="h-5 w-5 rounded-full border border-black/15"
            style={{ backgroundColor: c, outline: deco.t === c ? '2px solid hsl(var(--primary))' : 'none', outlineOffset: '1px' }} />
        ))}
      </div>
    </div>
  );
}
