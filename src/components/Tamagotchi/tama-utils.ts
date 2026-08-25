import type { TKey } from '@/i18n/translations';

/** Mobile LCD "terrarium" size (px). The pet world is confined to this box on
 *  phones — the console LCD is rendered at exactly this size so pet coordinates
 *  map 1:1 into it (see useTamagotchi.setWorld). */
export const MOBILE_LCD = { w: 240, h: 150 };

// ── Transient play/feed effects (floating emojis) ────────────────────────────
export type TamaFxKind = 'heart' | 'yum';
export const TAMA_FX_EVENT = 'tama-fx';
export interface TamaFxDetail { x: number; y: number; kind: TamaFxKind }

/** Little emoji pools for each reaction — TamaFx renders one, floating up. */
export const TAMA_FX_EMOJI: Record<TamaFxKind, string[]> = {
  heart: ['❤️', '💕', '💖', '💨'],
  yum: ['😋', '🍖', '💗'],
};

/** Spawn a floating reaction emoji at a viewport point (TamaFx listens). */
export function fireTamaFx(x: number, y: number, kind: TamaFxKind): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<TamaFxDetail>(TAMA_FX_EVENT, { detail: { x, y, kind } }));
}

/** Localized hatch countdown: 30s · 5m · 2h 10m · 1d 3h. Units come from the
 *  tama.sec/min/hr/day keys, so it reads right in every language and copes with
 *  the longer (up to 24h) delays the later eggs now use. */
export function formatHatch(ms: number, t: (k: TKey, v?: Record<string, string>) => string): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}${t('tama.sec')}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}${t('tama.min')}`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h < 24) return mm ? `${h}${t('tama.hr')} ${mm}${t('tama.min')}` : `${h}${t('tama.hr')}`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return hh ? `${d}${t('tama.day')} ${hh}${t('tama.hr')}` : `${d}${t('tama.day')}`;
}
