import {
  Baby, Briefcase, GraduationCap, Heart, HeartPulse, House, Plane, Sparkles, Trophy, Users, type LucideIcon,
} from 'lucide-react';
import { COLOR_THEMES } from '@/data/color-themes';
import { matchColors } from '@/lib/calendar-theme';
import { LIFE_CATEGORIES, type LifeCategory, type Relation } from '@/lib/life';
import type { TKey } from '@/i18n/translations';

/**
 * One place for how each category looks: its colour (the calendar's own
 * palette family, and the chosen colour theme when there is one — the same
 * matching the calendar's plans use) and an icon, so a category never rests
 * on colour alone.
 */
const BASE: Record<LifeCategory, string> = {
  birth: '#f59e0b',
  family: '#ef4444',
  education: '#3b82f6',
  career: '#6366f1',
  relationship: '#ec4899',
  health: '#10b981',
  travel: '#06b6d4',
  achievement: '#8b5cf6',
  home: '#f97316',
  other: '#64748b',
};

export const CATEGORY_ICON: Record<LifeCategory, LucideIcon> = {
  birth: Baby,
  family: Users,
  education: GraduationCap,
  career: Briefcase,
  relationship: Heart,
  health: HeartPulse,
  travel: Plane,
  achievement: Trophy,
  home: House,
  other: Sparkles,
};

export const CATEGORY_LABEL: Record<LifeCategory, TKey> = {
  birth: 'life.cat.birth',
  family: 'life.cat.family',
  education: 'life.cat.education',
  career: 'life.cat.career',
  relationship: 'life.cat.relationship',
  health: 'life.cat.health',
  travel: 'life.cat.travel',
  achievement: 'life.cat.achievement',
  home: 'life.cat.home',
  other: 'life.cat.other',
};

export const RELATION_LABEL: Record<Relation, TKey> = {
  mother: 'life.rel.mother',
  father: 'life.rel.father',
  spouse: 'life.rel.spouse',
  child: 'life.rel.child',
  sibling: 'life.rel.sibling',
  other: 'life.rel.other',
};

const cache = new Map<string, Record<LifeCategory, string>>();

/** Each category's colour under the colour theme (or the base palette). */
export function categoryColors(themeId: string | null | undefined): Record<LifeCategory, string> {
  const key = themeId ?? '';
  const hit = cache.get(key);
  if (hit) return hit;
  const theme = themeId ? COLOR_THEMES.find((t) => t.id === themeId) : undefined;
  const base = LIFE_CATEGORIES.map((c) => BASE[c]);
  const shown = theme ? matchColors(base, theme.colors) : base;
  const out = Object.fromEntries(LIFE_CATEGORIES.map((c, i) => [c, shown[i]])) as Record<LifeCategory, string>;
  cache.set(key, out);
  return out;
}

/** Ink for a category's label text: the colour pulled toward the page's own
 *  text colour, so even a pastel theme reads on the card (and in dark mode). */
export const inkOf = (color: string): string => `color-mix(in srgb, ${color} 62%, hsl(var(--foreground)))`;
