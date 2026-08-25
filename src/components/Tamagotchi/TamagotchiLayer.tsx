import { Creature } from './Creature';
import { PoopArt } from './TamagotchiArt';
import { TamagotchiDevice } from './TamagotchiDevice';
import { useTamagotchi } from '@/hooks/useTamagotchi';

const CSS = `
@keyframes tama-bob { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-3px) } }
@keyframes tama-wiggle { 0%,100%{ transform: rotate(-9deg) } 50%{ transform: rotate(9deg) } }
.tama-bob { animation: tama-bob 1.6s ease-in-out infinite; }
.tama-wiggle { animation: tama-wiggle .12s linear infinite; }
`;

/**
 * The tamagotchi overlay: a toggle FAB (just right of the clock-tools FAB), the
 * roaming line-art creatures + their poops (above all content, but line-only so
 * they barely occlude), and the retro control device. No full-screen catcher —
 * only the creatures / device / toggle capture pointer events, so the app stays
 * fully clickable underneath.
 */
export function TamagotchiLayer() {
  const { on, pets, toggle, selectedId } = useTamagotchi();

  return (
    <>
      <style>{CSS}</style>

      {/* Toggle — bottom-left, immediately right of the clock-tools FAB (left-5). */}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={on}
        title={on ? '다마고치 끄기' : '다마고치 켜기'}
        aria-label={on ? '다마고치 끄기' : '다마고치 켜기'}
        className="fixed bottom-5 left-[76px] z-30 grid h-12 w-12 place-items-center rounded-full shadow-lg transition-transform hover:scale-105 border"
        style={{
          background: on ? 'hsl(var(--primary))' : 'hsl(var(--surface))',
          color: on ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
          borderColor: 'hsl(var(--border))',
          fontSize: 22, lineHeight: 1,
        }}
      >
        🐣
      </button>

      {on && (
        <>
          {/* Poops — decorative, below creatures, non-interactive. */}
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

          {/* Creatures — above everything (z 70+), line-only so occlusion is minimal. */}
          {pets.map((p) => (
            <Creature key={p.id} pet={p} selected={p.id === selectedId} />
          ))}

          <TamagotchiDevice />
        </>
      )}
    </>
  );
}
