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

// Per-species art. `adult` toggles the grown form (adds body/limbs/tail + a tell).
function Creature({ species, adult }: { species: Species; adult: boolean }) {
  const s = adult ? 1 : 0.82; // babies a touch smaller
  const head = (
    <g>
      <circle cx={32} cy={26} r={13} />
      {eye(27, 25)}
      {eye(37, 25)}
    </g>
  );
  const body = adult ? <path d="M22 38 q10 12 20 0" /> : null;
  const feet = adult ? <path d="M27 50 v4 M37 50 v4" /> : null;

  const feature = () => {
    switch (species) {
      case 'chick':
        return (<>
          <path d="M29 30 l3 3 l3 -3 Z" fill="currentColor" stroke="none" />{/* beak */}
          <path d="M32 13 v-4 M28 12 l-2 -3 M36 12 l2 -3" />{/* tuft */}
        </>);
      case 'duck':
        return (<>
          <path d="M26 30 q6 5 12 0 q-6 3 -12 0 Z" />{/* wide bill */}
          <path d="M40 20 q6 -2 5 4" />{/* little back feather */}
        </>);
      case 'rabbit':
        return (<>
          <path d="M26 15 C24 4 21 4 23 15 M38 15 C40 4 43 4 41 15" />{/* long ears */}
          <path d="M30 31 q2 2 4 0" />{/* mouth */}
        </>);
      case 'bear':
        return (<>
          <circle cx={22} cy={15} r={4} /><circle cx={42} cy={15} r={4} />{/* round ears */}
          <circle cx={32} cy={30} r={2.2} />{/* snout */}
        </>);
      case 'puppy':
        return (<>
          <path d="M20 20 q-6 4 -2 12 M44 20 q6 4 2 12" />{/* floppy ears */}
          <path d="M32 30 v3 M29 33 q3 3 6 0" />{/* nose+mouth */}
        </>);
      case 'cat':
        return (<>
          <path d="M22 18 l-3 -8 l8 4 M42 18 l3 -8 l-8 4" />{/* pointy ears */}
          <path d="M18 27 h6 M40 27 h6 M20 30 h5 M39 30 h5" />{/* whiskers */}
          {adult ? <path d="M45 40 q10 -2 6 -12" /> : null}{/* tail */}
        </>);
      case 'mole':
        return (<>
          <path d="M24 32 q8 6 16 0" />{/* long snout */}
          <path d="M20 24 q-4 2 -1 6 M44 24 q4 2 1 6" />{/* digging paws */}
        </>);
    }
  };

  return (
    <g transform={`translate(32 32) scale(${s}) translate(-32 -32)`}>
      {head}
      {feature()}
      {body}
      {feet}
    </g>
  );
}

export function PetArt({ species, phase, size = 56, className = '' }: { species: Species; phase: Phase; size?: number; className?: string }) {
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
        : <Creature species={species} adult={phase === 'adult'} />}
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
