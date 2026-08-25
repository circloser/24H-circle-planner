import { Creature } from './Creature';
import { PoopArt } from './TamagotchiArt';
import { TamagotchiDevice } from './TamagotchiDevice';
import { TamaFx } from './TamaFx';
import { useTamagotchi } from '@/hooks/useTamagotchi';
import { useTranslation } from '@/hooks/usePreferences';

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
export function TamagotchiLayer() {
  const { on, menuOpen, pets, poops, toggleMenu, removePoop, selectedId } = useTamagotchi();
  const { t } = useTranslation();

  return (
    <>
      <style>{CSS}</style>

      {/* FAB — bottom-left, immediately right of the clock-tools FAB (left-5).
          Opens/closes the console popup; roaming pets keep going underneath. */}
      <button
        type="button"
        onClick={toggleMenu}
        aria-pressed={menuOpen}
        title={t('tama.title')}
        aria-label={t('tama.menu')}
        className="fixed bottom-5 left-[76px] z-30 grid h-12 w-12 place-items-center rounded-full shadow-lg transition-transform hover:scale-105 border"
        style={{
          background: menuOpen ? 'hsl(var(--primary))' : 'hsl(var(--surface))',
          color: menuOpen ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
          borderColor: 'hsl(var(--border))',
          fontSize: 22, lineHeight: 1,
        }}
      >
        🐣
      </button>

      {/* Roaming pets + poops — persist across the WHOLE window whenever the
          feature is on, independent of whether the console popup is open. */}
      {on && (
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
      {menuOpen && <TamagotchiDevice />}
    </>
  );
}
