import { describe, expect, it } from 'vitest';
import { LANGUAGES, TRANSLATIONS } from '@/i18n/translations';
import { ko } from '@/i18n/dict/ko';
import {
  FREE_PLACE_PINS, PLACE_KEY, byContinent, canAddPin, countryAt, decodePlace, emptyPlace,
  encodePlace, isNewerPlace, isPlaceDate, placeFile, placePhotoIds, placeSummary, pointInRing,
  readPlaceFile, type CountryShape, type Pin, type PlaceData,
} from '../place';
import { MAP_NORTH, MAP_SOUTH, cityId, countryPath, fromTile, project, searchCities, unproject, toTile } from '../place-world';
import { clusterPins, tileZoom, tilesFor, tileUrl } from '../place-tiles';

/** A square country, one degree on a side, with its corner at (lng, lat). */
const box = (code: string, lng: number, lat: number, continent = 'Asia'): CountryShape => ({
  code,
  name: code,
  continent,
  rings: [[[lng, lat], [lng + 1, lat], [lng + 1, lat + 1], [lng, lat + 1], [lng, lat]]],
});

const pin = (id: string, over: Partial<Pin> = {}): Pin =>
  ({ id, name: id, category: 'other', lat: 0, lng: 0, createdAt: '', ...over });
const data = (over: Partial<PlaceData> = {}): PlaceData => ({ ...emptyPlace(), ...over });

describe('what a place record may hold', () => {
  it('keeps what it understands and drops the rest', () => {
    const out = decodePlace({
      version: 1,
      home: { countryCode: 'KR', cityId: 'KR-seoul' },
      countries: [
        { code: 'KR', lived: true, firstYear: 1985, note: '고향' },
        { code: 'kr' },
        { code: 'KR' },
        { code: 'ZZZ' },
        null,
      ],
      cities: [{ id: 'KR-seoul', name: 'Seoul', countryCode: 'KR', lat: 37.57, lng: 126.98 }, { id: 'bad' }],
      pins: [{ id: 'p1', name: '집', category: 'nonsense', lat: 99, lng: 0 }, { id: 'p2', name: '산', category: 'nature', lat: 37, lng: 127 }],
      updatedAt: 'then',
    });
    expect(out?.countries.map((c) => c.code)).toEqual(['KR']);
    expect(out?.cities.map((c) => c.id)).toEqual(['KR-seoul']);
    // A latitude of 99 is not a latitude.
    expect(out?.pins.map((p) => p.id)).toEqual(['p2']);
    expect(out?.home).toEqual({ countryCode: 'KR', cityId: 'KR-seoul' });
  });

  it('refuses anything that is not a record of ours', () => {
    expect(decodePlace(null)).toBeNull();
    expect(decodePlace({ version: 2 })).toBeNull();
    expect(isNewerPlace({ version: 2 })).toBe(true);
    expect(isNewerPlace({ version: 1 })).toBe(false);
  });

  it('stores one canonical shape, so load → save never changes a byte', () => {
    const once = encodePlace(data({
      pins: [pin('p1', { note: 'x', date: '2012-04-11', countryCode: 'JP', personIds: ['a', 'b'] })],
      countries: [{ code: 'JP', firstYear: 2012 }],
    }));
    expect(Object.keys(once.pins[0])).toEqual(['id', 'name', 'category', 'lat', 'lng', 'countryCode', 'date', 'note', 'personIds', 'createdAt']);
    expect(JSON.stringify(encodePlace(once))).toBe(JSON.stringify(once));
  });

  it('takes a date to the day or only to the year', () => {
    expect(isPlaceDate('2018')).toBe(true);
    expect(isPlaceDate('2018-06-02')).toBe(true);
    expect(isPlaceDate('2018-06')).toBe(false);
    expect(isPlaceDate('someday')).toBe(false);
    expect(isPlaceDate('1500')).toBe(false);
  });
});

