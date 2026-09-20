/**
 * The scratch map as a picture.
 *
 * Drawn from the shapes rather than screenshotted, so it comes out at any
 * size, always at the whole world, and always with every city named — the map
 * on screen writes those only once it is zoomed in, and a picture has no zoom.
 */
import { MAP_NORTH, MAP_SOUTH, project } from '../place-world';
import { isWished, type CityVisit, type CountryShape, type CountryVisit } from '../place';

export interface PlaceImageInput {
  shapes: readonly CountryShape[];
  countries: readonly CountryVisit[];
  cities: readonly CityVisit[];
  homeCityId?: string;
  /** Page background and ink, already resolved to real colours. */
  background: string;
  ink: string;
  /** The colour of a country that has been walked on... */
  visited: string;
  /** ...and of one that is only wanted. */
  wished: string;
  /** The line under the picture, already translated. */
  caption?: string;
}

/** The width of the exported picture. */
export const PLACE_IMAGE_WIDTH = 2160;
/** Room left under the map for the line of numbers. */
const FOOT = 0.12;

export function drawPlace(ctx: CanvasRenderingContext2D, input: PlaceImageInput, width = PLACE_IMAGE_WIDTH): { width: number; height: number } {
  const mapH = Math.round((width * (MAP_NORTH - MAP_SOUTH)) / 360);
  const height = Math.round(mapH * (1 + FOOT));

  ctx.globalAlpha = 1;
  ctx.fillStyle = input.background;
  ctx.fillRect(0, 0, width, height);

  const been = new Map(input.countries.map((c) => [c.code, c]));
  const path = (shape: CountryShape) => {
    ctx.beginPath();
    for (const ring of shape.rings) {
      for (let i = 0; i < ring.length; i++) {
        const p = project(ring[i][0], ring[i][1]);
        const x = p.x * width;
        const y = p.y * mapH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
  };

  ctx.lineJoin = 'round';
  for (const shape of input.shapes) {
    const visit = been.get(shape.code);
    const want = isWished(visit);
    const colour = want ? input.wished : input.visited;
    path(shape);
    ctx.fillStyle = visit ? colour : input.ink;
    ctx.globalAlpha = visit ? (want ? 0.38 : visit.lived ? 0.7 : 0.45) : 0.06;
    ctx.fill();
    ctx.strokeStyle = visit ? colour : input.ink;
    ctx.globalAlpha = visit ? 1 : 0.2;
    ctx.lineWidth = (visit ? 1.5 : 1) * (width / 1000);
    ctx.stroke();
  }

  // Cities, and their names — a picture has room for them.
  ctx.font = `${Math.round(width / 150)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (const city of input.cities) {
    const p = project(city.lng, city.lat);
    const x = p.x * width;
    const y = p.y * mapH;
    const home = city.id === input.homeCityId;
    const r = (home ? 4 : 3) * (width / 1000);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = home ? input.visited : input.background;
    ctx.fill();
    ctx.strokeStyle = home ? input.visited : input.ink;
    ctx.globalAlpha = home ? 1 : 0.7;
    ctx.lineWidth = width / 1400;
    ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = input.ink;
    ctx.fillText(city.name, x, y - r - width / 500);
  }

  // The numbers, and where it came from.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = input.ink;
  if (input.caption) {
    ctx.globalAlpha = 0.6;
    ctx.font = `${Math.round(width / 62)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(input.caption, width / 2, mapH + (height - mapH) * 0.5);
  }
  ctx.globalAlpha = 0.35;
  ctx.font = `${Math.round(width / 100)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText('24Houring', width / 2, height - width / 70);
  ctx.globalAlpha = 1;
  return { width, height };
}

/** The scratch map as a PNG blob. */
export async function placeImage(input: PlaceImageInput, width = PLACE_IMAGE_WIDTH): Promise<Blob | null> {
  const mapH = Math.round((width * (MAP_NORTH - MAP_SOUTH)) / 360);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round(mapH * (1 + FOOT));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  drawPlace(ctx, input, width);
  return new Promise((done) => canvas.toBlob((b) => done(b), 'image/png'));
}
