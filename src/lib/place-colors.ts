/**
 * The colours of the map, when the ones it came with are not the ones wanted.
 *
 * The map has always had exactly two colours — been, and meaning to — plus one
 * for the pins, because a world map in eight colours is a flag chart. That rule
 * still holds; what is here is only which two, and which one, since a map of
 * one's own life is a thing people want to look at, and looking at it is
 * easier in colours they chose.
 *
 * Kept with the record rather than in the preferences, so the map arrives at
 * the next device the way it was left, and stored as `#rrggbb` and nothing
 * else — anything a sync or a restored backup hands over that is not exactly
 * that is dropped rather than drawn.
 */
import { PIN_CATEGORIES, type PinCategory, type PlacePalette } from './place';

/** The colours offered. Muted on purpose: these are washes over a whole
 *  country, and a saturated one turns the map into a warning sign. */
export const PLACE_SWATCHES = [
  '#b4544a', // brick
  '#c4744a', // terracotta
  '#c9a227', // ochre
  '#7a8355', // olive
  '#4f8a6a', // moss
  '#3f8f8f', // teal
  '#4a72b4', // slate blue
  '#5b5ea6', // indigo
  '#8a5fa8', // plum
  '#b4587f', // rose
  '#7a6a5d', // umber
  '#5a5a5a', // graphite
] as const;

export interface PlaceColors {
  visited: string;
  wished: string;
  /** Every kind of pin, chosen or not — the map asks for all of them. */
  pin: Record<PinCategory, string>;
}

/**
 * The colours to draw with: whatever was chosen, and the theme's own where
 * nothing was. A pin without a colour of its own is the "been" colour, which
 * is what every pin was before any of this.
 */
export function placeColors(
  palette: PlacePalette | undefined,
  base: { visited: string; wished: string },
): PlaceColors {
  const visited = palette?.visited ?? base.visited;
  const wished = palette?.wished ?? base.wished;
  const pin = Object.fromEntries(
    PIN_CATEGORIES.map((c) => [c, palette?.pins?.[c] ?? visited]),
  ) as Record<PinCategory, string>;
  return { visited, wished, pin };
}