describe('which country a point is in', () => {
  const shapes = [box('AA', 0, 0), box('BB', 10, 10)];

  it('finds the one whose shape contains it', () => {
    expect(countryAt(shapes, 0.5, 0.5)).toBe('AA');
    expect(countryAt(shapes, 10.5, 10.5)).toBe('BB');
  });

  it('says nothing out at sea', () => {
    expect(countryAt(shapes, 5, 5)).toBeNull();
    expect(countryAt([], 0.5, 0.5)).toBeNull();
  });

  it('is the plain ray-casting rule', () => {
    expect(pointInRing(0.5, 0.5, shapes[0].rings[0])).toBe(true);
    expect(pointInRing(1.5, 0.5, shapes[0].rings[0])).toBe(false);
  });
});

describe('the line above the map', () => {
  const shapes = [box('KR', 126, 37), box('JP', 138, 36), box('FR', 2, 48, 'Europe'), box('BR', -50, -10, 'South America')];

  it('counts countries, the share of the world, continents and cities', () => {
    const s = placeSummary(data({
      countries: [{ code: 'KR' }, { code: 'JP' }, { code: 'FR' }],
      cities: [{ id: 'a', name: 'Seoul', countryCode: 'KR', lat: 37, lng: 126 }],
      pins: [pin('p1')],
    }), shapes);
    expect(s).toEqual({ countries: 3, percent: 75, continents: 2, cities: 1, pins: 1 });
  });

  it('groups what has been visited by continent, in the reader\'s own names', () => {
    const out = byContinent(
      data({ countries: [{ code: 'FR' }, { code: 'KR', lived: true }] }),
      shapes,
      (code) => ({ FR: '프랑스', KR: '대한민국' }[code] ?? code),
    );
    expect(out).toEqual([
      { continent: 'Asia', countries: [{ code: 'KR', name: '대한민국', lived: true }] },
      { continent: 'Europe', countries: [{ code: 'FR', name: '프랑스', lived: false }] },
    ]);
  });
});

describe('the free plan', () => {
  it('counts pins, and never hides one', () => {
    const full = data({ pins: Array.from({ length: FREE_PLACE_PINS }, (_, i) => pin(`p${i}`)) });
    expect(canAddPin(full, false)).toBe(false);
    expect(canAddPin(full, true)).toBe(true);
    expect(full.pins).toHaveLength(FREE_PLACE_PINS);
  });
});

describe('the backup file', () => {
  const d = data({ pins: [pin('p1', { photo: 'ph000001' })], countries: [{ code: 'KR' }] });

  it('goes out and comes back whole', () => {
    const back = readPlaceFile(JSON.stringify(placeFile(d, { ph000001: 'data:image/png;base64,AA' }, new Date(0))));
    expect(back.place.pins.map((p) => p.id)).toEqual(['p1']);
    expect(back.photos).toEqual({ ph000001: 'data:image/png;base64,AA' });
    expect(placePhotoIds(d)).toEqual(['ph000001']);
  });

  it('is also read out of a whole-app backup, and refuses anything else', () => {
    const back = readPlaceFile(JSON.stringify({ app: '24h-circle-planner', data: { [PLACE_KEY]: JSON.stringify(d) } }));
    expect(back.place.countries).toHaveLength(1);
    expect(() => readPlaceFile('{"app":"something-else"}')).toThrow();
  });
});

