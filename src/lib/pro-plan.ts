/**
 * What Pro is — in one list, rather than in a dozen places.
 *
 * Every gated surface in the app calls `requestUpgrade(<source>)`, and the
 * paywall used to answer with five lines written by hand. Six of the eleven
 * surfaces therefore sent people to a dialog that never mentioned the thing
 * they had just pressed. This is the list the dialog draws, the map from a
 * source to the line that answers it, and the free-plan numbers gathered from
 * the libraries that enforce them — so what is advertised and what is
 * actually gated cannot drift apart.
 */
import { FREE_LIFE_LINES, FREE_LIFE_MILESTONES } from './life';
import { FREE_RELATION_PEOPLE } from './relation';
import { FREE_PLACE_PINS } from './place';
import { FREE_DIARY_DAYS, FREE_SLOT_LIMIT } from './pro';
import type { TKey } from '@/i18n/translations';

export interface ProFeature {
  /** Stable name, used for the icon and for tests. */
  id: string;
  label: TKey;
  /**
   * The `requestUpgrade` sources this line answers. A source with no line
   * here simply highlights nothing — it never hides the list.
   */
  sources: readonly string[];
}

export const PRO_FEATURES: readonly ProFeature[] = [
  { id: 'sync', label: 'upgrade.featSync', sources: ['sync'] },
  { id: 'lock', label: 'upgrade.featLock', sources: ['e2ee'] },
  { id: 'archive', label: 'upgrade.featArchive', sources: ['slots', 'diary'] },
  { id: 'life', label: 'upgrade.featLife', sources: ['life'] },
  { id: 'people', label: 'upgrade.featPeople', sources: ['relation', 'place'] },
  { id: 'decor', label: 'upgrade.featDecor', sources: ['decor'] },
  { id: 'ical', label: 'upgrade.featICal', sources: ['ical'] },
  { id: 'push', label: 'upgrade.featPush', sources: ['push'] },
  { id: 'stats', label: 'upgrade.featStats', sources: ['stats'] },
  { id: 'clean', label: 'upgrade.featNoAds', sources: ['ads', 'watermark'] },
];

/** The line that answers the surface the paywall was opened from. */
export function featureForSource(source: string | undefined): ProFeature | null {
  if (!source) return null;
  return PRO_FEATURES.find((f) => f.sources.includes(source)) ?? null;
}

/**
 * The same list with the one just asked for at the top.
 *
 * Somebody who pressed "add a fortieth person" should not have to read nine
 * other lines to find out whether Pro answers the thing they wanted.
 */
export function proFeatures(source?: string): readonly ProFeature[] {
  const hit = featureForSource(source);
  if (!hit) return PRO_FEATURES;
  return [hit, ...PRO_FEATURES.filter((f) => f !== hit)];
}

/** What the free plan gives, so the numbers in the paywall are the numbers
 *  the gates use. */
export const FREE_LIMITS = {
  slots: FREE_SLOT_LIMIT,
  diaryDays: FREE_DIARY_DAYS,
  lifeLines: FREE_LIFE_LINES,
  lifeMoments: FREE_LIFE_MILESTONES,
  people: FREE_RELATION_PEOPLE,
  pins: FREE_PLACE_PINS,
} as const;
