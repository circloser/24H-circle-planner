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
 * Where the tiles come from. One place, so a service can be changed in a
 * single edit if the traffic ever outgrows what it gives away for nothing.
 * Whoever drew them is named on the map and in the exported picture, always.
 *
 * There are two, and each is free to use without an account or a key:
 *
 *  · the street map, from OpenStreetMap, which goes down to a doorway;
 *  · the satellite view, from NASA's own imagery service, which is public
 *    domain and stops at about six hundred metres a pixel. That is a country
 *    or a coastline rather than a street — the trade for asking nobody's
 *    permission and owing nobody anything.
 *
 * Past a layer's own last zoom its deepest tiles are stretched rather than
 * left blank, which is blurry and honest.
 */
export type TileLayer = 'map' | 'satellite';
export const TILE_LAYERS: readonly TileLayer[] = ['map', 'satellite'];

export interface TileSource {
  url: string;
  /** The deepest zoom this service actually has tiles for. */
  maxZoom: number;
  /** Shown in the corner of the map, and written into the exported picture. */
  credit: string;
}

export const TILE_SOURCE: Record<TileLayer, TileSource> = {
  map: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    credit: '© OpenStreetMap contributors',
  },
  satellite: {
    // Blue Marble, shaded relief and bathymetry: one picture of the whole
    // earth rather than a mosaic of days, so it has no clouds and no seams.
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
    maxZoom: 8,
    credit: 'NASA EOSDIS GIBS · Blue Marble',
  },
};

/** The street map's address, kept for anything that only knows about one. */
export const TILE_URL = TILE_SOURCE.map.url;
export const TILE_SIZE = 256;
/** Zoomed out past this the tile map hands over to the globe, which is the
 *  better way to hold the whole world. */
export const PIN_MIN_ZOOM = 3;
export const PIN_MAX_ZOOM = 18;
/** One step below the floor: the pin map is allowed to reach it for the
 *  instant it takes to say "this belongs on the globe now". */
export const PIN_HANDOVER_ZOOM = PIN_MIN_ZOOM - 1;
/** Markers closer together than this are gathered into one numbered circle. */
export const CLUSTER_PX = 52;

export interface Camera { lng: number; lat: number; zoom: number }

export const tileUrl = (z: number, x: number, y: number, layer: TileLayer = 'map'): string =>
  TILE_SOURCE[layer].url
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));

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

/**
 * The tiles that cover a box of `w` × `h` pixels, and where each one goes.
 *
 * `deepest` is as far as the chosen service goes. Asked for more than that,
 * the tiles it does have are drawn larger — `size` says how large — so the
 * map keeps its shape and simply loses detail.
 */
export function tilesFor(
  camera: Camera,
  w: number,
  h: number,
  deepest = 19,
): { z: number; size: number; tiles: TilePlace[] } {
  const wanted = tileZoom(camera.zoom);
  const z = Math.min(wanted, deepest);
  const size = TILE_SIZE * 2 ** (wanted - z);
  const centre = toTile(camera.lng, camera.lat, z);
  const left = centre.x - w / 2 / size;
  const top = centre.y - h / 2 / size;
  const n = 2 ** z;
  const tiles: TilePlace[] = [];
  for (let x = Math.floor(left); x < left + w / size + 1; x++) {
    for (let y = Math.floor(top); y < top + h / size + 1; y++) {
      // The world does not wrap top to bottom, only side to side.
      if (y < 0 || y >= n) continue;
      tiles.push({ z, x: ((x % n) + n) % n, y, left: (x - left) * size, top: (y - top) * size });
    }
  }
  return { z, size, tiles };
}