describe('where a place lands on the page', () => {
  it('puts the top of the map at the Arctic and the bottom above the ice', () => {
    expect(project(-180, MAP_NORTH)).toEqual({ x: 0, y: 0 });
    expect(project(180, MAP_SOUTH)).toEqual({ x: 1, y: 1 });
    // Antarctica is below the bottom edge on purpose.
    expect(project(0, -80).y).toBeGreaterThan(1);
  });

  it('goes back the way it came', () => {
    for (const [lng, lat] of [[0, 0], [126.98, 37.57], [-74, 40.7]]) {
      const back = unproject(project(lng, lat).x, project(lng, lat).y);
      expect(back.lng).toBeCloseTo(lng, 6);
      expect(back.lat).toBeCloseTo(lat, 6);
    }
  });

  it('draws a country as one closed path per ring', () => {
    const d = countryPath(box('AA', 0, 0), 1000, 400);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.split('Z')).toHaveLength(2);
  });

  it('gives a city the same id every time', () => {
    expect(cityId('KR', 'Seoul')).toBe('KR-seoul');
    expect(cityId('US', 'New York')).toBe('US-new-york');
  });

  it('finds a city by what has been typed, nearest match first', () => {
    const rows = [
      { id: 'a', name: 'York', code: 'GB', lng: 0, lat: 0 },
      { id: 'b', name: 'New York', code: 'US', lng: 0, lat: 0 },
    ];
    expect(searchCities(rows, 'york').map((c) => c.id)).toEqual(['a', 'b']);
    expect(searchCities(rows, 'new').map((c) => c.id)).toEqual(['b']);
    expect(searchCities(rows, 'york', 8, 'US').map((c) => c.id)).toEqual(['b']);
    expect(searchCities(rows, '  ')).toEqual([]);
  });
});

describe('the tiles under the pins', () => {
  it('turns a place into a tile and back', () => {
    const t = toTile(126.98, 37.57, 10);
    const back = fromTile(t.x, t.y, 10);
    expect(back.lng).toBeCloseTo(126.98, 6);
    expect(back.lat).toBeCloseTo(37.57, 6);
  });

  it('covers the whole box, and never asks for a row that is not there', () => {
    const { z, tiles } = tilesFor({ lng: 0, lat: 0, zoom: 2 }, 800, 600);
    expect(z).toBe(2);
    expect(tiles.length).toBeGreaterThan(9);
    expect(tiles.every((t) => t.y >= 0 && t.y < 4 && t.x >= 0 && t.x < 4)).toBe(true);
  });

  it('names the tile service in exactly one place', () => {
    expect(tileUrl(3, 1, 2)).toBe('https://tile.openstreetmap.org/3/1/2.png');
    expect(tileZoom(2.4)).toBe(2);
    expect(tileZoom(-5)).toBe(0);
  });

  it('gathers pins that share a cell of the grid', () => {
    const near = [
      { pin: pin('a'), x: 60, y: 60 },
      { pin: pin('b'), x: 70, y: 70 },
      { pin: pin('c'), x: 400, y: 300 },
    ];
    const out = clusterPins(near);
    expect(out).toHaveLength(2);
    const both = out.find((c) => c.pins.length === 2);
    expect(both?.pins.map((p) => p.id)).toEqual(['a', 'b']);
    // The circle sits between the two it holds.
    expect(both?.x).toBeCloseTo(65, 6);
  });

  it('is a grid, so two pins either side of a line stay apart', () => {
    // Honest about what grid clustering is: a fixed grid, not a distance.
    const out = clusterPins([{ pin: pin('a'), x: 51, y: 10 }, { pin: pin('b'), x: 53, y: 10 }]);
    expect(out).toHaveLength(2);
  });
});

const PLACE_KEYS = Object.keys(ko).filter((k) => k === 'nav.place' || k.startsWith('place.'));

describe('the place map in every language', () => {
  it('has its words', () => {
    expect(PLACE_KEYS.length).toBeGreaterThan(50);
  });

  it.each(LANGUAGES.map((l) => l.code))('%s: every place key is there and not empty', (lang) => {
    const dict = TRANSLATIONS[lang] as Record<string, string | undefined>;
    expect(PLACE_KEYS.filter((k) => !dict[k]?.trim())).toEqual([]);
  });

  it.each(LANGUAGES.map((l) => l.code))('%s: keeps every {placeholder}', (lang) => {
    const dict = TRANSLATIONS[lang] as Record<string, string>;
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    expect(PLACE_KEYS.filter((k) => holes(dict[k]) !== holes((ko as Record<string, string>)[k]))).toEqual([]);
  });
});
