import type { Species, Phase } from '@/hooks/useTamagotchi';

/**
 * Line-only creature art (stroke = currentColor, no fills except tiny eye dots),
 * so it reads clearly over any background and barely occludes what's beneath.
 * viewBox 0 0 64 64. Baby = rounder/smaller face form; adults are per-species
 * side-view walkers (cat/puppy/bear/rabbit trot on four legs, chick/duck strut
 * on two, mole burrows along the ground), drawn facing right and mirrored by
 * the Creature to match their heading.
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

/* ── Adult: side-view walking characters, one per species. All are drawn facing
   RIGHT; Creature mirrors the whole sprite by heading. Quadrupeds trot with
   diagonal leg pairs (legL/legR keyframes), far-side limbs are half-opacity for
   depth, tails wag, bird wings flap on the arm keyframes. ─────────────────── */
const pivotTop = { transformBox: 'fill-box', transformOrigin: 'top' } as const;
const pivotRump = { transformBox: 'fill-box', transformOrigin: 'right bottom' } as const;

/** One walking leg with a little forward paw. Diagonal pairs share a class. */
function Leg({ x, top, len, cls, walk, far = false, w }: { x: number; top: number; len: number; cls: 'tama-legL' | 'tama-legR'; walk: boolean; far?: boolean; w?: number }) {
  return (
    <g className={walk ? cls : undefined} style={{ ...pivotTop, opacity: far ? 0.5 : 1 }}>
      <path d={`M${x} ${top} v${len} q0 1.2 3 1.2`} strokeWidth={w} />
    </g>
  );
}

function AdultCat({ walk }: { walk: boolean }) {
  return (
    <g>
      {/* fluffy raised tail (one tapered outline), wags from the rump */}
      <g className={walk ? 'tama-tail' : undefined} style={pivotRump}>
        <path d="M16 34 C5 31 2 19 9 12.5 C10.5 11.2 12.6 12.4 11.8 14.6 C7 20.5 9.5 27 17 29.5" />
      </g>
      <Leg x={26} top={42} len={12} cls="tama-legR" walk={walk} far />
      <Leg x={41} top={42} len={12} cls="tama-legL" walk={walk} far />
      {/* arched back + belly */}
      <path d="M40 30 C33 25.5 22 26 17 31.5 C13 36.5 15 41.5 20 43 C27 45 36 45 40.5 43" />
      <Leg x={21} top={42} len={12} cls="tama-legL" walk={walk} />
      <Leg x={36} top={42} len={12} cls="tama-legR" walk={walk} />
      {/* big chibi head */}
      <circle cx={45} cy={20.5} r={10.5} />
      <path d="M38.5 12.5 L37 3.5 L45 8.5 M48.5 8.5 L53.5 2.5 L55.5 11.5" />
      {eye(42.5, 21, 2)}
      {eye(49, 21, 2)}
      <circle cx={45.8} cy={24.8} r={1.2} fill="currentColor" stroke="none" />
      <path d="M43.4 26.8 q1.2 1.6 2.4 0 M45.8 26.8 q1.2 1.6 2.4 0" />
      <path d="M55.5 21.5 l6.5 -1.2 M55.5 25 l6.5 1" />
    </g>
  );
}

function AdultPuppy({ walk }: { walk: boolean }) {
  return (
    <g>
      {/* shiba tail curled over the back */}
      <g className={walk ? 'tama-tail' : undefined} style={pivotRump}>
        <path d="M18.5 29.5 C14 20.5 25 15.5 26.5 23 C27.3 27.5 21.5 29.5 20 26" />
      </g>
      <Leg x={26} top={42} len={12} cls="tama-legR" walk={walk} far />
      <Leg x={41} top={42} len={12} cls="tama-legL" walk={walk} far />
      <path d="M40 30 C32 25.5 21 26 17 32 C14 37 16 42 21 43.5 C28 45.5 37 45 40.5 43" />
      <Leg x={21} top={42} len={12} cls="tama-legL" walk={walk} />
      <Leg x={36} top={42} len={12} cls="tama-legR" walk={walk} />
      {/* big chibi head */}
      <circle cx={45} cy={20.5} r={10.5} />
      <path d="M39 11.5 L38 2.5 L45.5 8 M48.5 8 L51.5 1.5 L54.5 10" />
      {eye(42.5, 20.5, 2)}
      {eye(48.5, 20.5, 2)}
      {/* nose + smile + happy tongue */}
      <circle cx={45.5} cy={24.4} r={1.3} fill="currentColor" stroke="none" />
      <path d="M43 26.6 q2.5 2.2 5 0 M45.5 28.3 q0 2.6 -1.9 2.8" />
    </g>
  );
}

