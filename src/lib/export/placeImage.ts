/**
 * The scratch map as a picture — the whole world laid flat, or the globe.
 *
 * Drawn from the shapes rather than screenshotted, so it comes out at any
 * size, always whole, and always with every city named — the map on screen
 * writes those only once it is zoomed in, and a picture has no zoom. The
 * globe is drawn facing wherever it was facing on screen, so turning it there
 * first is how the picture is aimed.
 */
import { MAP_NORTH, MAP_SOUTH, project } from '../place-world';
import {
  anyFacing, densifyShape, graticule, project as onGlobe, ringFill, visibleRuns, type Camera, type Screen,
} from '../place-globe';
import { isWished, type CityVisit, type CountryShape, type CountryVisit } from '../place';

/** Which picture: the flat world, or the globe. */
export type PlaceImageShape = 'map' | 'globe';

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
  /** The flat world (the default) or the globe. */
  shape?: PlaceImageShape;
  /** Which way the globe faces; only the globe reads it. */
  facing?: Pick<Camera, 'lng' | 'lat'>;
}

/** The width of the exported picture. */
export const PLACE_IMAGE_WIDTH = 2160;
/** Room left under the map for the line of numbers. */
const FOOT = 0.12;

export function drawPlace(ctx: CanvasRenderingContext2D, input: PlaceImageInput, width = PLACE_IMAGE_WIDTH): { width: number; height: number } {
  const { top: mapH, height } = sizeOf('map', width);

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

  foot(ctx, input, width, mapH, height);
  return { width, height };
}

/** The numbers under the picture, and where it came from. */
function foot(ctx: CanvasRenderingContext2D, input: PlaceImageInput, width: number, top: number, height: number) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = input.ink;
  if (input.caption) {
    ctx.globalAlpha = 0.6;
    ctx.font = `${Math.round(width / 62)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(input.caption, width / 2, top + (height - top) * 0.5);
  }
  ctx.globalAlpha = 0.35;
  ctx.font = `${Math.round(width / 100)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText('24Houring', width / 2, height - width / 70);
  ctx.globalAlpha = 1;
}

/** The size of the picture for each shape: the globe is square. */
function sizeOf(shape: PlaceImageShape, width: number): { top: number; height: number } {
  const top = shape === 'globe' ? width : Math.round((width * (MAP_NORTH - MAP_SOUTH)) / 360);
  return { top, height: Math.round(top * (1 + FOOT)) };
}

/**
 * The globe, whole, facing where it faced on screen: the same drawing as the
 * one on the page (components/Place/GlobeMap) — the sea, the faint lines of
 * longitude and latitude, the countries coloured in, and the cities on the
 * near side with their names.
 */
export function drawGlobe(ctx: CanvasRenderingContext2D, input: PlaceImageInput, width = PLACE_IMAGE_WIDTH): { width: number; height: number } {
  const { top, height } = sizeOf('globe', width);
  const cam: Camera = { lng: input.facing?.lng ?? 0, lat: input.facing?.lat ?? 20, zoom: 1 };
  const s: Screen = { cx: width / 2, cy: top / 2, r: (width / 2) * 0.9 };
  const unit = width / 1000;

  ctx.globalAlpha = 1;
  ctx.fillStyle = input.background;
  ctx.fillRect(0, 0, width, height);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // The ball: the sea, and a rim so it reads as a sphere.
  ctx.beginPath();
  ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
  ctx.fillStyle = input.ink;
  ctx.globalAlpha = 0.05;
  ctx.fill();
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1.5 * unit;
  ctx.strokeStyle = input.ink;
  ctx.stroke();

  ctx.globalAlpha = 0.06;
  ctx.lineWidth = unit;
  for (const line of graticule()) {
    for (const run of visibleRuns(line, cam, s)) {
      ctx.beginPath();
      ctx.moveTo(run[0][0], run[0][1]);
      for (let i = 1; i < run.length; i++) ctx.lineTo(run[i][0], run[i][1]);
      ctx.stroke();
    }
  }

  const been = new Map(input.countries.map((c) => [c.code, c]));
  ctx.save();
  ctx.beginPath();
  ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
  ctx.clip();
  for (const raw of input.shapes) {
    if (!anyFacing(raw, cam)) continue;
    const shape = densifyShape(raw);
    const visit = been.get(shape.code);
    const colour = visit ? (isWished(visit) ? input.wished : input.visited) : input.ink;
    let any = false;
    ctx.beginPath();
    for (const ring of shape.rings) {
      const pts = ringFill(ring, cam, s);
      if (!pts) continue;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      any = true;
    }
    if (!any) continue;
    ctx.fillStyle = colour;
    ctx.globalAlpha = visit ? (isWished(visit) ? 0.4 : visit.lived ? 0.72 : 0.46) : 0.07;
    ctx.fill();
    ctx.beginPath();
    for (const ring of shape.rings) {
      for (const run of visibleRuns(ring, cam, s)) {
        ctx.moveTo(run[0][0], run[0][1]);
        for (let i = 1; i < run.length; i++) ctx.lineTo(run[i][0], run[i][1]);
      }
    }
    ctx.strokeStyle = colour;
    ctx.globalAlpha = visit ? 0.95 : 0.22;
    ctx.lineWidth = (visit ? 1.5 : 1) * unit;
    ctx.stroke();
  }
  ctx.restore();

  // The cities on the near side, and their names.
  ctx.font = `${Math.round(width / 120)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  for (const city of input.cities) {
    const p = onGlobe(city.lng, city.lat, cam, s);
    if (!p.front) continue;
    const home = city.id === input.homeCityId;
    const r = (home ? 5 : 4) * unit;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = home ? input.visited : input.background;
    ctx.fill();
    ctx.strokeStyle = home ? input.visited : input.ink;
    ctx.globalAlpha = home ? 1 : 0.75;
    ctx.lineWidth = 1.5 * unit;
    ctx.stroke();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = input.ink;
    ctx.fillText(city.name, p.x, p.y - r - 2 * unit);
  }

  foot(ctx, input, width, top, height);
  return { width, height };
}

/** The scratch map — flat or as the globe — as a PNG blob. */
export async function placeImage(input: PlaceImageInput, width = PLACE_IMAGE_WIDTH): Promise<Blob | null> {
  const shape = input.shape ?? 'map';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = sizeOf(shape, width).height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (shape === 'globe') drawGlobe(ctx, input, width);
  else drawPlace(ctx, input, width);
  return new Promise((done) => canvas.toBlob((b) => done(b), 'image/png'));
}
