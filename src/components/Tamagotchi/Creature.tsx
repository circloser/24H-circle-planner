import { useRef, useState } from 'react';
import { PetArt } from './TamagotchiArt';
import { formatHatch } from './tama-utils';
import { useTamagotchi, type Pet } from '@/hooks/useTamagotchi';
import { useTranslation } from '@/hooks/usePreferences';

const SIZE: Record<string, number> = { egg: 46, amoeba: 40, baby: 54, adult: 66, dead: 52 };

/** State glyph bubble shown above the creature. */
function stateGlyph(p: Pet): string | null {
  if (p.phase === 'dead') return '💀';
  if (p.sleeping) return '💤';
  if (p.hygiene < 20) return '🤒';
  if (p.hunger < 30) return '🍽️';
  return null;
}

export function Creature({ pet, selected }: { pet: Pet; selected: boolean }) {
  const { select, play, moveTo, setDragging, menuOpen } = useTamagotchi();
  const { t } = useTranslation();
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ ox: number; oy: number; moved: boolean } | null>(null);

  const size = SIZE[pet.phase] ?? 54;
  const x = dragPos?.x ?? pet.x;
  const y = dragPos?.y ?? pet.y;
  const dragging = dragPos != null;
  const glyph = stateGlyph(pet);
  const remaining = pet.phase === 'egg' ? pet.hatchAt - Date.now() : 0;

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
    if (dragPos) moveTo(pet.id, dragPos.x, dragPos.y);
    setDragging(pet.id, false);
    setDragPos(null);
    drag.current = null;
    // Tapping OR dragging a pet is how you play with it now (the play button is
    // gone). select() also shows it in the console; play() raises happiness and
    // no-ops on eggs/dead/sleeping/low-energy.
    select(pet.id);
    play(pet.id);
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
      <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
        {glyph && (
          <span style={{ position: 'absolute', top: -18, fontSize: 14, pointerEvents: 'none' }}>{glyph}</span>
        )}
        <div className={dragging ? 'tama-wiggle' : pet.sleeping ? '' : 'tama-bob'}>
          <PetArt species={pet.species} phase={pet.phase} size={size} />
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
