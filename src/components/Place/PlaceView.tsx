import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { dismissAfterVisible } from '@/lib/toast-dismiss';
import { Crosshair, Flame, House, Loader2, Minus, Palette, Plus, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { useSyncStatus } from '@/hooks/useSync';
import { COLOR_THEMES } from '@/data/color-themes';
import { requestUpgrade } from '@/lib/pro';
import { track, trackFeature, trackOnce } from '@/lib/track';
import {
  FREE_PLACE_PINS, MAX_PLACE_SHORTCUTS, PIN_CATEGORIES, byContinent, canAddPin, countryAt,
  placeSummary, shortcutPins, type CountryShape, type PinCategory,
} from '@/lib/place';
import { countryName, loadCities, loadWorld, searchCountries, toTile, type CityRow } from '@/lib/place-world';
import { PIN_MAX_ZOOM, PIN_MIN_ZOOM, TILE_SIZE, tileZoom, type Camera } from '@/lib/place-tiles';
import {
  CITY_DOT_ZOOM, GLOBE_MIN_ZOOM, facing, globeZoomForTile, project, screenOf,
  type Camera as GlobeCamera,
} from '@/lib/place-globe';
import { cardAt, shapeCentre } from '@/lib/place-anchor';
import { usePlace, PLACE_UNDO_MS } from '@/hooks/usePlace';
import { PLACE_EXPORT_EVENT } from '@/lib/place-export';
import { readRelationPeople } from '@/lib/place-relation';
import { guessYear, placeGuesses, readLifeRecord } from '@/lib/life-place';
import { GlobeMap } from './GlobeMap';
import { PinMap } from './PinMap';
import { CountryCard, PinCard } from './PlacePanel';
import { PinDialog, CityPicker, type PinTarget } from './PlaceDialogs';
import { PlaceExportDialog } from './PlaceExport';
import { PlaceColorsDialog } from './PlaceColors';
import { placeColors } from '@/lib/place-colors';
import { PIN_ICON, PIN_LABEL, continentName, visitedColor, wishedColor } from './palette';

const LAST_TAB = '24h-place-tab';

/**
 * The one place the two views meet.
 *
 * The globe stops where a tile map at PIN_MIN_ZOOM begins, and the tile map
 * stops where the globe can take over — the same scale from both sides, so
 * crossing it is a change of drawing rather than a jump of distance. Which of
 * them is showing is therefore only ever a matter of how far in you are.
 */
const GLOBE_FROM_PIN = (w: number, h: number) => globeZoomForTile(w, h);

/** A floating control over the map, in the page's own colours. */
const FLOAT = 'pointer-events-auto rounded-full border border-border bg-surface/92 shadow-sm backdrop-blur';

/**
 * Place — where a life has actually happened, and the only page here that is
 * a map first and a page second.
 *
 * It fills the window the way a map application does: the world underneath,
 * everything else floating over it. Two views under one tab — a globe to
 * colour in, which needs no network at all, and a pin map over real tiles.
 * Everything is put here by hand.
 */
export function PlaceView() {
  const api = usePlace();
  const { data } = api;
  const { t, lang } = useTranslation();
  const { prefs } = usePreferences();
  const pro = useAuth().plan === 'pro';
  const syncing = useSyncStatus().status !== 'disabled';
  const theme = COLOR_THEMES.some((th) => th.id === prefs.colorTheme) ? prefs.colorTheme : null;
  // What the map is drawn in: the theme's own two colours, unless this record
  // says otherwise (lib/place-colors).
  const colors = useMemo(
    () => placeColors(data.palette, { visited: visitedColor(theme), wished: wishedColor(theme) }),
    [data.palette, theme],
  );
  const visited = colors.visited;
  const wished = colors.wished;

  const [tab, setTab] = useState<'world' | 'pins'>(() => {
    try {
      return localStorage.getItem(LAST_TAB) === 'pins' ? 'pins' : 'world';
    } catch {
      return 'world';
    }
  });
  const [shapes, setShapes] = useState<readonly CountryShape[]>([]);
  const [cityRows, setCityRows] = useState<readonly CityRow[]>([]);
  const [country, setCountry] = useState<string | null>(null);
  const [pinId, setPinId] = useState<string | null>(null);
  const [target, setTarget] = useState<PinTarget | null>(null);
  const [exporting, setExporting] = useState(false);
  const [colouring, setColouring] = useState(false);
  /** Which of the corner's lists is unfolded, if any: only ever one. */
  const [openList, setOpenList] = useState<'shortcuts' | 'filter' | null>(null);
  const [only, setOnly] = useState<Set<PinCategory>>(() => new Set());
  const [heat, setHeat] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // The globe opens looking at home, when there is a home to look at. The
  // record is already loaded by the time this runs, so it is decided once.
  const [globe, setGlobe] = useState<GlobeCamera>(() => {
    const at = api.data.home?.cityId
      ? api.data.cities.find((c) => c.id === api.data.home!.cityId)
      : undefined;
    return { lng: at?.lng ?? 20, lat: at?.lat ?? 20, zoom: 1 };
  });
  // The tile map no longer holds the whole world — the globe does — so it
  // opens where the person lives rather than in the middle of the Sahara.
  const [camera, setCamera] = useState<Camera>(() => {
    const at = api.data.home?.cityId
      ? api.data.cities.find((c) => c.id === api.data.home!.cityId)
      : undefined;
    return { lng: at?.lng ?? 10, lat: at?.lat ?? 25, zoom: at ? 9 : PIN_MIN_ZOOM };
  });
  const [here, setHere] = useState<{ lng: number; lat: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [askedLife, setAskedLife] = useState(false);
  const [homeAsked, setHomeAsked] = useState(false);

  // How big the map is drawn, which is what decides the scale the globe and
  // the tiles meet at.
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    measure();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const globeStop = GLOBE_FROM_PIN(size.w, size.h);

  useEffect(() => { trackOnce('place_open'); }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-page', 'place');
    return () => document.documentElement.removeAttribute('data-page');
  }, []);
  useEffect(() => {
    try { localStorage.setItem(LAST_TAB, tab); } catch { /* storage unavailable */ }
  }, [tab]);


  // The world and the city list ship with the app; both are fetched once.
  useEffect(() => {
    let alive = true;
    void loadWorld().then((w) => { if (alive) setShapes(w); });
    void loadCities().then((c) => { if (alive) setCityRows(c); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const open = () => setExporting(true);
    window.addEventListener(PLACE_EXPORT_EVENT, open);
    return () => window.removeEventListener(PLACE_EXPORT_EVENT, open);
  }, []);

  const people = useMemo(() => readRelationPeople(), []);
  const life = useMemo(() => readLifeRecord(), []);
  const nameOf = useCallback((code: string, fallback: string) => countryName(code, fallback, lang), [lang]);

  const summary = placeSummary(data, shapes);
  const shape = country ? shapes.find((s) => s.code === country) ?? null : null;
  const pin = pinId ? data.pins.find((p) => p.id === pinId) ?? null : null;
  /** Every pin, or only the kinds asked for. Both maps read this, and so
   *  does the heat: filtering a map that shows warmth should cool it. */
  const pins = useMemo(
    () => (only.size ? data.pins.filter((p) => only.has(p.category)) : data.pins),
    [data.pins, only],
  );
  const found = useMemo(
    () => (query.trim() ? searchCountries(shapes, query, lang) : []),
    [shapes, query, lang],
  );
  const guesses = useMemo(
    () => (askedLife ? [] : placeGuesses(life, cityRows, data)),
    [life, cityRows, data, askedLife],
  );
  const grouped = byContinent(data, shapes, nameOf);
  // The shortcut rail: where I live, then whatever has been starred. Ten at
  // most — past that it is a list, not a row of buttons.
  const homeCity = data.home?.cityId ? data.cities.find((c) => c.id === data.home!.cityId) : undefined;
  const starred = shortcutPins(data);
  const railFull = starred.length >= MAX_PLACE_SHORTCUTS;

  /** Go there: the map moves, close in, and the pin opens its own card. */
  const goTo = (lng: number, lat: number, id?: string) => {
    setCamera((c) => ({ lng, lat, zoom: Math.max(c.zoom, 13) }));
    setPinId(id ?? null);
    track('place_shortcut');
  };

  const dropAt = (lng: number, lat: number) => {
    if (!canAddPin(data, pro)) {
      toast(t('place.limit.pins', { n: String(FREE_PLACE_PINS) }));
      requestUpgrade('place');
      return;
    }
    const code = countryAt(shapes, lng, lat);
    setTarget({ mode: 'add', lat, lng, ...(code ? { countryCode: code } : {}) });
  };

  const removePin = (id: string) => {
    const gone = api.removePin(id);
    setTarget(null);
    setPinId(null);
    if (!gone) return;
    // Sonner stops its own clock while a finger or a pointer rests on the
    // toast, and on a touch screen that pause outlives the touch — so the
    // undo offer is closed on a timer of our own, which ignores the pointer.
    dismissAfterVisible(toast(t('place.deleted'), {
      action: { label: t('sync.undo'), onClick: () => api.restorePin(gone.pin, gone.at) },
      duration: PLACE_UNDO_MS,
    }), PLACE_UNDO_MS);
  };

  /**
   * Where am I? Asked for by pressing this, answered once, and never asked
   * again on its own. The answer is not stored anywhere — it moves the map
   * and draws a dot, and that is all.
   */
  const locate = () => {
    if (!navigator.geolocation) return toast.error(t('place.locateFailed'));
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const at = { lng: pos.coords.longitude, lat: pos.coords.latitude };
        setHere(at);
        setCamera((c) => ({ ...at, zoom: Math.max(c.zoom, 12) }));
        // The globe turns to it too, and comes close enough for the place to
        // be a place rather than a continent — whichever view is showing, the
        // answer to "where am I" is on screen.
        setGlobe((gl) => ({ ...at, zoom: Math.max(gl.zoom, Math.min(globeStop, CITY_DOT_ZOOM * 1.6)) }));
        setLocating(false);
        track('place_locate');
      },
      () => {
        setLocating(false);
        toast(t('place.locateFailed'));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  /**
   * The two views are one view, zoomed differently.
   *
   * Brought in past the globe's last stop, the world becomes tiles at the
   * same place; taken out past the tile map's first stop, the tiles become
   * the globe again. Each hands over at the far end of its own range and
   * arrives comfortably inside the other's, so they never bounce.
   */
  const toPins = (at: { lng: number; lat: number }) => {
    trackFeature('globe');
    setCamera({ ...at, zoom: PIN_MIN_ZOOM });
    setCountry(null);
    setTab('pins');
  };
  const toGlobe = (at: { lng: number; lat: number }) => {
    setGlobe({ ...at, zoom: globeStop });
    setPinId(null);
    setTab('world');
  };

  /** The globe's camera, unless it has been zoomed in past its own end. */
  const onGlobeCamera = (next: GlobeCamera) => {
    if (next.zoom > globeStop) return toPins(next);
    setGlobe(next);
  };
  /** The tile map's camera, unless it has been zoomed out past its own end. */
  const onPinCamera = (next: Camera) => {
    if (next.zoom < PIN_MIN_ZOOM) return toGlobe(next);
    setCamera(next);
  };

  const zoomBy = (by: number) => {
    if (tab === 'world') {
      // The last step in lands exactly on the stop, so the globe is left at
      // the tile map's own scale; the step after that is the step across, and
      // nothing appears to move as the drawing changes.
      if (by > 0 && globe.zoom >= globeStop - 0.001) return toPins(globe);
      const next = globe.zoom * (by > 0 ? 1.4 : 1 / 1.4);
      setGlobe((g) => ({ ...g, zoom: Math.max(GLOBE_MIN_ZOOM, Math.min(globeStop, next)) }));
    } else {
      const next = camera.zoom + by;
      if (next < PIN_MIN_ZOOM) return toGlobe(camera);
      setCamera((c) => ({ ...c, zoom: Math.min(PIN_MAX_ZOOM, next) }));
    }
  };

  const panel = (shape && tab === 'world') || !!pin;
  /**
   * A card opens beside the thing it is about, on the map itself.
   *
   * On a narrow screen it is still a sheet across the bottom — there is
   * nowhere else for it to be — but on a wide one it stands next to the
   * country or the pin, and the controls in the corner never move for it.
   */
  const wide = size.w >= 900;
  const CARD = { w: 340, h: Math.min(460, Math.max(220, size.h - 24)) };
  const at = (() => {
    if (!wide || !size.w || !size.h) return null;
    if (pin) {
      if (tab === 'pins') {
        const z = tileZoom(camera.zoom);
        const middle = toTile(camera.lng, camera.lat, z);
        const spot = toTile(pin.lng, pin.lat, z);
        return {
          x: size.w / 2 + (spot.x - middle.x) * TILE_SIZE,
          y: size.h / 2 + (spot.y - middle.y) * TILE_SIZE,
        };
      }
      if (!facing(pin.lng, pin.lat, globe)) return null;
      return project(pin.lng, pin.lat, globe, screenOf(size.w, size.h, globe.zoom));
    }
    if (!shape || tab !== 'world') return null;
    const middle = shapeCentre(shape);
    if (!facing(middle.lng, middle.lat, globe)) return null;
    return project(middle.lng, middle.lat, globe, screenOf(size.w, size.h, globe.zoom));
  })();
  const spot = at ? cardAt(at, size, CARD) : null;

  return (
    <div className="relative min-h-0 w-full flex-1 overflow-hidden" data-place-view>
      <h2 className="sr-only">{t('place.title')}</h2>

      {/* The map is the page. */}
      <div ref={box} className="absolute inset-0" inert={api.readOnly || undefined}>
        {tab === 'world' ? (
          <GlobeMap
            shapes={shapes}
            countries={data.countries}
            cities={data.cities}
            places={cityRows}
            pins={pins}
            {...(data.home?.cityId ? { homeCityId: data.home.cityId } : {})}
            visited={visited}
            wished={wished}
            selected={country}
            selectedPin={pinId}
            heat={heat}
            pinColors={colors.pin}
            here={here}
            maxZoom={globeStop}
            camera={globe}
            onCamera={onGlobeCamera}
            onSelect={(code) => { setCountry(code); setPinId(null); }}
            onSelectPin={(id) => { setPinId(id); if (id) setCountry(null); }}
            nameOf={nameOf}
          />
        ) : (
          <PinMap
            pins={pins}
            camera={camera}
            onCamera={onPinCamera}
            pinColors={colors.pin}
            selected={pinId}
            onSelect={setPinId}
            onDropAt={dropAt}
            here={here}
          />
        )}
      </div>

      {/* Everything else floats over it. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col p-2 sm:p-3">
        <div className="mt-auto flex flex-col items-center gap-2">
          {/* What the life line seems to say. Only ever an offer. */}
          {tab === 'world' && guesses.length > 0 && (
            <section className={`${FLOAT} max-w-[560px] p-3`} data-place-life-ask>
              <p className="text-center text-[13px] text-muted-foreground">
                {t('place.importFromLife', { n: String(guesses.length) })}
              </p>
              <ul className="mt-2 flex flex-wrap justify-center gap-1.5">
                {guesses.map(({ milestone, city }) => {
                  const on = picked.has(city.id);
                  return (
                    <li key={city.id}>
                      <button type="button" data-place-guess={city.id} aria-pressed={on}
                        onClick={() => setPicked((was) => {
                          const next = new Set(was);
                          if (!next.delete(city.id)) next.add(city.id);
                          return next;
                        })}
                        className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] ${
                          on ? 'border-foreground text-foreground' : 'border-border text-muted-foreground'}`}>
                        {city.name}
                        <span className="text-muted-foreground">{milestone.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex justify-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setAskedLife(true)}>{t('common.close')}</Button>
                <Button size="sm" variant="outline" disabled={picked.size === 0} data-place-import-life
                  onClick={() => {
                    for (const { milestone, city } of guesses) {
                      if (!picked.has(city.id)) continue;
                      const year = guessYear(milestone);
                      api.addCity({
                        id: city.id, name: city.name, countryCode: city.code, lat: city.lat, lng: city.lng,
                        ...(year !== undefined ? { firstYear: year } : {}),
                        ...(milestone.category === 'home' ? { lived: true } : {}),
                      });
                    }
                    setPicked(new Set());
                    setAskedLife(true);
                    track('place_city');
                    toast.success(t('place.imported'));
                  }}>
                  {t('place.importApply')}
                </Button>
              </div>
            </section>
          )}

          {/* Where home is, asked once and then never again. */}
          {tab === 'world' && !data.home && !homeAsked && shapes.length > 0 && guesses.length === 0 && (
            <section className={`${FLOAT} w-full max-w-sm p-3`} data-place-home-ask>
              <div className="flex items-center gap-2">
                <p className="flex-1 text-[13px] text-muted-foreground">{t('place.home.ask')}</p>
                <button type="button" aria-label={t('common.close')} data-place-home-close
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent/20"
                  onClick={() => setHomeAsked(true)}>
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2">
                <CityPicker rows={cityRows} label={t('place.searchCity')}
                  onPick={(city) => {
                    api.addCity({ id: city.id, name: city.name, countryCode: city.code, lat: city.lat, lng: city.lng, lived: true });
                    api.setHome({ countryCode: city.code, cityId: city.id });
                    setGlobe((g) => ({ ...g, lng: city.lng, lat: city.lat }));
                    track('place_home');
                  }} />
              </div>
            </section>
          )}

          {/* On the pin view this sits above OpenStreetMap's credit, which
              has the bottom-right corner to itself. */}
          <p className={`${FLOAT} px-3 py-1 text-center text-[12px] text-muted-foreground ${tab === 'pins' ? 'mb-4' : ''}`}
            data-place-summary>
            {[
              t('place.sum.countries', { n: String(summary.countries) }),
              t('place.sum.percent', { n: String(summary.percent) }),
              t('place.sum.continents', { n: String(summary.continents) }),
              t('place.sum.cities', { n: String(summary.cities) }),
              summary.wished ? t('place.sum.wish', { n: String(summary.wished) }) : null,
              tab === 'pins' ? t('place.sum.pins', { n: String(summary.pins) }) : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {/* Every control on this page, in the one corner a thumb reaches.
          Each list unfolds sideways from its own button rather than stacking
          upward, so the corner stays the size of the corner. */}
      {/* It does not move for anything: a card opens beside what it is about
          (see `cardAt`), which is never this corner. */}
      <div data-place-corner
        className="pointer-events-none absolute bottom-7 right-2 z-10 flex flex-col items-end gap-1.5 sm:bottom-8 sm:right-3">

        {/* Looking for a country, on the globe. */}
        {tab === 'world' && (
          <div className="flex items-center justify-end gap-1.5">
            {searching && (
              <span className={`${FLOAT} pointer-events-auto inline-flex items-center gap-1 px-1`}>
                <Input autoFocus value={query} data-place-search placeholder={t('place.searchCountry')}
                  className="h-9 w-44 border-0 bg-transparent" onChange={(e) => setQuery(e.target.value)} />
                {found.length > 0 && (
                  <ul className="flex max-w-[40vw] items-center gap-1 overflow-x-auto" data-place-found>
                    {found.map((s) => (
                      <li key={s.code}>
                        <button type="button" data-place-found-item={s.code}
                          className="min-h-8 whitespace-nowrap rounded-full px-2.5 text-[13px] hover:bg-accent/20"
                          onClick={() => { setCountry(s.code); setQuery(''); setSearching(false); }}>
                          {nameOf(s.code, s.name)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </span>
            )}
            <button type="button" data-place-search-open aria-pressed={searching}
              aria-label={t('place.searchCountry')} title={t('place.searchCountry')}
              className={`${FLOAT} pointer-events-auto grid h-11 w-11 place-items-center hover:bg-accent/20 ${
                searching ? 'text-foreground' : 'text-muted-foreground'}`}
              onClick={() => { if (!searching) trackFeature('search'); setQuery(''); setSearching((v) => !v); }}>
              {searching ? <X aria-hidden className="h-4 w-4" /> : <Search aria-hidden className="h-4 w-4" />}
            </button>
          </div>
        )}

        {/* The colours it is all drawn in. */}
        <button type="button" data-place-colors aria-label={t('place.colors.open')} title={t('place.colors.open')}
          className={`${FLOAT} pointer-events-auto grid h-11 w-11 place-items-center text-muted-foreground hover:bg-accent/20`}
          onClick={() => { trackFeature('filter'); setColouring(true); }}>
          <Palette aria-hidden className="h-4 w-4" />
        </button>

        {/* The same record read as warmth: where the pins gather. */}
        {tab === 'world' && (
          <button type="button" data-place-heat aria-pressed={heat}
            aria-label={t(heat ? 'place.heatOff' : 'place.heat')} title={t(heat ? 'place.heatOff' : 'place.heat')}
            className={`${FLOAT} pointer-events-auto grid h-11 w-11 place-items-center hover:bg-accent/20 ${
              heat ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            onClick={() => { if (!heat) trackFeature('heat'); setHeat((v) => !v); }}>
            {/* Alight, the button is struck through: the same flame, and what
                pressing it now does. */}
            <span aria-hidden className="relative grid h-4 w-4 place-items-center">
              <Flame className="h-4 w-4" />
              {heat && <span data-place-heat-off className="absolute h-[1.5px] w-5 rotate-45 rounded-full bg-current" />}
            </span>
          </button>
        )}

        {/* Which kinds of pin to show. */}
        {tab === 'pins' && data.pins.length > 0 && (
          <div className="flex items-center justify-end gap-1.5">
            {/* The list wraps rather than scrolling sideways: a row of kinds
                that has to be dragged hides the very ones being looked for. */}
            {openList === 'filter' && (
              <ul data-place-filters
                className={`${FLOAT} pointer-events-auto flex max-w-[min(78vw,560px)] flex-wrap items-center justify-end gap-1 p-1`}>
                <li>
                  <button type="button" data-place-filter="all" aria-pressed={only.size === 0}
                    onClick={() => setOnly(new Set())}
                    className={`min-h-9 whitespace-nowrap rounded-full px-3 text-[12px] ${
                      only.size === 0 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                    {t('place.filterAll')}
                  </button>
                </li>
                {PIN_CATEGORIES.map((c) => {
                  const on = only.has(c);
                  const Icon = PIN_ICON[c];
                  const n = data.pins.filter((p) => p.category === c).length;
                  return (
                    <li key={c}>
                      <button type="button" data-place-filter={c} aria-pressed={on} disabled={n === 0}
                        onClick={() => setOnly((was) => {
                          const next = new Set(was);
                          if (!next.delete(c)) next.add(c);
                          if (next.size) trackFeature('filter');
                          return next;
                        })}
                        className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12px] disabled:opacity-40 ${
                          on ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                        <Icon aria-hidden className="h-3.5 w-3.5" />
                        {t(PIN_LABEL[c])}
                        <span className="tabular-nums">{n}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button type="button" data-place-filter-toggle aria-expanded={openList === 'filter'}
              aria-label={t('place.filter')} title={t('place.filter')}
              className={`${FLOAT} pointer-events-auto relative grid h-11 w-11 place-items-center hover:bg-accent/20 ${
                only.size ? 'text-foreground' : 'text-muted-foreground'}`}
              onClick={() => setOpenList((o) => (o === 'filter' ? null : 'filter'))}>
              <SlidersHorizontal aria-hidden className="h-4 w-4" />
              {only.size > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {only.size}
                </span>
              )}
            </button>
          </div>
        )}

        {/* The places worth one press, in a row rather than a block. */}
        {tab === 'pins' && (homeCity || starred.length > 0) && (
          <div className="flex items-center justify-end gap-1.5">
            {openList === 'shortcuts' && (
              <ul data-place-rail
                className={`${FLOAT} pointer-events-auto flex max-w-[min(70vw,560px)] items-center gap-1 overflow-x-auto p-1`}>
                {homeCity && (
                  <li>
                    <button type="button" data-place-shortcut="home"
                      className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12px] text-foreground hover:bg-accent/20"
                      onClick={() => goTo(homeCity.lng, homeCity.lat)}>
                      <House aria-hidden className="h-3.5 w-3.5" />
                      {homeCity.name}
                    </button>
                  </li>
                )}
                {starred.map((p) => {
                  const Icon = PIN_ICON[p.category];
                  return (
                    <li key={p.id}>
                      <button type="button" data-place-shortcut={p.id}
                        className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12px] hover:bg-accent/20 ${
                          pinId === p.id ? 'bg-primary text-primary-foreground' : 'text-foreground'}`}
                        onClick={() => goTo(p.lng, p.lat, p.id)}>
                        <Icon aria-hidden className="h-3.5 w-3.5" />
                        {p.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <button type="button" data-place-rail-toggle aria-expanded={openList === 'shortcuts'}
              aria-label={t('place.shortcut')} title={t('place.shortcut')}
              className={`${FLOAT} pointer-events-auto grid h-11 w-11 place-items-center text-foreground hover:bg-accent/20`}
              onClick={() => setOpenList((o) => (o === 'shortcuts' ? null : 'shortcuts'))}>
              <Star aria-hidden className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Where I am — on the globe as much as on the tiles. */}
        <button type="button" data-place-locate disabled={locating} onClick={locate}
          aria-label={t('place.locate')} title={t('place.locate')}
          className={`${FLOAT} pointer-events-auto grid h-11 w-11 place-items-center text-foreground hover:bg-accent/20 disabled:opacity-60`}>
          {locating
            ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            : <Crosshair aria-hidden className="h-4 w-4" />}
        </button>
        <div className={`${FLOAT} pointer-events-auto flex flex-col overflow-hidden`}>
          <button type="button" aria-label={t('place.zoomIn')} title={t('place.zoomIn')} data-place-zoom-in
            className="grid h-11 w-11 place-items-center text-muted-foreground hover:bg-accent/20"
            onClick={() => zoomBy(1)}>
            <Plus aria-hidden className="h-4 w-4" />
          </button>
          <button type="button" aria-label={t('place.zoomOut')} title={t('place.zoomOut')} data-place-zoom-out
            className="grid h-11 w-11 place-items-center border-t border-border text-muted-foreground hover:bg-accent/20"
            onClick={() => zoomBy(-1)}>
            <Minus aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* The card for whatever is chosen: a column on the right of a wide
          screen, a sheet across the bottom of a narrow one. */}
      {panel && (
        <div data-place-card
          className={wide
            ? 'pointer-events-auto absolute z-20 overflow-y-auto rounded-2xl border border-border shadow-xl'
            : 'pointer-events-auto absolute inset-x-0 bottom-0 max-h-[60%] overflow-y-auto'}
          style={wide
            ? { width: CARD.w, maxHeight: CARD.h, left: spot?.left ?? size.w - CARD.w - 76, top: spot?.top ?? 12 }
            : undefined}>
          {shape && tab === 'world' && (
            <CountryCard
              shape={shape}
              visit={data.countries.find((c) => c.code === shape.code)}
              data={data}
              cityRows={cityRows}
              name={nameOf(shape.code, shape.name)}
              floating={wide}
              onToggle={() => { api.toggleCountry(shape.code); track('place_country'); }}
              onWish={() => { api.toggleWish(shape.code); track('place_country'); }}
              onPatch={(patch) => api.setCountry(shape.code, patch)}
              onAddCity={(city) => { api.addCity(city); track('place_city'); }}
              onRemoveCity={api.removeCity}
              onClose={() => setCountry(null)}
              onOpenPin={(id) => { setTab('pins'); setPinId(id); }}
            />
          )}
          {pin && (
            <PinCard
              pin={pin}
              people={people}
              railFull={railFull}
              floating={wide}
              colour={colors.pin[pin.category]}
              onClose={() => setPinId(null)}
              onEdit={() => setTarget({ mode: 'edit', pin })}
              onStar={() => api.toggleStar(pin.id)}
              onDelete={() => removePin(pin.id)}
            />
          )}
        </div>
      )}

      {/* The map is a picture; these are the page for a keyboard and a screen
          reader. The globe carries its own list of every country. */}
      <div className="sr-only" data-place-list>
        {tab === 'world'
          ? grouped.map((group) => (
            <section key={group.continent}>
              <h3>{continentName(group.continent, t)}</h3>
              <ul>
                {group.countries.map((c) => (
                  <li key={c.code}>
                    <button type="button" data-place-list-item={c.code} onClick={() => setCountry(c.code)}>
                      {c.name}{c.wish ? ` · ${t('place.wish')}` : c.lived ? ` · ${t('place.lived')}` : ''}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
          : (
            <ul>
              {[...pins].reverse().map((p) => (
                <li key={p.id}>
                  <button type="button" data-place-list-item={p.id} onClick={() => setPinId(p.id)}>
                    {p.name} · {t(PIN_LABEL[p.category])}
                  </button>
                </li>
              ))}
            </ul>
          )}
        <p>{t('place.privacy.hint')}</p>
      </div>

      <PinDialog target={target} pro={pro} syncing={syncing} people={people}
        onClose={() => setTarget(null)}
        onSave={(draft, id) => {
          if (id) api.updatePin(id, draft);
          else {
            setPinId(api.addPin(draft));
            track('place_pin');
          }
          setTarget(null);
        }}
        onDelete={removePin} />
      <PlaceColorsDialog open={colouring} onOpenChange={setColouring}
        palette={data.palette} colors={colors} onChange={api.setPalette} />
      <PlaceExportDialog open={exporting} onOpenChange={setExporting} api={api} shapes={shapes}
        visited={visited} wished={wished} />
    </div>
  );
}
