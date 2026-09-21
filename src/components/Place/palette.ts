import { Bed, Building2, Landmark, Mountain, House, UtensilsCrossed, Users, MapPin, type LucideIcon } from 'lucide-react';
import { COLOR_THEMES } from '@/data/color-themes';
import { matchColors } from '@/lib/calendar-theme';
import { PIN_CATEGORIES, type PinCategory } from '@/lib/place';
import type { TKey } from '@/i18n/translations';

/**
 * One colour for the whole map.
 *
 * Countries are told apart by whether they are coloured in at all, not by
 * which colour they are: a world map in eight colours is a flag chart. There
 * are two, and only two — been, and meaning to. Pins are told apart by their
 * icon, for the same reason.
 */
const VISITED = '#b4544a'; // brick
/** Somewhere to go, not somewhere been: the one other colour on the map. */
const WISHED = '#4a72b4'; // slate blue

export function visitedColor(themeId: string | null | undefined): string {
  const theme = themeId ? COLOR_THEMES.find((t) => t.id === themeId) : undefined;
  return theme ? matchColors([VISITED], theme.colors)[0] : VISITED;
}

export function wishedColor(themeId: string | null | undefined): string {
  const theme = themeId ? COLOR_THEMES.find((t) => t.id === themeId) : undefined;
  return theme ? matchColors([WISHED], theme.colors)[0] : WISHED;
}

export const PIN_ICON: Record<PinCategory, LucideIcon> = {
  home: House,
  stay: Bed,
  food: UtensilsCrossed,
  nature: Mountain,
  culture: Landmark,
  work: Building2,
  meet: Users,
  other: MapPin,
};

export const PIN_LABEL: Record<PinCategory, TKey> = {
  home: 'place.cat.home',
  stay: 'place.cat.stay',
  food: 'place.cat.food',
  nature: 'place.cat.nature',
  culture: 'place.cat.culture',
  work: 'place.cat.work',
  meet: 'place.cat.meet',
  other: 'place.cat.other',
};

export const ALL_PIN_CATEGORIES = PIN_CATEGORIES;

/**
 * Natural Earth writes continents in English. Intl knows countries but not
 * continents, so these seven are the one place the app spells them out.
 */
const CONTINENT: Record<string, TKey> = {
  Asia: 'place.continent.asia',
  Europe: 'place.continent.europe',
  Africa: 'place.continent.africa',
  'North America': 'place.continent.northAmerica',
  'South America': 'place.continent.southAmerica',
  Oceania: 'place.continent.oceania',
  Antarctica: 'place.continent.antarctica',
};

/** The continent's name, or the English one for anything unexpected. */
export const continentName = (
  continent: string,
  t: (key: TKey) => string,
): string => (CONTINENT[continent] ? t(CONTINENT[continent]) : continent);

/**
 * The same colour at a given opacity, for a gradient that has to fade out.
 *
 * Themes hand us `#rgb`, `#rrggbb` or an `rgb(...)`, and a gradient stop
 * cannot be given an alpha separately — so it is put into the colour here.
 */
export function hexAlpha(colour: string, alpha: number): string {
  const hex = colour.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  const rgb = /^rgba?\(\s*([0-9.]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)/i.exec(hex);
  const parts = short
    ? short.slice(1).map((c) => parseInt(c + c, 16))
    : long
      ? long.slice(1).map((c) => parseInt(c, 16))
      : rgb
        ? rgb.slice(1).map((c) => Math.round(Number(c)))
        : null;
  if (!parts || parts.some((n) => !Number.isFinite(n))) return hex;
  return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
}
