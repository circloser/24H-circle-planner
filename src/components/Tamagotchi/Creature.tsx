import { useRef, useState, type CSSProperties } from 'react';
import { PetArt } from './TamagotchiArt';
import { formatHatch, fireTamaFx } from './tama-utils';
import { useTamagotchi, type Pet } from '@/hooks/useTamagotchi';
import { useTranslation } from '@/hooks/usePreferences';

const SIZE: Record<string, number> = { egg: 46, amoeba: 40, baby: 54, adult: 40, dead: 52 };

/** State glyph bubble shown above the creature. Hygiene is shared across pets. */
function stateGlyph(p: Pet, hygiene: number): string | null {
  if (p.phase === 'dead') return '💀';
  if (p.energy < 20) return '⚡'; // exhausted → auto-napping / recharging
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
  const [flinging, setFlinging] = useState(false); // brief snappy transition after a throw/drop
  // Track drag + recent pointer velocity (px/ms) so a flick "throws" the pet.
  const drag = useRef<{ ox: number; oy: number; moved: boolean; lx: number; ly: number; lt: number; vx: number; vy: number } | null>(null);

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
    drag.current = { ox: e.clientX - pet.x, oy: e.clientY - pet.y, moved: false, lx: e.clientX, ly: e.clientY, lt: performance.now(), vx: 0, vy: 0 };
    setDragPos({ x: pet.x, y: pet.y });
    setDragging(pet.id, true);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const nx = e.clientX - drag.current.ox;
    const ny = e.clientY - drag.current.oy;
    if (Math.abs(e.clientX - (drag.current.ox + pet.x)) > 4 || Math.abs(e.clientY - (drag.current.oy + pet.y)) > 4) drag.current.moved = true;
    // Recent pointer velocity (px/ms), lightly smoothed — drives the throw.
    const now = performance.now();
    const dt = now - drag.current.lt;
    if (dt > 0) {
      const ivx = (e.clientX - drag.current.lx) / dt;
      const ivy = (e.clientY - drag.current.ly) / dt;
      drag.current.vx = drag.current.vx * 0.4 + ivx * 0.6;
      drag.current.vy = drag.current.vy * 0.4 + ivy * 0.6;
      drag.current.lx = e.clientX; drag.current.ly = e.clientY; drag.current.lt = now;
    }
    setDragPos({ x: nx, y: ny });
  }
  function onPointerUp() {
    if (!drag.current) return;
    const end = dragPos ?? { x: pet.x, y: pet.y };
    const { moved, vx, vy } = drag.current;
    drag.current = null;
    setDragging(pet.id, false);

    if (moved) {
      // A flick throws the pet ~100px along the flick direction; a slow release
      // just lets it drop ~30px. Land clamped inside the window, with a snappy
      // fling transition + a little settle bounce.
      const speed = Math.hypot(vx, vy); // px/ms
      let tx = end.x, ty = end.y;
      if (speed > 0.35) {
        tx = end.x + (vx / speed) * 100;
        ty = end.y + (vy / speed) * 100;
      } else {
        ty = end.y + 30; // gentle drop
      }
      const w = window.innerWidth, h = window.innerHeight;
      tx = Math.max(36, Math.min(w - 36, tx));
      ty = Math.max(70, Math.min(h - 36, ty));
      moveTo(pet.id, tx, ty);
      setDragPos(null);
      setFlinging(true);
      window.setTimeout(() => setFlinging(false), 480);
      setDropping(true);
      window.setTimeout(() => setDropping(false), 460);
      select(pet.id);
      fireTamaFx(tx, ty - size / 2, 'heart');
      return;
    }

    // A plain tap (no drag) is how you play with it: select + play (happiness up,
    // dash off), no-ops on eggs/dead/sleeping/low-energy.
    setDragPos(null);
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
        transition: dragging
          ? 'none'
          : flinging
            ? 'left .48s cubic-bezier(.18,.7,.3,1), top .48s cubic-bezier(.18,.7,.3,1)'
            : 'left 1s linear, top 1s linear',
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
