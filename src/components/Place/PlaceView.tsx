import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Globe, MapPin, Plus, Search, X } from 'lucide-react';
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
import {
  countryName, loadCities, loadWorld, searchCountries, type CityRow,
} from '@/lib/place-world';
import { PIN_MIN_ZOOM, type Camera } from '@/lib/place-tiles';
import { usePlace, PLACE_UNDO_MS } from '@/hooks/usePlace';
import { PLACE_EXPORT_EVENT } from '@/lib/place-export';
import { readRelationPeople } from '@/lib/place-relation';
import { WorldMap } from './WorldMap';
import { PinMap } from './PinMap';
import { CountryCard, PinCard } from './PlacePanel';
import { PinDialog, CityPicker, type PinTarget } from './PlaceDialogs';
import { PlaceExportDialog } from './PlaceExport';
import { PIN_ICON, PIN_LABEL, continentName, visitedColor } from './palette';
import { guessYear, placeGuesses, readLifeRecord } from '@/lib/life-place';

const LAST_TAB = '24h-place-tab';

/**
 * Place — where a life has actually happened.
 *
 * Two views under one tab: a world to colour in, which needs no network at
 * all, and a pin map over real tiles for the particular spots. Everything is
 * put here by hand; nothing is tracked.
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
  const [camera, setCamera] = useState<Camera>({ lng: 10, lat: 25, zoom: PIN_MIN_ZOOM });
  /** Cities the life line seems to name, and which of them have been agreed to. */
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [askedLife, setAskedLife] = useState(false);

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

  /** The relation map's people, so a pin can say who was there. */
  const people = useMemo(() => readRelationPeople(), []);
  /** The life line is read once per visit; it is edited on its own page. */
  const life = useMemo(() => readLifeRecord(), []);
  const guesses = useMemo(
    () => (askedLife ? [] : placeGuesses(life, cityRows, data)),
    [life, cityRows, data, askedLife],
  );
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

  /** Somewhere on the pin map: a new pin, if there is room for one. */
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

  const firstVisit = data.countries.length === 0 && data.pins.length === 0;
  const grouped = byContinent(data, shapes, nameOf);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col" data-place-view>
      <header className="mx-auto w-full max-w-[960px] px-4 pt-4 text-center sm:pt-6">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{t('place.title')}</h2>
        <p className="mt-2 text-[15px] italic text-muted-foreground">{t('place.subtitle')}</p>
        {api.readOnly && (
          <p role="status" data-place-newer
            className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left text-sm text-foreground">
            {t('relation.newerVersion')}
          </p>
        )}
      </header>

      <div className="contents" inert={api.readOnly || undefined}>
        {/* World or pins, and the things each of them needs. */}
        <div className="mx-auto mt-4 flex w-full max-w-[1200px] flex-wrap items-center justify-center gap-1.5 px-4">
          <div role="tablist" aria-label={t('place.title')} className="inline-flex rounded-full border border-border p-0.5">
            {(['world', 'pins'] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} data-place-tab={k}
                onClick={() => setTab(k)}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] ${
                  tab === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                {k === 'world' ? <Globe aria-hidden className="h-3.5 w-3.5" /> : <MapPin aria-hidden className="h-3.5 w-3.5" />}
                {t(k === 'world' ? 'place.tab.world' : 'place.tab.pins')}
              </button>
            ))}
          </div>

          {tab === 'pins' && (
            <>
              <Button size="sm" className="gap-1.5" data-place-add
                onClick={() => dropAt(camera.lng, camera.lat)}>
                <Plus aria-hidden className="h-4 w-4" />
                {t('place.addPin')}
              </Button>
              {(Object.keys(PIN_LABEL) as PinCategory[]).map((c) => {
                const on = only.has(c);
                const Icon = PIN_ICON[c];
                const n = data.pins.filter((p) => p.category === c).length;
                if (!n && !on) return null;
                return (
                  <button key={c} type="button" data-place-filter={c} aria-pressed={on}
                    onClick={() => setOnly((was) => {
                      const next = new Set(was);
                      if (!next.delete(c)) next.add(c);
                      return next;
                    })}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] ${
                      on ? 'border-foreground text-foreground' : 'border-border text-muted-foreground'}`}>
                    <Icon aria-hidden className="h-3.5 w-3.5" />
                    {t(PIN_LABEL[c])}
                    <span className="tabular-nums text-muted-foreground">{n}</span>
                  </button>
                );
              })}
            </>
          )}

          {tab === 'world' && (searching ? (
            <span className="inline-flex items-center gap-1">
              <Input autoFocus value={query} data-place-search placeholder={t('place.searchCountry')}
                className="h-9 w-48" onChange={(e) => setQuery(e.target.value)} />
              <button type="button" aria-label={t('common.close')} data-place-search-close
                className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent/20"
                onClick={() => { setQuery(''); setSearching(false); }}>
                <X aria-hidden className="h-4 w-4" />
              </button>
            </span>
          ) : (
            <button type="button" aria-label={t('place.searchCountry')} title={t('place.searchCountry')}
              data-place-search-open
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground hover:bg-accent/20"
              onClick={() => setSearching(true)}>
              <Search aria-hidden className="h-4 w-4" />
            </button>
          ))}
        </div>

        {found.length > 0 && (
          <ul className="mx-auto mt-2 flex w-full max-w-[600px] flex-wrap justify-center gap-1.5 px-4" data-place-found>
            {found.map((s) => (
              <li key={s.code}>
                <button type="button" data-place-found-item={s.code}
                  className="min-h-9 rounded-full border border-border px-3 text-[13px] hover:bg-accent/20"
                  onClick={() => { setCountry(s.code); setQuery(''); setSearching(false); }}>
                  {nameOf(s.code, s.name)}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* The numbers, above the map as the PRD asks. */}
        <p className="px-4 pt-3 text-center text-[12px] text-muted-foreground" data-place-summary>
          {[
            t('place.sum.countries', { n: String(summary.countries) }),
            t('place.sum.percent', { n: String(summary.percent) }),
            t('place.sum.continents', { n: String(summary.continents) }),
            t('place.sum.cities', { n: String(summary.cities) }),
            tab === 'pins' ? t('place.sum.pins', { n: String(summary.pins) }) : null,
          ].filter(Boolean).join(' · ')}
        </p>

        <div className="mt-2 flex flex-1 flex-col min-[900px]:flex-row">
          <div className="flex flex-1 flex-col">
            {tab === 'world' ? (
              <div className="relative px-2">
                <WorldMap
                  shapes={shapes}
                  countries={data.countries}
                  cities={data.cities}
                  {...(data.home?.cityId ? { homeCityId: data.home.cityId } : {})}
                  visited={visited}
                  selected={country}
                  onSelect={setCountry}
                  nameOf={nameOf}
                />
                {firstVisit && (
                  <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[15px] italic text-muted-foreground"
                    data-place-empty>
                    {t('place.empty.world')}
                  </p>
                )}
              </div>
            ) : (
              <PinMap
                pins={pins}
                camera={camera}
                onCamera={setCamera}
                selected={pinId}
                onSelect={setPinId}
                onDropAt={dropAt}
              />
            )}

            {/* The map is a picture; this list is the page for a keyboard and
                for a screen reader, and it is also just useful. */}
            {tab === 'world' ? (
              <div className="px-4 py-4" data-place-list>
                {grouped.map((group) => (
                  <section key={group.continent} className="mt-3 first:mt-0">
                    <h3 className="text-[13px] font-medium text-muted-foreground">{continentName(group.continent, t)}</h3>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {group.countries.map((c) => (
                        <li key={c.code}>
                          <button type="button" data-place-list-item={c.code}
                            className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border px-2.5 text-[13px] hover:bg-accent/20"
                            onClick={() => setCountry(c.code)}>
                            {c.name}
                            {c.lived && <span className="text-muted-foreground">· {t('place.lived')}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5 px-4 py-4" data-place-list>
                {[...pins].reverse().map((p) => {
                  const Icon = PIN_ICON[p.category];
                  return (
                    <li key={p.id}>
                      <button type="button" data-place-list-item={p.id}
                        className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent/20"
                        onClick={() => setPinId(p.id)}>
                        <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{p.name}</span>
                        {p.date && <span className="ml-auto shrink-0 text-[12px] text-muted-foreground">{p.date.slice(0, 4)}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

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

        {/* What the life line seems to say. Only ever an offer: a guess from a
            title is a guess, and a map that colours itself in is a map that
            lies. Nothing is written until it has been agreed to. */}
        {tab === 'world' && guesses.length > 0 && (
          <section className="mx-auto mb-4 w-full max-w-[600px] px-4" data-place-life-ask>
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
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] ${
                        on ? 'border-foreground text-foreground' : 'border-border text-muted-foreground'}`}>
                      {city.name}
                      <span className="text-muted-foreground">{milestone.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex justify-center">
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

        {/* Where the shapes came from, and what is never collected. */}
        <p className="px-4 pb-4 text-center text-[11px] text-muted-foreground" data-place-privacy-foot>
          {t('place.privacy.hint')}
        </p>

        {/* Somewhere to say where home is, once. */}
        {!data.home && shapes.length > 0 && (
          <div className="mx-auto mb-4 w-full max-w-sm px-4" data-place-home-ask>
            <p className="text-center text-[13px] text-muted-foreground">{t('place.home.ask')}</p>
            <div className="mt-2">
              <CityPicker rows={cityRows} label={t('place.searchCity')}
                onPick={(city) => {
                  api.addCity({ id: city.id, name: city.name, countryCode: city.code, lat: city.lat, lng: city.lng, lived: true });
                  api.setHome({ countryCode: city.code, cityId: city.id });
                  track('place_home');
                }} />
            </div>
          </div>
        )}
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
