import { PetArt } from './TamagotchiArt';
import { MobileLcd } from './MobileLcd';
import { formatHatch, fireTamaFx, MOBILE_LCD } from './tama-utils';
import { useTamagotchi, MAX_PETS, type Pet } from '@/hooks/useTamagotchi';
import { useTranslation } from '@/hooks/usePreferences';

/** One stat as a donut ring (2×2 grid). Hover shows what it means + the value. */
function DonutStat({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  const color = value < 20 ? '#ef4444' : value < 40 ? '#f59e0b' : '#22c55e';
  const R = 15;
  const C = 2 * Math.PI * R;
  const off = C * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div title={`${label} · ${Math.round(value)}%`} style={{ position: 'relative', display: 'grid', placeItems: 'center', cursor: 'help' }}>
      <svg width={38} height={38} viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r={R} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="5" />
        <circle cx="20" cy="20" r={R} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 20 20)" style={{ transition: 'stroke-dashoffset .4s' }} />
      </svg>
      <span style={{ position: 'absolute', fontSize: 13 }}>{emoji}</span>
    </div>
  );
}

function DeviceBtn({ label, title, onClick, disabled }: { label: string; title: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        width: 38, height: 38, borderRadius: 999, fontSize: 17,
        display: 'grid', placeItems: 'center', cursor: disabled ? 'not-allowed' : 'pointer',
        border: '2px solid #b45309', background: disabled ? '#e7d8b0' : '#fde9a9',
        opacity: disabled ? 0.5 : 1, boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.12)',
      }}
    >
      {label}
    </button>
  );
}

