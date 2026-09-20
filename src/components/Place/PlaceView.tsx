import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Crosshair, Globe, Loader2, MapPin, Minus, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePreferences, useTranslation } from '@/hooks/usePreferences';
import { useAuth } from '@/hooks/useAuth';
import { useSyncStatus } from '@/hooks/useSync';
import { COLOR_THEMES } from '@/data/color-themes';
import { requestUpgrade } from '@/lib/pro';
import { track, trackOnce } from '@/lib/track';
import {
  FREE_PLACE_PINS, byContinent, canAddPin, countryAt, placeSummary,
  type CountryShape, type PinCategory,
} from '@/lib/place';
import { countryName, loadCities, loadWorld, searchCountries, type CityRow } from '@/lib/place-world';
import { PIN_MAX_ZOOM, PIN_MIN_ZOOM, type Camera } from '@/lib/place-tiles';
import { GLOBE_MAX_ZOOM, GLOBE_MIN_ZOOM, type Camera as GlobeCamera } from '@/lib/place-globe';
import { usePlace, PLACE_UNDO_MS } from '@/hooks/usePlace';
import { PLACE_EXPORT_EVENT } from '@/lib/place-export';
import { readRelationPeople } from '@/lib/place-relation';
import { guessYear, placeGuesses, readLifeRecord } from '@/lib/life-place';
import { GlobeMap } from './GlobeMap';
import { PinMap } from './PinMap';
import { CountryCard, PinCard } from './PlacePanel';
import { PinDialog, CityPicker, type PinTarget } from './PlaceDialogs';
import { PlaceExportDialog } from './PlaceExport';
import { PIN_ICON, PIN_LABEL, continentName, visitedColor } from './palette';

