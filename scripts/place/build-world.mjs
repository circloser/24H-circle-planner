/**
 * The world, small enough to carry.
 *
 * Natural Earth's 110m countries and populated places (public domain) are
 * fetched once and written into public/world/ as two compact files that ship
 * with the app. Nothing is fetched at build time or at run time: the scratch
 * map has to work in aeroplane mode, so the world travels with it.
 *
 *   node scripts/place/build-world.mjs
 *
 * Country names are NOT in the file. Intl.DisplayNames already knows them in
 * every language the app speaks, and knows them better; the English name is
 * kept only as the fallback and as something to search against.
 *
 * Shapes are rounded to two decimals (about a kilometre) — the map is 1200
 * pixels wide, so a finer coastline would be pixels nobody can see.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'public/world');

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson';
const COUNTRIES = `${NE}/ne_110m_admin_0_countries.geojson`;
const CITIES = `${NE}/ne_10m_populated_places_simple.geojson`;

/** Two decimals: about a kilometre, and a tenth of the bytes. */
const round = (n) => Math.round(n * 100) / 100;

/** A ring with every point rounded, and points that landed on top of each
 *  other dropped. A ring of fewer than four points is not a shape. */
function ring(points) {
  const out = [];
  for (const [x, y] of points) {
    const p = [round(x), round(y)];
    const last = out[out.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    out.push(p);
  }
  if (out.length > 1) {
    const [a, b] = [out[0], out[out.length - 1]];
    if (a[0] !== b[0] || a[1] !== b[1]) out.push([a[0], a[1]]);
  }
  return out.length >= 4 ? out : null;
}

/** Every outer ring of a polygon or multipolygon, biggest first. Holes are
 *  dropped: at this size a lake inside a country is a pixel. */
function rings(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const out = [];
  for (const poly of polys) {
    const r = ring(poly[0]);
    if (r) out.push(r);
  }
  // Area by the shoelace formula, in square degrees — only for sorting.
  const area = (r) => {
    let a = 0;
    for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
    return Math.abs(a / 2);
  };
  return out.sort((a, b) => area(b) - area(a));
}

const get = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
};

const countries = await get(COUNTRIES);
const world = [];
for (const f of countries.features) {
  const p = f.properties;
  const code = (p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2) ?? '';
  // Natural Earth marks a handful of places with no ISO code at all; a map you
  // colour in needs something to key on, so those are left out.
  if (!/^[A-Z]{2}$/.test(code)) {
    console.warn('skipped (no ISO code):', p.NAME);
    continue;
  }
  const shape = rings(f.geometry);
  if (!shape.length) continue;
  world.push({ c: code, n: p.NAME, k: p.CONTINENT, g: shape });
}
world.sort((a, b) => (a.c < b.c ? -1 : 1));

const cities = await get(CITIES);
const seen = new Set();
const places = [];
for (const f of cities.features) {
  const p = f.properties;
  const code = p.iso_a2;
  const name = p.name;
  if (!/^[A-Z]{2}$/.test(code ?? '') || !name) continue;
  const key = `${code}|${name}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const [lng, lat] = f.geometry.coordinates;
  places.push([name, code, round(lng), round(lat)]);
}
places.sort((a, b) => (a[1] === b[1] ? (a[0] < b[0] ? -1 : 1) : a[1] < b[1] ? -1 : 1));

mkdirSync(OUT, { recursive: true });
const write = (file, data) => {
  const text = JSON.stringify(data);
  writeFileSync(join(OUT, file), text);
  console.log(file, `${(text.length / 1024).toFixed(0)} KB`);
};
write('countries.json', { v: 1, source: 'Natural Earth 110m (public domain)', countries: world });
write('cities.json', { v: 1, source: 'Natural Earth 10m populated places (public domain)', cities: places });
console.log('countries', world.length, '· cities', places.length);
