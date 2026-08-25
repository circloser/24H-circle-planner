import { useEffect, useState } from 'react';
import { Creature } from './Creature';
import { PoopArt } from './TamagotchiArt';
import { TamagotchiDevice } from './TamagotchiDevice';
import { TamaFx } from './TamaFx';
import { MOBILE_LCD } from './tama-utils';
import { useTamagotchi } from '@/hooks/useTamagotchi';
import { useTranslation } from '@/hooks/usePreferences';

const INTRO_KEY = '24h-tama-intro';

const CSS = `
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
`;

/**
 * The tamagotchi overlay: a FAB (just right of the clock-tools FAB) that opens
 * the control console as a POPUP, the roaming line-art creatures + their poops
 * (above all content, but line-only so they barely occlude the whole browser
 * window), and — only while the popup is open — the retro control device. No
 * full-screen catcher, so the app stays fully clickable underneath.
 */
export function TamagotchiLayer({ isMobile = false }: { isMobile?: boolean }) {
  const { on, menuOpen, pets, poops, toggleMenu, removePoop, selectedId, setWorld } = useTamagotchi();
  const { t } = useTranslation();

  // Confine the pet world to the console LCD on mobile (pets live in the box);
  // roam the whole window on desktop.
  useEffect(() => {
    setWorld(isMobile ? MOBILE_LCD : null);
    return () => setWorld(null);
  }, [isMobile, setWorld]);

  // One-time discovery coachmark: new visitors get a hatching egg (seeded in the
  // hook) — this points them at the FAB so the feature isn't missed. Dismissed
  // on first open or explicit close, remembered in localStorage.
  const [introSeen, setIntroSeen] = useState(() => {
    try { return localStorage.getItem(INTRO_KEY) === '1'; } catch { return true; }
  });
  const dismissIntro = () => {
    setIntroSeen(true);
    try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* storage unavailable */ }
  };
  const showIntro = !introSeen && on && pets.length > 0 && !menuOpen;

  const openMenu = () => { if (!introSeen) dismissIntro(); toggleMenu(); };

  return (
    <>
      <style>{CSS}</style>

      {/* FAB — bottom-left, immediately right of the clock-tools FAB (left-5).
          Opens/closes the console popup; roaming pets keep going underneath. */}
      <button
        type="button"
        onClick={openMenu}
        aria-pressed={menuOpen}
        title={t('tama.title')}
        aria-label={t('tama.menu')}
        className={`fixed bottom-5 z-30 grid h-12 w-12 place-items-center rounded-full shadow-lg transition-transform hover:scale-105 border ${isMobile ? 'left-5' : 'left-[76px]'}`}
        style={{
          background: menuOpen ? 'hsl(var(--primary))' : 'hsl(var(--surface))',
          color: menuOpen ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
          borderColor: 'hsl(var(--border))',
          fontSize: 22, lineHeight: 1,
        }}
      >
        🐣
      </button>

      {/* First-visit coachmark pointing at the FAB. */}
      {showIntro && (
        <div
          className="tama-pop"
          style={{
            position: 'fixed', bottom: 74, left: isMobile ? 16 : 72, zIndex: 40, maxWidth: 224,
            display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 14,
            background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))',
            boxShadow: '0 8px 22px rgba(0,0,0,0.24)', fontSize: 12, fontWeight: 600, lineHeight: 1.35,
          }}
        >
          <button type="button" onClick={openMenu} style={{ background: 'transparent', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer', padding: 0, font: 'inherit' }}>
            {t('tama.intro')}
          </button>
          <button type="button" onClick={dismissIntro} aria-label={t('tama.close')} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13, lineHeight: 1, opacity: 0.8, padding: 0, marginTop: -1 }}>✕</button>
        </div>
      )}

      {/* Roaming pets + poops — DESKTOP ONLY: they wander the whole window. On
          mobile the pets live inside the console LCD (see TamagotchiDevice), so
          nothing is drawn over the page here. */}
      {on && !isMobile && (
        <>
          {/* Shared poop pile — any pet drops into it; tap to clean (shared hygiene). */}
          {poops.map((poop) => (
            <button
              key={poop.id}
              type="button"
              title={t('tama.cleanPoop')}
              aria-label={t('tama.cleanPoop')}
              onClick={(e) => { e.stopPropagation(); removePoop(poop.id); }}
              style={{ position: 'fixed', left: poop.x, top: poop.y, transform: 'translate(-50%,-50%)', zIndex: 69, color: '#7c5a3a', pointerEvents: 'auto', cursor: 'pointer', background: 'transparent', border: 'none', padding: 4, lineHeight: 0 }}
            >
              <PoopArt size={18} />
            </button>
          ))}
          {pets.map((p) => (
            <Creature key={p.id} pet={p} selected={p.id === selectedId} />
          ))}
          <TamaFx />
        </>
      )}

      {/* Console — a popup, shown only while the menu is open. */}
      {menuOpen && <TamagotchiDevice isMobile={isMobile} />}
    </>
  );
}