const LAST_TAB = '24h-place-tab';

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
  const visited = visitedColor(theme);

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
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [only, setOnly] = useState<Set<PinCategory>>(() => new Set());
  // The globe opens looking at home, when there is a home to look at. The
  // record is already loaded by the time this runs, so it is decided once.
  const [globe, setGlobe] = useState<GlobeCamera>(() => {
    const at = api.data.home?.cityId
      ? api.data.cities.find((c) => c.id === api.data.home!.cityId)
      : undefined;
    return { lng: at?.lng ?? 20, lat: at?.lat ?? 20, zoom: 1 };
  });
  const [camera, setCamera] = useState<Camera>({ lng: 10, lat: 25, zoom: PIN_MIN_ZOOM });
  const [here, setHere] = useState<{ lng: number; lat: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [askedLife, setAskedLife] = useState(false);
  const [homeAsked, setHomeAsked] = useState(false);

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
    toast(t('place.deleted'), {
      action: { label: t('sync.undo'), onClick: () => api.restorePin(gone.pin, gone.at) },
      duration: PLACE_UNDO_MS,
    });
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
        setGlobe((g) => ({ ...g, ...at }));
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

  const zoomBy = (by: number) => {
    if (tab === 'world') {
      setGlobe((g) => ({ ...g, zoom: Math.max(GLOBE_MIN_ZOOM, Math.min(GLOBE_MAX_ZOOM, g.zoom * (by > 0 ? 1.4 : 1 / 1.4))) }));
    } else {
      setCamera((c) => ({ ...c, zoom: Math.max(PIN_MIN_ZOOM, Math.min(PIN_MAX_ZOOM, c.zoom + by)) }));
    }
  };

  const panel = (shape && tab === 'world') || (pin && tab === 'pins');

  return (
    <div className="relative min-h-0 w-full flex-1 overflow-hidden" data-place-view>
      <h2 className="sr-only">{t('place.title')}</h2>

      {/* The map is the page. */}
      <div className="absolute inset-0" inert={api.readOnly || undefined}>
        {tab === 'world' ? (
          <GlobeMap
            shapes={shapes}
            countries={data.countries}
            cities={data.cities}
            {...(data.home?.cityId ? { homeCityId: data.home.cityId } : {})}
            visited={visited}
            selected={country}
            camera={globe}
            onCamera={setGlobe}
            onSelect={setCountry}
            nameOf={nameOf}
          />
        ) : (
          <PinMap
            pins={pins}
            camera={camera}
            onCamera={setCamera}
            selected={pinId}
            onSelect={setPinId}
            onDropAt={dropAt}
            here={here}
          />
        )}
      </div>

      {/* Everything else floats over it. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col p-2 sm:p-3">
        <div className="flex flex-wrap items-start gap-2">
          <div role="tablist" aria-label={t('place.title')} className={`${FLOAT} inline-flex p-0.5`}>
            {(['world', 'pins'] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} data-place-tab={k}
                onClick={() => { setTab(k); setCountry(null); setPinId(null); }}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] ${
                  tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                {k === 'world' ? <Globe aria-hidden className="h-3.5 w-3.5" /> : <MapPin aria-hidden className="h-3.5 w-3.5" />}
                {t(k === 'world' ? 'place.tab.world' : 'place.tab.pins')}
              </button>
            ))}
          </div>

          {tab === 'pins' && (
            <>
              <Button size="sm" className="pointer-events-auto gap-1.5 rounded-full" data-place-add
                onClick={() => dropAt(camera.lng, camera.lat)}>
                <Plus aria-hidden className="h-4 w-4" />
                {t('place.addPin')}
              </Button>
              <Button size="sm" variant="outline" className="pointer-events-auto gap-1.5 rounded-full bg-surface/92"
                data-place-locate disabled={locating} onClick={locate}>
                {locating ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Crosshair aria-hidden className="h-4 w-4" />}
                {t('place.locate')}
              </Button>
            </>
          )}

          <div className="ml-auto flex items-start gap-2">
            {tab === 'world' && (searching ? (
              <span className={`${FLOAT} inline-flex items-center gap-1 px-1`}>
                <Input autoFocus value={query} data-place-search placeholder={t('place.searchCountry')}
                  className="h-9 w-44 border-0 bg-transparent" onChange={(e) => setQuery(e.target.value)} />
                <button type="button" aria-label={t('common.close')} data-place-search-close
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent/20"
                  onClick={() => { setQuery(''); setSearching(false); }}>
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </span>
            ) : (
              <button type="button" aria-label={t('place.searchCountry')} title={t('place.searchCountry')}
                data-place-search-open
                className={`${FLOAT} grid h-10 w-10 place-items-center text-muted-foreground hover:bg-accent/20`}
                onClick={() => setSearching(true)}>
                <Search aria-hidden className="h-4 w-4" />
              </button>
            ))}
            <div className={`${FLOAT} flex flex-col overflow-hidden`}>
              <button type="button" aria-label={t('place.zoomIn')} title={t('place.zoomIn')} data-place-zoom-in
                className="grid h-10 w-10 place-items-center text-muted-foreground hover:bg-accent/20"
                onClick={() => zoomBy(1)}>
                <Plus aria-hidden className="h-4 w-4" />
              </button>
              <button type="button" aria-label={t('place.zoomOut')} title={t('place.zoomOut')} data-place-zoom-out
                className="grid h-10 w-10 place-items-center border-t border-border text-muted-foreground hover:bg-accent/20"
                onClick={() => zoomBy(-1)}>
                <Minus aria-hidden className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* What was searched for, under the box that searched for it. */}
        {found.length > 0 && (
          <ul className={`${FLOAT} mt-2 ml-auto flex max-w-[320px] flex-wrap justify-end gap-1 p-1.5`} data-place-found>
            {found.map((s) => (
              <li key={s.code}>
                <button type="button" data-place-found-item={s.code}
                  className="min-h-8 rounded-full px-2.5 text-[13px] hover:bg-accent/20"
                  onClick={() => { setCountry(s.code); setQuery(''); setSearching(false); }}>
                  {nameOf(s.code, s.name)}
                </button>
              </li>
            ))}
          </ul>
        )}

        {tab === 'pins' && data.pins.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {(Object.keys(PIN_LABEL) as PinCategory[]).map((c) => {
              const on = only.has(c);
              const Icon = PIN_ICON[c];
              const n = data.pins.filter((p) => p.category === c).length;
              if (!n && !on) return null;
              return (
                <li key={c}>
                  <button type="button" data-place-filter={c} aria-pressed={on}
                    onClick={() => setOnly((was) => {
                      const next = new Set(was);
                      if (!next.delete(c)) next.add(c);
                      return next;
                    })}
                    className={`${FLOAT} inline-flex min-h-8 items-center gap-1.5 px-2.5 text-[12px] ${
                      on ? 'text-foreground' : 'text-muted-foreground'}`}>
                    <Icon aria-hidden className="h-3.5 w-3.5" />
                    {t(PIN_LABEL[c])}
                    <span className="tabular-nums">{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

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
              tab === 'pins' ? t('place.sum.pins', { n: String(summary.pins) }) : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      {/* The card for whatever is chosen: a column on the right of a wide
          screen, a sheet across the bottom of a narrow one. */}
      {panel && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 max-h-[60%] overflow-y-auto min-[900px]:inset-y-0 min-[900px]:left-auto min-[900px]:max-h-none min-[900px]:w-[360px]">
          {shape && tab === 'world' && (
            <CountryCard
              shape={shape}
              visit={data.countries.find((c) => c.code === shape.code)}
              data={data}
              cityRows={cityRows}
              name={nameOf(shape.code, shape.name)}
              onToggle={() => { api.toggleCountry(shape.code); track('place_country'); }}
              onPatch={(patch) => api.setCountry(shape.code, patch)}
              onAddCity={(city) => { api.addCity(city); track('place_city'); }}
              onRemoveCity={api.removeCity}
              onClose={() => setCountry(null)}
              onOpenPin={(id) => { setTab('pins'); setPinId(id); }}
            />
          )}
          {pin && tab === 'pins' && (
            <PinCard
              pin={pin}
              people={people}
              onClose={() => setPinId(null)}
              onEdit={() => setTarget({ mode: 'edit', pin })}
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
                      {c.name}{c.lived ? ` · ${t('place.lived')}` : ''}
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
      <PlaceExportDialog open={exporting} onOpenChange={setExporting} api={api} shapes={shapes} visited={visited} />
    </div>
  );
}
