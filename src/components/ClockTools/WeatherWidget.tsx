import { useCallback, useContext, useEffect, useState } from 'react';
import { Search, RefreshCw, MapPin, Loader2, X } from 'lucide-react';
import { makeDragStart, type Pos } from './clock-utils';
import type { WeatherState, WeatherPlace } from './useClockTools';
import { useTranslation } from '@/hooks/usePreferences';
import { FloatingInlineContext } from './floatingInline';

interface WeatherWidgetProps {
  weather: WeatherState;
  onChange: (patch: Partial<WeatherState>) => void;
  onMove: (p: Pos) => void;
  onClose: () => void;
}

/** WMO weather code → emoji. */
function wmoEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}

interface Current {
  tempC: number;
  code: number;
}

/** Geocode a place name. Open-Meteo first (fast, English/romanized); falls back
 *  to Nominatim/OSM which handles non-ASCII queries like "서울". */
async function geocode(name: string, lang: string): Promise<WeatherPlace | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=${lang}`;
    const j = await (await fetch(url)).json();
    const r = j?.results?.[0];
    if (r) return { name: r.country ? `${r.name}, ${r.country}` : r.name, lat: r.latitude, lon: r.longitude };
  } catch {
    /* try the fallback */
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1&accept-language=${lang}`;
    const j = await (await fetch(url)).json();
    const r = Array.isArray(j) ? j[0] : null;
    if (r) {
      const label = String(r.display_name || name).split(',').slice(0, 2).join(',').trim();
      return { name: label, lat: Number(r.lat), lon: Number(r.lon) };
    }
  } catch {
    /* no luck */
  }
  return null;
}

/**
 * Floating weather. Like the clock/calendar, only the reading shows by default
 * (transparent); hovering reveals the box plus the city search + controls.
 */
export function WeatherWidget({ weather, onChange, onMove, onClose }: WeatherWidgetProps) {
  const { t, lang } = useTranslation();
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Current | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const place = weather.place;
  // Inline (mobile clock-tools section): static, full-width card; box, controls
  // and the city-search form always visible; dragging disabled.
  const inline = useContext(FloatingInlineContext);

  const fetchForecast = useCallback(async (lat: number, lon: number) => {
    setStatus('loading');
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
      const res = await fetch(url);
      const j = await res.json();
      if (j?.current && typeof j.current.temperature_2m === 'number') {
        setData({ tempC: j.current.temperature_2m, code: j.current.weather_code ?? 0 });
        setStatus('idle');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (place) void fetchForecast(place.lat, place.lon);
      else setData(null);
    }, 0);
    return () => window.clearTimeout(id);
  }, [place, fetchForecast]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const name = query.trim();
    if (!name) return;
    setStatus('loading');
    const found = await geocode(name, lang);
    if (found) {
      onChange({ place: found });
      setQuery('');
    } else {
      setStatus('error');
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ place: { name: t('clock.myLocation'), lat: pos.coords.latitude, lon: pos.coords.longitude } }),
      () => setStatus('error'),
    );
  }

  const ctrlBtn = 'grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors hover:bg-black/10';
  const ctrlStyle: React.CSSProperties = {
    backgroundColor: 'hsl(var(--background))',
    color: 'hsl(var(--foreground))',
    border: '1px solid hsl(var(--border))',
  };

  return (
    <div
      className={inline ? 'group relative w-full' : 'group'}
      style={inline ? undefined : { position: 'fixed', left: weather.pos.x, top: weather.pos.y, width: 204, zIndex: 25 }}
    >
      {/* Box — fades in only on hover (clean reading by default); always inline. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-150 ${inline ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        style={{ backgroundColor: 'hsl(var(--surface))', border: '1px solid hsl(var(--border))', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      />

      {/* Hover controls — refresh + close; always shown inline. */}
      <div
        data-no-drag
        className={`absolute right-1.5 top-1.5 z-20 flex items-center gap-1 transition-opacity duration-150 ${inline ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'}`}
      >
        {place ? (
          <button
            type="button"
            onClick={() => void fetchForecast(place.lat, place.lon)}
            aria-label={t('clock.weatherRefresh')}
            className="grid h-5 w-5 place-items-center rounded transition-colors hover:bg-black/10"
            style={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
          >
            <RefreshCw className="h-3 w-3" style={{ color: 'hsl(var(--text-muted))' }} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('clock.close')}
          className="grid h-5 w-5 place-items-center rounded transition-colors hover:bg-black/10"
          style={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
        >
          <X className="h-3 w-3" style={{ color: 'hsl(var(--text-muted))' }} />
        </button>
      </div>

      {/* Reading — always visible; drag from here (disabled inline). */}
      <div
        onPointerDown={inline ? undefined : makeDragStart(weather.pos, onMove)}
        className={`relative z-10 px-3 py-3 ${inline ? '' : 'cursor-grab touch-none select-none active:cursor-grabbing'}`}
      >
        {place ? (
          <div className="text-center" style={{ color: 'hsl(var(--foreground))' }}>
            <div className="truncate text-xs font-medium" style={{ color: 'hsl(var(--text-muted))' }}>{place.name}</div>
            {status === 'loading' && !data ? (
              <Loader2 className="mx-auto my-1.5 h-5 w-5 animate-spin" style={{ color: 'hsl(var(--text-muted))' }} />
            ) : status === 'error' && !data ? (
              <div className="py-1.5 text-xs" style={{ color: 'hsl(var(--text-muted))' }}>{t('clock.weatherError')}</div>
            ) : data ? (
              <div className="flex items-center justify-center gap-2">
                <span style={{ fontSize: 32 }}>{wmoEmoji(data.code)}</span>
                <span style={{ fontSize: 30, fontWeight: 800 }}>{Math.round(data.tempC)}°</span>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-center text-xs" style={{ color: 'hsl(var(--text-muted))' }}>{t('clock.weatherEmpty')}</p>
        )}

        {/* City search — hover-only on desktop; always visible inline. */}
        <form
          className={`mt-2 flex items-center gap-1.5 transition-opacity duration-150 ${inline ? 'opacity-100' : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'}`}
          data-no-drag
          onSubmit={search}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('clock.weatherSearch')}
            aria-label={t('clock.weatherSearch')}
            className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-sm"
            style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}
          />
          <button type="submit" className={ctrlBtn} style={ctrlStyle} aria-label={t('clock.weatherSet')}>
            <Search className="h-4 w-4" />
          </button>
          <button type="button" onClick={useMyLocation} className={ctrlBtn} style={ctrlStyle} aria-label={t('clock.myLocation')}>
            <MapPin className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
