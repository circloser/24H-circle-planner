import { PetArt } from './TamagotchiArt';
import { useTamagotchi, MAX_PETS, type Pet } from '@/hooks/useTamagotchi';

function hatchLabel(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}분` : `${s}초`;
}

function Stat({ emoji, value }: { emoji: string; value: number }) {
  const color = value < 20 ? '#ef4444' : value < 40 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 11, width: 16, textAlign: 'center' }}>{emoji}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(value)}%`, height: '100%', background: color, transition: 'width .4s' }} />
      </div>
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

export function TamagotchiDevice() {
  const { pets, selectedId, on, select, addEgg, release, feed, play, clean, toggleSleep } = useTamagotchi();
  if (!on) return null;

  const pet: Pet | undefined = pets.find((p) => p.id === selectedId) ?? pets[0];
  const isCreature = pet && pet.phase !== 'egg' && pet.phase !== 'dead';
  const sleeping = !!pet?.sleeping;

  return (
    <div
      style={{
        position: 'fixed', left: 20, bottom: 132, zIndex: 80, width: 216,
        borderRadius: 26, padding: 12,
        background: 'linear-gradient(160deg,#ffd7e6,#ffc6a8)',
        border: '3px solid #e58aa8', boxShadow: '0 10px 26px rgba(0,0,0,0.22)',
        fontFamily: "'Pretendard',system-ui,sans-serif",
      }}
    >
      {/* Pet tabs + new egg */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {pets.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => select(p.id)}
            title={`${i + 1}번`}
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
          <button type="button" onClick={addEgg} title="새 알 낳기" aria-label="새 알 낳기"
            style={{ width: 22, height: 22, borderRadius: 999, border: '2px dashed #be185d', background: 'transparent', color: '#be185d', fontWeight: 800, cursor: 'pointer', lineHeight: 1 }}>
            +
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#9d174d', fontWeight: 700 }}>{pets.length}/{MAX_PETS}</span>
      </div>

      {/* LCD screen */}
      <div style={{
        borderRadius: 16, padding: 10, minHeight: 92, display: 'grid', placeItems: 'center',
        background: sleeping ? '#20304a' : '#c7e7c9', border: '3px solid #7a5a2e',
        color: sleeping ? '#8fb0e8' : '#1f3a24', position: 'relative', transition: 'background .4s',
      }}>
        {!pet ? (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#3a5a3e' }}>
            <div style={{ fontSize: 26 }}>🥚</div>아래 <b>+</b> 로 알을 낳아<br />친구를 키워보세요
          </div>
        ) : pet.phase === 'egg' ? (
          <div style={{ textAlign: 'center' }}>
            <PetArt species={pet.species} phase="egg" size={54} />
            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>부화까지 {hatchLabel(pet.hatchAt - Date.now())}</div>
          </div>
        ) : pet.phase === 'dead' ? (
          <div style={{ textAlign: 'center', fontSize: 12 }}>
            <PetArt species={pet.species} phase="dead" size={48} />
            <div style={{ marginTop: 2 }}>별이 되었어요…</div>
          </div>
        ) : (
          <div className={sleeping ? '' : 'tama-bob'} style={{ display: 'grid', placeItems: 'center' }}>
            <PetArt species={pet.species} phase={pet.phase} size={60} />
            {sleeping && <span style={{ position: 'absolute', top: 8, right: 12, fontSize: 16 }}>💤</span>}
          </div>
        )}
      </div>

      {/* Stats */}
      {pet && pet.phase !== 'egg' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          <Stat emoji="🍖" value={pet.hunger} />
          <Stat emoji="😊" value={pet.happiness} />
          <Stat emoji="🧼" value={pet.hygiene} />
          <Stat emoji="⚡" value={pet.energy} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
        <DeviceBtn label="🍽️" title="밥주기 (포만감 +25)" onClick={() => pet && feed(pet.id)} disabled={!isCreature || sleeping} />
        <DeviceBtn label="🎮" title="놀기 (행복 +20, 에너지 -10)" onClick={() => pet && play(pet.id)} disabled={!isCreature || sleeping || (pet?.energy ?? 0) < 10} />
        <DeviceBtn label="🧼" title="청소 (청결 100)" onClick={() => pet && clean(pet.id)} disabled={!pet || pet.phase === 'egg'} />
        <DeviceBtn label={sleeping ? '☀️' : '😴'} title={sleeping ? '깨우기' : '재우기 (에너지 회복)'} onClick={() => pet && toggleSleep(pet.id)} disabled={!isCreature && pet?.phase !== 'baby' && pet?.phase !== 'adult'} />
      </div>

      {/* Release */}
      {pet && (
        <button
          type="button"
          onClick={() => { if (confirm(pet.phase === 'dead' ? '떠나보낼까요?' : '이 친구를 풀어줄까요?')) release(pet.id); }}
          style={{ width: '100%', marginTop: 8, padding: '5px 0', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '2px solid #e58aa8', background: '#fff0f5', color: '#be185d' }}
        >
          👋 {pet.phase === 'dead' ? '떠나보내기' : '풀어주기'}
        </button>
      )}
    </div>
  );
}
