import { useRef, useState, type CSSProperties } from 'react';
import { PetArt } from './TamagotchiArt';
import { formatHatch, fireTamaFx } from './tama-utils';
import { useTamagotchi, type Pet } from '@/hooks/useTamagotchi';
import { useTranslation } from '@/hooks/usePreferences';

const SIZE: Record<string, number> = { egg: 46, amoeba: 40, baby: 54, adult: 66, dead: 52 };

/** State glyph bubble shown above the creature. Hygiene is shared across pets. */
function stateGlyph(p: Pet, hygiene: number): string | null {
  if (p.phase === 'dead') return '💀';
  if (p.sleeping) return '💤';
  if (hygiene < 20) return '🤒';
  if (p.hunger < 30) return '🍽️';
  return null;
}

export function Creature({ pet, selected }: { pet: Pet; selected: boolean }) {
  const { select, play, moveTo, setDragging, menuOpen, hygiene } = useTamagotchi();
  const { t } = useTranslation();
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [reacting, setReacting] = useState(false); // brief happy wiggle after a play
  const [dropping, setDropping] = useState(false); // little drop-settle when released
  const drag = useRef<{ ox: number; oy: number; moved: boolean } | null>(null);

  // Overfeeding puffs the pet up a little (pet.bloat, eases back over time).
  const size = Math.round((SIZE[pet.phase] ?? 54) * (1 + (pet.bloat ?? 0)));
  const x = dragPos?.x ?? pet.x;
  const y = dragPos?.y ?? pet.y;
  const dragging = dragPos != null;
  const glyph = reacting ? '😄' : stateGlyph(pet, hygiene); // happy face while being played with
  const remaining = pet.phase === 'egg' ? pet.hatchAt - Date.now() : 0;

  // Adults face the way they walk (mirror by horizontal heading) and lean
  // forward for a dynamic, diagonal look. Younger forms stay upright/front-on.
  const faceDir = Math.cos(pet.heading) >= 0 ? 1 : -1;
  const flipStyle: CSSProperties | undefined =
    pet.phase === 'adult'
      ? { transform: `scaleX(${faceDir}) rotate(6deg)`, transition: 'transform .2s ease' }
      : undefined;

  function onPointerDown(e: React.PointerEvent) {
    if (pet.phase === 'dead') { select(pet.id); return; }
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { ox: e.clientX - pet.x, oy: e.clientY - pet.y, moved: false };
    setDragPos({ x: pet.x, y: pet.y });
    setDragging(pet.id, true);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const nx = e.clientX - drag.current.ox;
    const ny = e.clientY - drag.current.oy;
    if (Math.abs(e.clientX - (drag.current.ox + pet.x)) > 4 || Math.abs(e.clientY - (drag.current.oy + pet.y)) > 4) drag.current.moved = true;
    setDragPos({ x: nx, y: ny });
  }
  function onPointerUp() {
    if (!drag.current) return;
    const end = dragPos ?? { x: pet.x, y: pet.y };
    const moved = drag.current.moved;
    if (dragPos) moveTo(pet.id, dragPos.x, dragPos.y);
    setDragging(pet.id, false);
    setDragPos(null);
    drag.current = null;
    // A drag-and-drop gets a little "drop and settle" bounce.
    if (moved) { setDropping(true); window.setTimeout(() => setDropping(false), 420); }
    // Tapping OR dragging a pet is how you play with it (the play button is
    // gone). select() shows it in the console; play() raises happiness, makes it
    // dash off, and no-ops on eggs/dead/sleeping/low-energy.
    select(pet.id);
    if (pet.phase !== 'egg' && pet.phase !== 'dead' && !pet.sleeping) {
      play(pet.id);
      fireTamaFx(end.x, end.y - size / 2, 'heart'); // floating hearts
      setReacting(true);
      window.setTimeout(() => setReacting(false), 700); // brief happy wiggle
    }
  }

  return (
    <div
      className="tama-creature"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        transition: dragging ? 'none' : 'left 1s linear, top 1s linear',
        cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        zIndex: selected ? 71 : 70,
        color: 'hsl(var(--foreground))',
        opacity: pet.sleeping ? 0.55 : pet.phase === 'dead' ? 0.5 : 1,
        pointerEvents: 'auto',
        // The selected-glow only shows while the console popup is open, so a lone
        // roaming pet isn't permanently highlighted.
        filter: selected && menuOpen ? 'drop-shadow(0 0 6px hsl(var(--primary)/0.7))' : 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className={dropping ? 'tama-drop' : undefined} style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
        {glyph && (
          <span style={{ position: 'absolute', top: -18, fontSize: 14, pointerEvents: 'none' }}>{glyph}</span>
        )}
        <div style={flipStyle}>
          <div className={dragging || reacting ? 'tama-wiggle' : pet.sleeping ? '' : 'tama-bob'}>
            <PetArt species={pet.species} phase={pet.phase} size={size} walk={pet.phase === 'adult' && !pet.sleeping} />
          </div>
        </div>
        {pet.phase === 'egg' && (
          <span
            style={{
              position: 'absolute', bottom: -14, fontSize: 10, fontWeight: 700,
              padding: '1px 6px', borderRadius: 999, whiteSpace: 'nowrap',
              background: 'hsl(var(--surface))', color: 'hsl(var(--muted-foreground))',
              border: '1px solid hsl(var(--border))', pointerEvents: 'none',
            }}
          >
            🥚 {formatHatch(remaining, t)}
          </span>
        )}
      </div>
    </div>
  );
}
