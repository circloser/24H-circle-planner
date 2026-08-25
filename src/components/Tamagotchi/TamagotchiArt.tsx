import type { Species, Phase } from '@/hooks/useTamagotchi';

/**
 * Line-only creature art (stroke = currentColor, no fills except tiny eye dots),
 * so it reads clearly over any background and barely occludes what's beneath.
 * viewBox 0 0 64 64. Baby = rounder/smaller; adult adds a body + a species tell.
 */

const eye = (x: number, y: number, r = 1.6) => <circle key={`e${x}`} cx={x} cy={y} r={r} fill="currentColor" stroke="none" />;

function Egg() {
  return (
    <>
      <path d="M32 8 C20 8 15 26 15 38 a17 20 0 0 0 34 0 C49 26 44 8 32 8 Z" />
      <path d="M22 30 l5 4 l-4 5 l6 4" />
    </>
  );
}

function Amoeba() {
  return (
    <>
      <path d="M32 20 c10 0 16 7 15 16 c-1 8 -8 12 -16 12 c-9 0 -16 -6 -15 -15 c1 -8 7 -13 16 -13 Z" />
      {eye(27, 34)}
      {eye(37, 34)}
      <path d="M29 40 q3 3 6 0" />
    </>
  );
}

// ── Baby: a rounder, mostly-face form (a touch smaller) ──────────────────────
function BabyBody({ species }: { species: Species }) {
  const feature = () => {
    switch (species) {
      case 'chick':
        return (<>
          <path d="M29 30 l3 3 l3 -3 Z" fill="currentColor" stroke="none" />
          <path d="M32 13 v-4 M28 12 l-2 -3 M36 12 l2 -3" />
        </>);
      case 'duck':
        return <path d="M26 30 q6 5 12 0 q-6 3 -12 0 Z" />;
      case 'rabbit':
        return (<>
          <path d="M26 15 C24 4 21 4 23 15 M38 15 C40 4 43 4 41 15" />
          <path d="M30 31 q2 2 4 0" />
        </>);
      case 'bear':
        return (<>
          <circle cx={22} cy={15} r={4} /><circle cx={42} cy={15} r={4} />
          <circle cx={32} cy={30} r={2.2} />
        </>);
      case 'puppy':
        return (<>
          <path d="M20 20 q-6 4 -2 12 M44 20 q6 4 2 12" />
          <path d="M32 30 v3 M29 33 q3 3 6 0" />
        </>);
      case 'cat':
        return (<>
          <path d="M22 18 l-3 -8 l8 4 M42 18 l3 -8 l-8 4" />
          <path d="M18 27 h6 M40 27 h6" />
        </>);
      case 'mole':
        return (<>
          <path d="M24 32 q8 6 16 0" />
          <path d="M20 24 q-4 2 -1 6 M44 24 q4 2 1 6" />
        </>);
    }
  };
  return (
    <g transform="translate(32 32) scale(0.82) translate(-32 -32)">
      <circle cx={32} cy={26} r={13} />
      {eye(27, 25)}
      {eye(37, 25)}
      {feature()}
      <path d="M27 50 v4 M37 50 v4" />
    </g>
  );
}

// Species tell drawn on the ADULT head (circle cx32 cy16 r9).
function adultFeature(species: Species) {
  switch (species) {
    case 'chick':
      return (<>
        <path d="M29 18 l3 3 l3 -3 Z" fill="currentColor" stroke="none" />{/* beak */}
        <path d="M32 6 v-3 M29 6 l-2 -3 M35 6 l2 -3" />{/* tuft */}
      </>);
    case 'duck':
      return <path d="M27 18 q5 4 10 0 q-5 3 -10 0 Z" />;/* bill */
    case 'rabbit':
      return (<>
        <path d="M28 9 C26 -4 23 -2 26 9 M36 9 C38 -4 41 -2 38 9" />{/* long ears */}
        <path d="M30 20 q2 2 4 0" />
      </>);
    case 'bear':
      return (<>
        <circle cx={24} cy={8} r={3} /><circle cx={40} cy={8} r={3} />{/* round ears */}
        <circle cx={32} cy={19} r={1.8} />
      </>);
    case 'puppy':
      return (<>
        <path d="M24 10 q-6 3 -3 11 M40 10 q6 3 3 11" />{/* floppy ears */}
        <path d="M32 19 v2 M30 21 q2 2 4 0" />
      </>);
    case 'cat':
      return (<>
        <path d="M25 9 l-3 -7 l7 4 M39 9 l3 -7 l-7 4" />{/* pointy ears */}
        <path d="M18 16 h6 M40 16 h6" />{/* whiskers */}
      </>);
    case 'mole':
      return <path d="M27 19 q5 4 10 0" />;/* long snout */
  }
}

// ── Adult: a full body — head, torso, swinging arms, walking legs, (cat) tail ─
function AdultBody({ species, walk }: { species: Species; walk: boolean }) {
  const legPivot = { transformBox: 'fill-box' as const, transformOrigin: 'top' };
  return (
    <g>
      {/* Cat tail (behind body), wags. */}
      {species === 'cat' && (
        <g className={walk ? 'tama-tail' : undefined} style={{ transformBox: 'fill-box', transformOrigin: 'left' }}>
          <path d="M40 40 q12 -1 8 -13" />
        </g>
      )}
      {/* Legs (behind), alternating walk. */}
      <g className={walk ? 'tama-legL' : undefined} style={legPivot}><path d="M28 43 l-2 11 M22 54 h6" /></g>
      <g className={walk ? 'tama-legR' : undefined} style={legPivot}><path d="M36 43 l2 11 M35 54 h6" /></g>
      {/* Torso. */}
      <path d="M23 27 q9 -4 18 0 q3 12 -1 18 q-8 5 -16 0 q-4 -6 -1 -18 Z" />
      {/* Arms, swing opposite to legs. */}
      <g className={walk ? 'tama-armL' : undefined} style={legPivot}><path d="M24 30 q-5 5 -6 11" /></g>
      <g className={walk ? 'tama-armR' : undefined} style={legPivot}><path d="M40 30 q5 5 6 11" /></g>
      {/* Head + eyes + species tell. */}
      <circle cx={32} cy={16} r={9} />
      {eye(29, 15)}
      {eye(35, 15)}
      {adultFeature(species)}
    </g>
  );
}

export function PetArt({ species, phase, size = 56, className = '', walk = true }: { species: Species; phase: Phase; size?: number; className?: string; walk?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {phase === 'egg' ? <Egg />
        : phase === 'amoeba' ? <Amoeba />
        : phase === 'dead' ? (<>
            <circle cx={32} cy={30} r={14} />
            <path d="M25 26 l6 6 M31 26 l-6 6 M39 26 l6 6 M45 26 l-6 6" />
            <path d="M25 40 q7 -5 14 0" />
          </>)
        : phase === 'adult' ? <AdultBody species={species} walk={walk} />
        : <BabyBody species={species} />}
    </svg>
  );
}

/** Small poop line-glyph. */
export function PoopArt({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 28 h10 q4 0 4 -4 q3 -1 1 -5 q1 -4 -3 -4 q0 -4 -5 -3 q-4 -2 -6 3 q-4 1 -2 5 q-3 3 1 5 Z" />
      <path d="M14 20 q2 2 4 0 M17 24 h.01" />
    </svg>
  );
}
