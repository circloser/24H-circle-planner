/**
 * Where the card about a chosen thing should sit.
 *
 * It used to be a column down the right of the window, which pushed the map's
 * own buttons sideways every time a country was tapped — the one thing a map's
 * controls must never do is move. So the card is a card now: it opens beside
 * whatever was chosen, on the map, and the corner stays where it is.
 *
 * Plain arithmetic, so it can be tested without a browser: the map hands over
 * a point and its own size, and this says where to put the box.
 */
import type { CountryShape } from './place';

export interface Point { x: number; y: number }
export interface Size { w: number; h: number }

/** Room kept from the edge of the map. */
export const CARD_GUTTER = 12;
/** How far from the chosen point the card stands. */
export const CARD_GAP = 18;
/** The strip down the right the controls have to themselves. */
export const CORNER_STRIP = 64;

/**
 * Roughly the middle of a country: the average of the points of its biggest
 * ring. Not the centre of area — a country with a long tail pulls it — but
 * near enough for "put the card about here", and it costs one pass.
 */
export function shapeCentre(shape: CountryShape): { lng: number; lat: number } {
  let best: readonly (readonly [number, number])[] = [];
  for (const ring of shape.rings) if (ring.length > best.length) best = ring;
  if (!best.length) return { lng: 0, lat: 0 };
  let lng = 0;
  let lat = 0;
  for (const [x, y] of best) {
    lng += x;
    lat += y;
  }
  return { lng: lng / best.length, lat: lat / best.length };
}

/**
 * The top-left corner for a card of `card` pointing at `at`, inside a map of
 * `box`: beside the point, flipped to the other side when there is no room,
 * and never over the controls in the corner or off the edge.
 */
export function cardAt(at: Point, box: Size, card: Size): { left: number; top: number } {
  const room = box.w - CORNER_STRIP;
  let left = at.x + CARD_GAP;
  if (left + card.w > room) left = at.x - CARD_GAP - card.w;
  const most = Math.max(CARD_GUTTER, room - card.w);
  left = Math.max(CARD_GUTTER, Math.min(most, left));
  const top = Math.max(
    CARD_GUTTER,
    Math.min(Math.max(CARD_GUTTER, box.h - CARD_GUTTER - card.h), at.y - card.h / 2),
  );
  return { left, top };
}
