import { useState, type CSSProperties } from 'react';
import { PetArt } from './TamagotchiArt';
import { formatHatch } from './tama-utils';
import { MOBILE_LCD } from './tama-utils';
import { useTamagotchi, type Pet } from '@/hooks/useTamagotchi';
import { useTranslation } from '@/hooks/usePreferences';

const SIZE: Record<string, number> = { egg: 34, amoeba: 30, baby: 40, adult: 46, dead: 38 };

/** State glyph above the pet (shared hygiene). Mirrors Creature.stateGlyph. */
function glyphFor(p: Pet, hygiene: number): string | null {
  if (p.phase === 'dead') return '💀';
  if (p.energy < 20) return '⚡';
  if (p.sleeping) return '💤';
  if (hygiene < 20) return '🤒';
  if (p.hunger < 30) return '🍽️';
  return null;
}

/** One pet inside the mobile LCD — positioned absolutely in the box, clamped so
 *  it's always visible, tap to play. No drag (the box is small). */
function LcdPet({ pet, hygiene }: { pet: Pet; hygiene: number }) {
  const { select, play } = useTamagotchi();
  const { t } = useTranslation();
  const [reacting, setReacting] = useState(false);

  const size = Math.round((SIZE[pet.phase] ?? 40) * (1 + (pet.bloat ?? 0)));
  const half = size / 2;
  // Clamp render coords into the box so a pet (or a just-seeded egg) is never
  // parked off-screen, independent of its stored world coordinate.
  const x = Math.max(half, Math.min(MOBILE_LCD.w - half, pet.x));
  const y = Math.max(half, Math.min(MOBILE_LCD.h - half, pet.y));
  const glyph = reacting ? '😄' : glyphFor(pet, hygiene);

  const faceDir = Math.cos(pet.heading) >= 0 ? 1 : -1;
  const flip: CSSProperties | undefined =
    pet.phase === 'adult' ? { transform: `scaleX(${faceDir}) rotate(6deg)`, transition: 'transform .2s ease' } : undefined;

  function onTap() {
    select(pet.id);
    if (pet.phase !== 'egg' && pet.phase !== 'dead' && !pet.sleeping) {
      play(pet.id);
      setReacting(true);
      window.setTimeout(() => setReacting(false), 700);
    }
  }

  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={t('tama.pet', { n: '' })}
      style={{
        position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)',
        transition: 'left .8s linear, top .8s linear', background: 'transparent', border: 'none',
        padding: 0, cursor: 'pointer', touchAction: 'manipulation', lineHeight: 0,
        color: 'inherit', opacity: pet.sleeping ? 0.6 : pet.phase === 'dead' ? 0.5 : 1, zIndex: 2,
      }}
    >
      <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
        {glyph && <span style={{ position: 'absolute', top: -14, fontSize: 12, pointerEvents: 'none' }}>{glyph}</span>}
        <div style={flip}>
          <div className={reacting ? 'tama-wiggle' : pet.sleeping ? '' : 'tama-bob'}>
            <PetArt species={pet.species} phase={pet.phase} size={size} walk={pet.phase === 'adult' && !pet.sleeping} />
          </div>
        </div>
        {pet.phase === 'egg' && (
          <span style={{ position: 'absolute', bottom: -12, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            {formatHatch(pet.hatchAt - Date.now(), t)}
          </span>
        )}
      </div>
    </button>
  );
}

/** The mobile "terrarium": the console LCD becomes a little play area the pets
 *  roam inside (world confined to MOBILE_LCD via setWorld). Sized exactly to
 *  MOBILE_LCD so stored pet coords map 1:1. */
export function MobileLcd({ pets, hygiene, sleeping }: { pets: Pet[]; hygiene: number; sleeping: boolean }) {
  const { t } = useTranslation();
  const visible = pets.filter((p) => p.phase !== 'dead');
  return (
    <div
      style={{
        position: 'relative', width: MOBILE_LCD.w, height: MOBILE_LCD.h, borderRadius: 14,
        overflow: 'hidden', background: sleeping ? '#20304a' : '#eceef1', border: '3px solid #cbd5e1',
        color: sleeping ? '#8fb0e8' : '#374151', transition: 'background .4s',
      }}
    >
      {visible.length === 0 ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: 12 }}>
          <span><span style={{ fontSize: 26 }}>🥚</span><br />{t('tama.emptyHint')}</span>
        </div>
      ) : (
        pets.map((p) => (p.phase === 'dead' ? null : <LcdPet key={p.id} pet={p} hygiene={hygiene} />))
      )}
    </div>
  );
}
