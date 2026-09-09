import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { TamagotchiDevice } from './TamagotchiDevice';
import { TamagotchiProvider, type Pet } from '@/hooks/useTamagotchi';
import { PetArt } from './TamagotchiArt';
import type { Mood } from '@/lib/tama-mood';

vi.mock('@/hooks/usePreferences', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const pet = (over: Partial<Pet> = {}): Pet => {
  const now = Date.now();
  return {
    id: 'p1', species: 'cat', phase: 'adult',
    bornAt: now - 9e6, hatchAt: now - 9e6, hatchedAt: now - 9e6,
    x: 40, y: 40, heading: 0,
    hunger: 90, happiness: 70, energy: 90, sleeping: false,
    plays: 400, name: null, lastPoopAt: now, nextPoopIn: 9e6,
    hungerZeroSince: null, bloat: 0, boostUntil: 0,
    ...over,
  };
};

function seed(pets: Pet[], hygiene: number) {
  localStorage.setItem('24h-tamagotchi', JSON.stringify({
    version: 1, on: true, pets, selectedId: pets[0]?.id ?? null, hygiene, poops: [], savedAt: Date.now(),
  }));
}

/** The console portrait, as markup. */
function consoleFace(): string {
  const { container } = render(
    <TamagotchiProvider>
      <TamagotchiDevice />
    </TamagotchiProvider>,
  );
  const svg = container.querySelector('svg');
  return svg?.innerHTML ?? '';
}

/** The same species+phase drawn directly in a known mood, for comparison. */
function reference(mood: Mood): string {
  const { container } = render(<PetArt species="cat" phase="adult" size={60} mood={mood} />);
  const svg = container.querySelector('svg');
  return svg?.innerHTML ?? '';
}

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('TamagotchiDevice console portrait', () => {
  // The portrait and the pet roaming the page are the same animal. When the
  // console forgot to pass a mood it defaulted to a smile, so a starving pet
  // scowled on the desktop and beamed inside its own console.
  it('wears the hungry face when the pet is hungry', () => {
    seed([pet({ hunger: 5 })], 100);
    const shown = consoleFace();
    expect(shown).toBe(reference('hungry'));
    expect(shown).not.toBe(reference('content'));
  });

  it('wears the queasy face when the shared hygiene is low', () => {
    seed([pet()], 5);
    expect(consoleFace()).toBe(reference('dirty'));
  });

  it('is content when the pet is well kept', () => {
    seed([pet()], 100);
    expect(consoleFace()).toBe(reference('content'));
  });
});
