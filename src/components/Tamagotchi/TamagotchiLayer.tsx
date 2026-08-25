import { Creature } from './Creature';
import { PoopArt } from './TamagotchiArt';
import { TamagotchiDevice } from './TamagotchiDevice';
import { useTamagotchi } from '@/hooks/useTamagotchi';

const CSS = `
@keyframes tama-bob { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-3px) } }
@keyframes tama-wiggle { 0%,100%{ transform: rotate(-9deg) } 50%{ transform: rotate(9deg) } }
@keyframes tama-pop { from { opacity:0; transform: translateY(10px) scale(.96) } to { opacity:1; transform: none } }
.tama-bob { animation: tama-bob 1.6s ease-in-out infinite; }
.tama-wiggle { animation: tama-wiggle .12s linear infinite; }
.tama-pop { animation: tama-pop .18s ease-out; }
`;

/**
 * The tamagotchi overlay: a FAB (just right of the clock-tools FAB) that opens
 * the control console as a POPUP, the roaming line-art creatures + their poops
 * (above all content, but line-only so they barely occlude the whole browser
 * window), and — only while the popup is open — the retro control device. No
 * full-screen catcher, so the app stays fully clickable underneath.
 */
export function TamagotchiLayer() {
  const { on, menuOpen, pets, toggleMenu, selectedId } = useTamagotchi();

  return (
    <>
      <style>{CSS}</style>

      {/* FAB — bottom-left, immediately right of the clock-tools FAB (left-5).
          Opens/closes the console popup; roaming pets keep going underneath. */}
      <button
        type="button"
        onClick={toggleMenu}
        aria-pressed={menuOpen}
        title="다마고치"
        aria-label="다마고치 메뉴"
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
          {pets.flatMap((p) =>
            p.poops.map((poop) => (
              <div
                key={poop.id}
                style={{ position: 'fixed', left: poop.x, top: poop.y, transform: 'translate(-50%,-50%)', zIndex: 69, color: '#7c5a3a', pointerEvents: 'none' }}
              >
                <PoopArt size={18} />
              </div>
            )),
          )}
          {pets.map((p) => (
            <Creature key={p.id} pet={p} selected={p.id === selectedId} />
          ))}
        </>
      )}

      {/* Console — a popup, shown only while the menu is open. */}
      {menuOpen && <TamagotchiDevice />}
    </>
  );
}
