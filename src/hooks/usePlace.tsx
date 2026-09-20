import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPersisted, type PersistedCodec } from '@/hooks/usePersistedState';
import { persistLocal } from '@/lib/persistence';
import { deletePhoto } from '@/lib/calendar-photos';
import {
  PLACE_KEY, decodePlace, emptyPlace, encodePlace, isNewerPlace, newPinId, placePhotoIds,
  type CityVisit, type CountryVisit, type Pin, type PlaceData,
} from '@/lib/place';

export const placeCodec: PersistedCodec<PlaceData> = {
  decode: decodePlace,
  encode: encodePlace,
  fallback: emptyPlace,
};

/** How long a deleted pin can still be brought back. */
export const PLACE_UNDO_MS = 20_000;

export type PinDraft = Omit<Pin, 'id' | 'createdAt'>;

function dropPhoto(before: string | undefined, after?: string): void {
  if (before && before !== after) void deletePhoto(before);
}

function storedIsNewer(): boolean {
  try {
    const raw = localStorage.getItem(PLACE_KEY);
    return raw !== null && isNewerPlace(JSON.parse(raw));
  } catch {
    return false;
  }
}

/**
 * The place record. Saves go through persistLocal, so the header's save
 * indicator, its retry and the emergency backup cover this map too.
 */
export function usePlace() {
  const [data, setData] = useState<PlaceData>(() => loadPersisted(PLACE_KEY, placeCodec));
  const [readOnly, setReadOnly] = useState(storedIsNewer);
  const [generation, setGeneration] = useState(0);
  const loaded = useRef(data);
  useEffect(() => {
    if (data === loaded.current || readOnly) return;
    persistLocal(PLACE_KEY, encodePlace(data));
  }, [data, readOnly]);

  const current = useRef(data);
  useEffect(() => { current.current = data; }, [data]);

  const edit = useCallback((fn: (d: PlaceData) => PlaceData) => {
    setData((prev) => ({ ...fn(prev), updatedAt: new Date().toISOString() }));
  }, []);

  /** Colour a country in, or take the colour away. */
  const setCountry = useCallback((code: string, patch: Partial<CountryVisit> | null) => {
    edit((d) => {
      if (patch === null) return { ...d, countries: d.countries.filter((c) => c.code !== code) };
      const at = d.countries.findIndex((c) => c.code === code);
      if (at < 0) return { ...d, countries: [...d.countries, { code, ...patch }] };
      const next = [...d.countries];
      // An undefined in the patch means "take this away", which spreading
      // alone would not do.
      const merged = { ...next[at], ...patch, code } as CountryVisit;
      for (const key of Object.keys(patch) as Array<keyof CountryVisit>) {
        if (patch[key] === undefined) delete merged[key];
      }
      next[at] = merged;
      return { ...d, countries: next };
    });
  }, [edit]);

  /** Been there? (Colouring a country in is the one-tap version of setCountry.) */
  const toggleCountry = useCallback((code: string) => {
    const at = current.current.countries.find((c) => c.code === code);
    // Off, or wished-for, becomes been; been becomes off.
    setCountry(code, !at ? {} : at.wish ? { wish: undefined } : null);
  }, [setCountry]);

  /** Somewhere to go. Saying so takes away anything that said I had been. */
  const toggleWish = useCallback((code: string) => {
    const at = current.current.countries.find((c) => c.code === code);
    if (at?.wish) return setCountry(code, null);
    setCountry(code, { wish: true, lived: undefined, firstYear: undefined });
  }, [setCountry]);

  const addCity = useCallback((city: CityVisit) => {
    edit((d) => (d.cities.some((c) => c.id === city.id)
      ? d
      : {
        ...d,
        cities: [...d.cities, city],
        // A city is in a country, so the country has been visited.
        countries: d.countries.some((c) => c.code === city.countryCode)
          ? d.countries
          : [...d.countries, { code: city.countryCode }],
      }));
  }, [edit]);

  const updateCity = useCallback((id: string, patch: Partial<CityVisit>) => {
    edit((d) => ({ ...d, cities: d.cities.map((c) => (c.id === id ? { ...c, ...patch, id } : c)) }));
  }, [edit]);

  const removeCity = useCallback((id: string) => {
    edit((d) => ({ ...d, cities: d.cities.filter((c) => c.id !== id) }));
  }, [edit]);

  const setHome = useCallback((home: PlaceData['home']) => {
    edit((d) => {
      const next = { ...d };
      if (home) {
        next.home = home;
        // Home is somewhere lived, so the country is coloured in as lived.
        const at = next.countries.findIndex((c) => c.code === home.countryCode);
        next.countries = at < 0
          ? [...next.countries, { code: home.countryCode, lived: true }]
          : next.countries.map((c) => (c.code === home.countryCode ? { ...c, lived: true } : c));
      } else {
        delete next.home;
      }
      return next;
    });
  }, [edit]);

  const addPin = useCallback((draft: PinDraft): string => {
    const id = newPinId();
    edit((d) => ({
      ...d,
      pins: [...d.pins, { ...draft, id, createdAt: new Date().toISOString() }],
      // A pin lands in a country, so that country is coloured in.
      countries: draft.countryCode && !d.countries.some((c) => c.code === draft.countryCode)
        ? [...d.countries, { code: draft.countryCode }]
        : d.countries,
    }));
    return id;
  }, [edit]);

  const updatePin = useCallback((id: string, draft: PinDraft) => {
    dropPhoto(current.current.pins.find((p) => p.id === id)?.photo, draft.photo);
    edit((d) => ({
      ...d,
      pins: d.pins.map((p) => (p.id === id ? { ...draft, id, createdAt: p.createdAt } : p)),
    }));
  }, [edit]);

  const removePin = useCallback((id: string): { pin: Pin; at: number } | null => {
    const at = current.current.pins.findIndex((p) => p.id === id);
    const pin = at < 0 ? null : current.current.pins[at];
    edit((d) => ({ ...d, pins: d.pins.filter((p) => p.id !== id) }));
    if (pin?.photo) {
      const photo = pin.photo;
      window.setTimeout(() => {
        if (!current.current.pins.some((p) => p.photo === photo)) void deletePhoto(photo);
      }, PLACE_UNDO_MS);
    }
    return pin ? { pin, at } : null;
  }, [edit]);

  const restorePin = useCallback((pin: Pin, at: number) => {
    edit((d) => {
      if (d.pins.some((p) => p.id === pin.id)) return d;
      const pins = [...d.pins];
      pins.splice(Math.max(0, Math.min(at, pins.length)), 0, pin);
      return { ...d, pins };
    });
  }, [edit]);

  const replace = useCallback((next: PlaceData) => {
    const keep = new Set(placePhotoIds(next));
    placePhotoIds(current.current).filter((id) => !keep.has(id)).forEach((id) => void deletePhoto(id));
    setData(next);
    setReadOnly(false);
    setGeneration((g) => g + 1);
  }, []);

  return {
    data, readOnly, generation, setCountry, toggleCountry, toggleWish, addCity, updateCity, removeCity,
    setHome, addPin, updatePin, removePin, restorePin, replace,
  };
}

export type PlaceApi = ReturnType<typeof usePlace>;