export function TamagotchiDevice({ isMobile = false }: { isMobile?: boolean }) {
  const { pets, hygiene, selectedId, on, toggle, closeMenu, select, addEgg, release, feed, toggleSleep } = useTamagotchi();
  const { t } = useTranslation();

  const pet: Pet | undefined = pets.find((p) => p.id === selectedId) ?? pets[0];
  const isCreature = pet && pet.phase !== 'egg' && pet.phase !== 'dead';
  const sleeping = !!pet?.sleeping;
  const hasEgg = pets.some((p) => p.phase === 'egg'); // can't lay a new egg until it hatches

  const onFeed = () => {
    if (!pet) return;
    feed(pet.id);
    fireTamaFx(pet.x, pet.y - 20, 'yum'); // eating reaction floats over the pet
  };

  return (
    <div
      className="tama-pop"
      role="dialog"
      aria-label={t('tama.title')}
      style={{
        position: 'fixed', left: 16, bottom: 84, zIndex: 40,
        width: isMobile ? MOBILE_LCD.w + 24 : 216,
        borderRadius: 26, padding: 12,
        background: '#ffffff',
        border: '3px solid #e5e7eb', boxShadow: '0 10px 26px rgba(0,0,0,0.22)',
        fontFamily: "'Pretendard',system-ui,sans-serif",
      }}
    >
      {/* Header: title + power (roam on/off) + close */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#9d174d' }}>🐣 {t('tama.title')}</span>
        <button
          type="button"
          onClick={toggle}
          title={t(on ? 'tama.turnOff' : 'tama.turnOn')}
          aria-label={t(on ? 'tama.turnOff' : 'tama.turnOn')}
          style={{ marginLeft: 'auto', width: 24, height: 24, borderRadius: 999, cursor: 'pointer', fontSize: 12, lineHeight: 1, fontWeight: 800, border: '2px solid #e58aa8', background: on ? '#fff0f5' : '#be185d', color: on ? '#be185d' : '#fff' }}
        >
          {on ? '⏸' : '▶'}
        </button>
        <button
          type="button"
          onClick={closeMenu}
          title={t('tama.close')}
          aria-label={t('tama.close')}
          style={{ width: 24, height: 24, borderRadius: 999, cursor: 'pointer', fontSize: 12, lineHeight: 1, fontWeight: 800, border: '2px solid #e58aa8', background: '#fff0f5', color: '#be185d' }}
        >
          ✕
        </button>
      </div>

      {/* Pet tabs + new egg — wraps to multiple rows for up to 6 pets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, rowGap: 6, marginBottom: 8 }}>
        {pets.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => select(p.id)}
            title={t('tama.pet', { n: String(i + 1) })}
            style={{
              width: 22, height: 22, borderRadius: 999, fontSize: 11, cursor: 'pointer',
              border: p.id === pet?.id ? '2px solid #be185d' : '2px solid #f0a5c0',
              background: p.id === pet?.id ? '#fff' : '#ffe3ee', color: '#be185d', fontWeight: 700,
            }}
          >
            {p.phase === 'egg' ? '🥚' : p.phase === 'dead' ? '💀' : i + 1}
          </button>
        ))}
        {pets.length < MAX_PETS && (
          <button type="button" onClick={addEgg} disabled={hasEgg}
            title={t(hasEgg ? 'tama.waitHatch' : 'tama.newEgg')} aria-label={t(hasEgg ? 'tama.waitHatch' : 'tama.newEgg')}
            style={{ width: 22, height: 22, borderRadius: 999, border: '2px dashed #be185d', background: 'transparent', color: '#be185d', fontWeight: 800, cursor: hasEgg ? 'not-allowed' : 'pointer', opacity: hasEgg ? 0.4 : 1, lineHeight: 1 }}>
            +
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#9d174d', fontWeight: 700 }}>{pets.length}/{MAX_PETS}</span>
      </div>

      {/* LCD screen — on mobile it becomes a little terrarium the pets roam
          inside (they don't wander the page); on desktop it shows the selected
          pet's portrait (they roam the whole window instead). */}
      {isMobile && <MobileLcd pets={pets} hygiene={hygiene} sleeping={sleeping} />}
      {!isMobile && (
      <div style={{
        borderRadius: 16, padding: 10, minHeight: 92, display: 'grid', placeItems: 'center',
        background: sleeping ? '#20304a' : '#eceef1', border: '3px solid #cbd5e1',
        color: sleeping ? '#8fb0e8' : '#374151', position: 'relative', transition: 'background .4s',
      }}>
        {!pet ? (
          <div style={{ textAlign: 'center', fontSize: 12 }}>
            <div style={{ fontSize: 26 }}>🥚</div>{t('tama.emptyHint')}
          </div>
        ) : pet.phase === 'egg' ? (
          <div style={{ textAlign: 'center' }}>
            <PetArt species={pet.species} phase="egg" size={54} />
            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>{t('tama.hatchIn', { t: formatHatch(pet.hatchAt - Date.now(), t) })}</div>
          </div>
        ) : pet.phase === 'dead' ? (
          <div style={{ textAlign: 'center', fontSize: 12 }}>
            <PetArt species={pet.species} phase="dead" size={48} />
            <div style={{ marginTop: 2 }}>{t('tama.died')}</div>
          </div>
        ) : (
          <div className={sleeping ? '' : 'tama-bob'} style={{ display: 'grid', placeItems: 'center' }}>
            <PetArt species={pet.species} phase={pet.phase} size={60} />
            {sleeping && <span style={{ position: 'absolute', top: 8, right: 12, fontSize: 16 }}>💤</span>}
          </div>
        )}
      </div>
      )}

      {/* Stats — 2×2 donut rings; hover explains each + shows the value. Happiness
          & hygiene are raised by tapping the pet / its poop directly. */}
      {pet && pet.phase !== 'egg' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 2, marginTop: 8, justifyItems: 'center' }}>
          <DonutStat emoji="🍖" value={pet.hunger} label={t('tama.statHunger')} />
          <DonutStat emoji="😊" value={pet.happiness} label={t('tama.statHappiness')} />
          <DonutStat emoji="🧼" value={hygiene} label={t('tama.statHygiene')} />
          <DonutStat emoji="⚡" value={pet.energy} label={t('tama.statEnergy')} />
        </div>
      )}

      {/* Actions — feed + sleep (play/clean moved onto the pet & its poop). */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 10 }}>
        <DeviceBtn label="🍽️" title={t('tama.feed')} onClick={onFeed} disabled={!isCreature || sleeping} />
        <DeviceBtn label={sleeping ? '☀️' : '😴'} title={t(sleeping ? 'tama.wake' : 'tama.sleep')} onClick={() => pet && toggleSleep(pet.id)} disabled={!isCreature && pet?.phase !== 'baby' && pet?.phase !== 'adult'} />
      </div>

      {/* How-to hint for the buttonless play/clean. */}
      <p style={{ margin: '8px 0 0', fontSize: 10, lineHeight: 1.35, textAlign: 'center', color: '#9d174d' }}>{t('tama.hint')}</p>

      {/* Release */}
      {pet && (
        <button
          type="button"
          onClick={() => { if (confirm(t(pet.phase === 'dead' ? 'tama.sendOffConfirm' : 'tama.releaseConfirm'))) release(pet.id); }}
          style={{ width: '100%', marginTop: 8, padding: '5px 0', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '2px solid #e58aa8', background: '#fff0f5', color: '#be185d' }}
        >
          👋 {t(pet.phase === 'dead' ? 'tama.sendOff' : 'tama.release')}
        </button>
      )}
    </div>
  );
}
