import { useCallback, useEffect, useState } from 'react';
import { Search, RefreshCw, MapPin, Loader2 } from 'lucide-react';
import { FloatingPanel } from './FloatingPanel';
import type { Pos } from './clock-utils';
import type { WeatherState } from './useClockTools';
import { useTranslation } from '@/hooks/usePreferences';

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

export function WeatherWidget({ weather, onChange, onMove, onClose }: WeatherWidgetProps) {
  const { t, lang } = useTranslation();
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Current | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const place = weather.place;

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

  // Fetch whenever the saved place changes (and on mount if one is set). The
  // work is deferred a tick so the effect body doesn't call setState synchronously.
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
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=${lang}`;
      const j = await (await fetch(url)).json();
      const r = j?.results?.[0];
      if (r) {
        onChange({ place: { name: r.country ? `${r.name}, ${r.country}` : r.name, lat: r.latitude, lon: r.longitude } });
        setQuery('');
      } else {
        setStatus('error');
      }
    } catch {
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

  const ctrl =
    'grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors hover:bg-black/10';
  const ctrlStyle: React.CSSProperties = {
    backgroundColor: 'hsl(var(--background))',
    color: 'hsl(var(--foreground))',
    border: '1px solid hsl(var(--border))',
  };

  return (
    <FloatingPanel
      pos={weather.pos}
      width={210}
      title={t('clock.weather')}
      closeLabel={t('clock.close')}
      onMove={onMove}
      onClose={onClose}
      headerRight={
        place ? (
          <button
            type="button"
            data-no-drag
            onClick={() => void fetchForecast(place.lat, place.lon)}
            aria-label={t('clock.weatherRefresh')}
            className="grid h-6 w-6 place-items-center rounded transition-colors hover:bg-black/10"
          >
            <RefreshCw className="h-3.5 w-3.5" style={{ color: 'hsl(var(--text-muted))' }} />
          </button>
        ) : undefined
      }
    >
      {place ? (
        <div className="mb-2 text-center" style={{ color: 'hsl(var(--foreground))' }}>
          <div className="truncate text-xs font-medium" style={{ color: 'hsl(var(--text-muted))' }}>{place.name}</div>
          {status === 'loading' && !data ? (
            <Loader2 className="mx-auto my-2 h-5 w-5 animate-spin" style={{ color: 'hsl(var(--text-muted))' }} />
          ) : status === 'error' && !data ? (
            <div className="py-2 text-xs" style={{ color: 'hsl(var(--text-muted))' }}>{t('clock.weatherError')}</div>
          ) : data ? (
            <div className="flex items-center justify-center gap-2">
              <span style={{ fontSize: 34 }}>{wmoEmoji(data.code)}</span>
              <span style={{ fontSize: 30, fontWeight: 800 }}>{Math.round(data.tempC)}°</span>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mb-2 text-center text-xs" style={{ color: 'hsl(var(--text-muted))' }}>{t('clock.weatherEmpty')}</p>
      )}

      <form className="flex items-center gap-1.5" data-no-drag onSubmit={search}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('clock.weatherSearch')}
          aria-label={t('clock.weatherSearch')}
          className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-sm"
          style={{ backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}
        />
        <button type="submit" className={ctrl} style={ctrlStyle} aria-label={t('clock.weatherSet')}>
          <Search className="h-4 w-4" />
        </button>
        <button type="button" onClick={useMyLocation} className={ctrl} style={ctrlStyle} aria-label={t('clock.myLocation')}>
          <MapPin className="h-4 w-4" />
        </button>
      </form>
    </FloatingPanel>
  );
}
