/**
 * The arithmetic behind the pin map: which tiles cover the screen, and which
 * pins are standing so close together that they should be one circle.
 *
 * Kept apart from the component so both can be tested without a browser, and
 * so the one place the tile service is named is a line of plain data.
 */
import { toTile } from './place-world';
import type { Pin } from './place';

/**
 * Where the tiles come from. One place, so it can be changed in a single edit
 * if the traffic ever outgrows what OpenStreetMap gives away for nothing.
 * Their attribution is on the map and in the exported picture, always.
 *
 * (A NASA satellite layer lived here for a day. Its pictures stop at about
 * six hundred metres a pixel, which is a coastline rather than a street, and
 * a blurry photograph is worse than a clear drawing — so it went.)
 */
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_CREDIT = '© OpenStreetMap contributors';
export const TILE_SIZE = 256;

/**
 * Where the tile map stops and the globe takes over.
 *
 * At this zoom the map holds about a corner of a continent — Korea, Japan and
 * the near half of China across a desk screen. Wider than that is a picture of
 * the world, and the world belongs on the globe; closer than that is a place,
 * and a place belongs on the tiles. The globe zooms to exactly this scale and
 * no further, so the two meet without a jump. See globeZoomForTile.
 */
export const PIN_MIN_ZOOM = 6;
export const PIN_MAX_ZOOM = 18;
/** One step below the floor: the pin map is allowed to reach it for the
 *  instant it takes to say "this belongs on the globe now". */
export const PIN_HANDOVER_ZOOM = PIN_MIN_ZOOM - 1;
/** Markers closer together than this are gathered into one numbered circle. */
export const CLUSTER_PX = 52;

export interface Camera { lng: number; lat: number; zoom: number }

export const tileUrl = (z: number, x: number, y: number): string =>
  TILE_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

/** A marker on screen: one pin, or a handful standing on the same spot. */
export interface Cluster {
  key: string;
  x: number;
  y: number;
  pins: Pin[];
}

/**
 * Gather pins that would land on top of each other into one circle, on a
 * fixed grid so the same pins always cluster the same way.
 */
export function clusterPins(
  placed: ReadonlyArray<{ pin: Pin; x: number; y: number }>,
  cell = CLUSTER_PX,
): Cluster[] {
  const cells = new Map<string, Cluster>();
  for (const { pin, x, y } of placed) {
    const key = `${Math.floor(x / cell)}|${Math.floor(y / cell)}`;
    const at = cells.get(key);
    if (at) {
      at.pins.push(pin);
      // The circle sits at the average of what it holds.
      at.x += (x - at.x) / at.pins.length;
      at.y += (y - at.y) / at.pins.length;
    } else {
      cells.set(key, { key, x, y, pins: [pin] });
    }
  }
  return [...cells.values()];
}

export interface TilePlace { z: number; x: number; y: number; left: number; top: number }

/** The whole-number zoom the camera is really drawn at. */
export const tileZoom = (zoom: number): number => Math.max(0, Math.min(19, Math.round(zoom)));

/** The tiles that cover a box of `w` × `h` pixels, and where each one goes. */
export function tilesFor(camera: Camera, w: number, h: number): { z: number; tiles: TilePlace[] } {
  const z = tileZoom(camera.zoom);
  const centre = toTile(camera.lng, camera.lat, z);
  const left = centre.x - w / 2 / TILE_SIZE;
  const top = centre.y - h / 2 / TILE_SIZE;
  const n = 2 ** z;
  const tiles: TilePlace[] = [];
  for (let x = Math.floor(left); x < left + w / TILE_SIZE + 1; x++) {
    for (let y = Math.floor(top); y < top + h / TILE_SIZE + 1; y++) {
      // The world does not wrap top to bottom, only side to side.
      if (y < 0 || y >= n) continue;
      tiles.push({ z, x: ((x % n) + n) % n, y, left: (x - left) * TILE_SIZE, top: (y - top) * TILE_SIZE });
    }
  }
  return { z, tiles };
}
