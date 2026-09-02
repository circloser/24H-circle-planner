import type { TKey } from '@/i18n/translations';

/** Mobile LCD "terrarium" size (px). The pet world is confined to this box on
 *  phones — the console LCD is rendered at exactly this size so pet coordinates
 *  map 1:1 into it (see useTamagotchi.setWorld). */
export const MOBILE_LCD = { w: 240, h: 150 };

/** Keyframes every pet drawing needs (bob, wiggle, walk cycle, reactions).
 *  Both mount points inject it — the desktop layer and the mobile section — so
 *  the pets animate wherever they are shown. */
export const TAMA_CSS = `
@keyframes tama-bob { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-3px) } }
@keyframes tama-wiggle { 0%,100%{ transform: rotate(-9deg) } 50%{ transform: rotate(9deg) } }
@keyframes tama-pop { from { opacity:0; transform: translateY(10px) scale(.96) } to { opacity:1; transform: none } }
@keyframes tama-fx { 0% { opacity:0; transform: translate(-50%,-20%) scale(.6) } 25% { opacity:1; transform: translate(-50%,-70%) scale(1.15) } 100% { opacity:0; transform: translate(-50%,-170%) scale(1) } }
@keyframes tama-drop { 0% { transform: translateY(-7px) } 55% { transform: translateY(3px) } 78% { transform: translateY(-1px) } 100% { transform: translateY(0) } }
@keyframes tama-legA { 0%,100% { transform: rotate(16deg) } 50% { transform: rotate(-16deg) } }
@keyframes tama-legB { 0%,100% { transform: rotate(-16deg) } 50% { transform: rotate(16deg) } }
@keyframes tama-armA { 0%,100% { transform: rotate(-20deg) } 50% { transform: rotate(20deg) } }
@keyframes tama-armB { 0%,100% { transform: rotate(20deg) } 50% { transform: rotate(-20deg) } }
@keyframes tama-tailw { 0%,100% { transform: rotate(-9deg) } 50% { transform: rotate(11deg) } }
.tama-bob { animation: tama-bob 1.6s ease-in-out infinite; }
.tama-wiggle { animation: tama-wiggle .12s linear infinite; }
.tama-pop { animation: tama-pop .18s ease-out; }
.tama-fx { animation: tama-fx .9s ease-out forwards; }
.tama-drop { animation: tama-drop .42s ease-out; }
.tama-legL { animation: tama-legA .5s ease-in-out infinite; }
.tama-legR { animation: tama-legB .5s ease-in-out infinite; }
.tama-armL { animation: tama-armB .5s ease-in-out infinite; }
.tama-armR { animation: tama-armA .5s ease-in-out infinite; }
.tama-tail { animation: tama-tailw .6s ease-in-out infinite; }
/* Calm mode for the mobile terrarium: the pets drift a couple of px per second
   in there, so desktop-paced limbs would look like running in place. */
.tama-slow .tama-bob { animation-duration: 3s; }
.tama-slow .tama-legL, .tama-slow .tama-legR,
.tama-slow .tama-armL, .tama-slow .tama-armR { animation-duration: 1.6s; }
.tama-slow .tama-tail { animation-duration: 1.9s; }
`;

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