function AdultBear({ walk }: { walk: boolean }) {
  return (
    <g>
      <path d="M14 36 q-3.5 .5 -2.5 4" />{/* stubby tail */}
      <Leg x={26.5} top={44} len={10} cls="tama-legR" walk={walk} far w={3.4} />
      <Leg x={42} top={44} len={10} cls="tama-legL" walk={walk} far w={3.4} />
      {/* big round body */}
      <path d="M42 27 C33 21 18 23 13.5 32 C11 39 15 45 22 46.5 C30 48 38 47 42 44" />
      <Leg x={21} top={44} len={10} cls="tama-legL" walk={walk} w={3.4} />
      <Leg x={37} top={44} len={10} cls="tama-legR" walk={walk} w={3.4} />
      {/* big chibi head */}
      <circle cx={45} cy={21} r={11} />
      <circle cx={37.5} cy={12} r={3.4} />
      <circle cx={52} cy={11.4} r={3.4} />
      {eye(41.5, 20.5, 2)}
      {eye(48, 20.5, 2)}
      {/* round muzzle */}
      <circle cx={48.2} cy={25.2} r={3.2} />
      <circle cx={48.2} cy={24} r={1.4} fill="currentColor" stroke="none" />
    </g>
  );
}

function AdultRabbit({ walk }: { walk: boolean }) {
  return (
    <g>
      <circle cx={13.8} cy={36.5} r={2.6} />{/* cotton tail */}
      <Leg x={27} top={44.5} len={10.5} cls="tama-legR" walk={walk} far />
      <Leg x={40} top={44} len={11} cls="tama-legL" walk={walk} far />
      <path d="M39 30 C32 27 24 28 20 32 C14 36 14 43 21 45.5 C29 47.5 37 46 40 43" />
      <path d="M30 44.5 C22.5 45 19.5 37 25.5 32.5" />{/* big haunch */}
      <Leg x={22} top={45} len={10} cls="tama-legL" walk={walk} />
      <Leg x={36} top={44.5} len={10.5} cls="tama-legR" walk={walk} />
      {/* big chibi head */}
      <circle cx={44.5} cy={23} r={10} />
      {/* long ears swept back */}
      <path d="M40 14.5 C35.5 3 42 -.5 44.5 11.5 M47 12.5 C48.5 -1 55.5 1.5 51 15" />
      {eye(41.5, 23, 2)}
      {eye(47.5, 23, 2)}
      <circle cx={44.5} cy={26.6} r={1.2} fill="currentColor" stroke="none" />
      <path d="M42.8 28.6 q1.7 1.7 3.4 0" />
    </g>
  );
}

function AdultChick({ walk }: { walk: boolean }) {
  return (
    <g>
      {/* trident feet on stick legs */}
      <g className={walk ? 'tama-legL' : undefined} style={pivotTop}><path d="M29.5 46.5 v9 m-3 2 l3 -2 l3 2" /></g>
      <g className={walk ? 'tama-legR' : undefined} style={pivotTop}><path d="M37 46 v9.5 m-3 2 l3 -2 l3 2" /></g>
      <circle cx={33} cy={34} r={14} />
      <path d="M31 20.5 v-4.5 M26.5 21.5 l-2.5 -4 M35.5 21 l2.5 -4" />{/* tuft */}
      <path d="M20 28.5 l-5.5 -3.5 M19.5 32 l-6 -.5" />{/* tail feathers */}
      {/* tiny folded wing, low on the flank so it can't read as a mouth */}
      <g className={walk ? 'tama-armL' : undefined} style={pivotTop}>
        <path d="M22.5 38.5 q5.5 3 10.5 .8" />
      </g>
      {eye(37.5, 26.5, 2)}
      {eye(43.5, 26.5, 2)}
      <path d="M47 28.5 l6.5 2.6 l-6.5 2.6 Z" fill="currentColor" stroke="none" />{/* beak */}
    </g>
  );
}

