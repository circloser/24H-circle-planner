import { describe, expect, it } from 'vitest';
import { LOOKUP_LIMIT, lookupUrl, parsePlaces } from '../place-geocode';

/** One answer, shaped the way Nominatim shapes them. */
const wire = (over: Record<string, unknown> = {}) => ({
  name: '창녕읍',
  display_name: '창녕읍, 창녕군, 경상남도, 50328, 대한민국',
  lat: '35.5447',
  lon: '128.4922',
  osm_type: 'relation',
  osm_id: 2534091,
  addresstype: 'town',
  address: { country_code: 'kr' },
  ...over,
});

describe('where a search is sent', () => {
  it('asks in the reader\'s own language, and only for places people live', () => {
    const url = new URL(lookupUrl(' 창녕 ', 'ko'));
    expect(url.origin).toBe('https://nominatim.openstreetmap.org');
    expect(url.searchParams.get('q')).toBe('창녕');
    expect(url.searchParams.get('accept-language')).toBe('ko');
    // Without this a search for 창녕 answers with a road and a police station.
    expect(url.searchParams.get('featureType')).toBe('settlement');
    expect(url.searchParams.get('limit')).toBe(String(LOOKUP_LIMIT));
  });

  it('carries the words typed and nothing else', () => {
    const url = new URL(lookupUrl('서천', 'ko'));
    const sent = [...url.searchParams.keys()].sort();
    expect(sent).toEqual(['accept-language', 'addressdetails', 'featureType', 'format', 'limit', 'q']);
  });
});

describe('what comes back', () => {
  it('keeps the name, the country and where it is', () => {
    const [place] = parsePlaces([wire()]);
    expect(place).toMatchObject({
      name: '창녕읍',
      code: 'KR',
      lat: 35.5447,
      lng: 128.4922,
    });
    // The rest of the long name says which 창녕 this one is.
    expect(place.detail).toBe('창녕군, 경상남도, 50328, 대한민국');
  });

  it('gives it an id of its own, so it never collides with the bundled list', () => {
    const [place] = parsePlaces([wire()]);
    expect(place.id.startsWith('u_')).toBe(true);
    // The same place, asked for twice, is the same place.
    expect(parsePlaces([wire()])[0].id).toBe(place.id);
    expect(parsePlaces([wire({ osm_id: 99 })])[0].id).not.toBe(place.id);
  });

  it('drops an answer it could not put on a map', () => {
    expect(parsePlaces([wire({ lat: 'nowhere' })])).toEqual([]);
    expect(parsePlaces([wire({ lat: '95' })])).toEqual([]);
    expect(parsePlaces([wire({ address: null })])).toEqual([]);
    expect(parsePlaces([wire({ name: '', display_name: '' })])).toEqual([]);
  });

  it('is unbothered by an answer that is not one', () => {
    expect(parsePlaces(null)).toEqual([]);
    expect(parsePlaces({ error: 'no' })).toEqual([]);
    expect(parsePlaces(['nonsense'])).toEqual([]);
  });

  it('says the same place once', () => {
    expect(parsePlaces([wire(), wire(), wire({ osm_id: 7 })])).toHaveLength(2);
  });

  it('never shows more than it said it would', () => {
    const many = Array.from({ length: 30 }, (_, i) => wire({ osm_id: i }));
    expect(parsePlaces(many)).toHaveLength(LOOKUP_LIMIT);
  });

  it('falls back to the first part of the long name when there is no short one', () => {
    const [place] = parsePlaces([wire({ name: undefined })]);
    expect(place.name).toBe('창녕읍');
  });
});
