import { Briefcase, Circle, Users, UserRound, type LucideIcon } from 'lucide-react';
import { COLOR_THEMES } from '@/data/color-themes';
import { matchColors } from '@/lib/calendar-theme';
import { RELATION_GROUPS, type RelationGroup } from '@/lib/relation';
import type { TKey } from '@/i18n/translations';

/**
 * How each group looks. Muted on purpose: on this page the colour is only a
 * thin ring around a hollow circle on a pale background, so a bright palette
 * would shout. The group's name is always written somewhere too — nothing
 * here is told by colour alone.
 */
const BASE: Record<RelationGroup, string> = {
  family: '#b4544a', // brick
  friend: '#5b7893', // slate blue
  work: '#7a8355', // olive
  other: '#8a8a8a', // grey
};

export const GROUP_LABEL: Record<RelationGroup, TKey> = {
  family: 'relation.group.family',
  friend: 'relation.group.friend',
  work: 'relation.group.work',
  other: 'relation.group.other',
};

export const GROUP_ICON: Record<RelationGroup, LucideIcon> = {
  family: Users,
  friend: UserRound,
  work: Briefcase,
  other: Circle,
};

const cache = new Map<string, Record<RelationGroup, string>>();

/** Each group's colour under the chosen colour theme, or the base palette. */
export function groupColors(themeId: string | null | undefined): Record<RelationGroup, string> {
  const key = themeId ?? '';
  const hit = cache.get(key);
  if (hit) return hit;
  const theme = themeId ? COLOR_THEMES.find((t) => t.id === themeId) : undefined;
  const base = RELATION_GROUPS.map((g) => BASE[g]);
  const shown = theme ? matchColors(base, theme.colors) : base;
  const out = Object.fromEntries(RELATION_GROUPS.map((g, i) => [g, shown[i]])) as Record<RelationGroup, string>;
  cache.set(key, out);
  return out;
}