function AdultDuck({ walk }: { walk: boolean }) {
  return (
    <g>
      {/* webbed waddling feet */}
      <g className={walk ? 'tama-legL' : undefined} style={pivotTop}><path d="M27.5 45.5 v8 q4 0 5 2 h-6.5" /></g>
      <g className={walk ? 'tama-legR' : undefined} style={pivotTop}><path d="M35 45 v8.5 q4 0 5 2 h-6.5" /></g>
      {/* horizontal body + upturned tail */}
      <path d="M40 31 C46 33.5 47 42 39 45.5 C29 48.5 17 46.5 14.5 39.5 C12.5 33.5 20 29.5 28 29.5" />
      <path d="M15 33.5 l-4.5 -4" />
      {/* neck + head */}
      <path d="M40.5 22.5 C40 26.5 39.5 28.5 38.5 30.5 M50.5 21 C50 25.5 48 28.5 45.5 31" />
      <circle cx={45.5} cy={16} r={8} />
      {/* flat bill */}
      <path d="M53 14 q7 .5 7 3 q0 2.5 -7 2.8 M53.4 17 h6" />
      {eye(43, 14.5, 2)}
      {eye(48.5, 14.5, 2)}
      {/* folded wing, flaps */}
      <g className={walk ? 'tama-armL' : undefined} style={pivotTop}>
        <path d="M20.5 37.5 q7.5 -4.5 13.5 -.5" />
      </g>
    </g>
  );
}

function AdultMole({ walk }: { walk: boolean }) {
  return (
    <g>
      <path d="M15.5 46 q-4.5 -.5 -4 3.5" />{/* skinny tail */}
      <g className={walk ? 'tama-legR' : undefined} style={{ ...pivotTop, opacity: 0.5 }}><path d="M29 53.5 v3.5" /></g>
      {/* low burrowing body with a pointy snout */}
      <path d="M55.5 44.5 C59 46.5 57 50.5 51 51.5 C40 54.5 24 54.5 17 50 C11.5 46 14.5 38.5 23 36.5 C35 33.5 49 36.5 55.5 44.5 Z" />
      <g className={walk ? 'tama-legL' : undefined} style={pivotTop}><path d="M23 53 v4" /></g>
      {/* big digging mitt with two claw ticks */}
      <g className={walk ? 'tama-armL' : undefined} style={pivotTop}>
        <path d="M46 51 q5 0 5.5 4 M51.5 55 l3 1 M50.8 56.3 l2.6 1.8" />
      </g>
      {/* blissful closed eyes */}
      <path d="M39.5 42 q2.2 -2.6 4.4 0 M46 43 q2.2 -2.6 4.4 0" />
      <circle cx={56.5} cy={44.5} r={1.7} fill="currentColor" stroke="none" />
      <path d="M56 41.5 l5.5 -1.5 M57 45 l5.5 .8" />{/* whiskers */}
    </g>
  );
}

function AdultBody({ species, walk }: { species: Species; walk: boolean }) {
  switch (species) {
    case 'cat': return <AdultCat walk={walk} />;
    case 'puppy': return <AdultPuppy walk={walk} />;
    case 'bear': return <AdultBear walk={walk} />;
    case 'rabbit': return <AdultRabbit walk={walk} />;
    case 'chick': return <AdultChick walk={walk} />;
    case 'duck': return <AdultDuck walk={walk} />;
    case 'mole': return <AdultMole walk={walk} />;
  }
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
