import { useState, useEffect, useCallback, useRef } from 'react';
import { Newspaper, X, Search, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import { useTranslation } from '@/hooks/usePreferences';
import { makeDragStart, anchoredStyle, spawnNearCentre, clampOffset, type Pos } from '@/components/ClockTools/clock-utils';

const POS_KEY = '24h-circle-planner.newswidget';
const CFG_KEY = '24h-news.config';
const CACHE_KEY = '24h-news.cache';
const CARD_W = 320;

/** ISO country code → GDELT `sourcecountry` FIPS 10-4 code. We call GDELT's free
 *  Doc API directly from the browser (it sends `Access-Control-Allow-Origin: *`),
 *  so each user hits it from their own IP — no shared-datacenter throttling, no
 *  proxy, and no AI tokens. Labels are localized via Intl.DisplayNames. */
const COUNTRY_FIPS: Record<string, string> = {
  KR: 'KS', US: 'US', GB: 'UK', JP: 'JA', CN: 'CH', TW: 'TW', FR: 'FR', DE: 'GM',
  ES: 'SP', IT: 'IT', IN: 'IN', BR: 'BR', RU: 'RS', CA: 'CA', AU: 'AS',
};
const COUNTRIES = Object.keys(COUNTRY_FIPS);

interface GdeltArticle { title?: string; url?: string; domain?: string; seendate?: string }

interface NewsItem { title: string; link: string; source: string; pubDate: string }
interface Config { q: string; country: string }
interface Cache extends Config { items: NewsItem[]; fetchedAt: number }

function defaultPos(): Pos { return spawnNearCentre(40, 120, CARD_W, 340); }

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Pos> & { c?: number };
      if (p && typeof p.x === 'number' && typeof p.y === 'number') return clampOffset({ x: p.x, y: p.y }, CARD_W, 340);
    }
  } catch { /* ignore */ }
  return defaultPos();
}

function loadConfig(): Config {
  try {
    const raw = localStorage.getItem(CFG_KEY);
    if (raw) { const c = JSON.parse(raw) as Config; if (c && typeof c.q === 'string') return { q: c.q, country: c.country || 'KR' }; }
  } catch { /* ignore */ }
  return { q: '', country: 'KR' };
}

function loadCache(): Cache | null {
  try { const raw = localStorage.getItem(CACHE_KEY); if (raw) return JSON.parse(raw) as Cache; } catch { /* ignore */ }
  return null;
}

const dayStamp = (t: number) => new Date(t).toDateString();

/**
 * Floating news-headline reader. Set a country + keyword; it pulls ~10 fresh
 * headline titles (links) from Google News once a day (cached), refreshable on
 * demand. Uses NO AI tokens — a plain server-side RSS fetch via /api/news.
 */
export function NewsWidget() {
  const { t, lang } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>(loadPos);
  const [hover, setHover] = useState(false);
  const [cfg, setCfg] = useState<Config>(loadConfig);
  const [draft, setDraft] = useState<Config>(cfg);
  const cached = loadCache();
  const [items, setItems] = useState<NewsItem[]>(cached?.items ?? []);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const fetchedAtRef = useRef<number>(cached?.fetchedAt ?? 0);

  useEffect(() => { try { localStorage.setItem(POS_KEY, JSON.stringify({ x: pos.x, y: pos.y, c: 1 })); } catch { /* */ } }, [pos]);

  const countryName = useCallback((code: string) => {
    try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) || code; } catch { return code; }
  }, [lang]);

  const fetchNews = useCallback(async (q: string, country: string) => {
    const kw = q.trim();
    if (!kw) { setItems([]); return; }
    setStatus('loading');
    try {
      // GDELT Doc API: keyword AND a country filter, newest first, JSON. Called
      // straight from the browser (CORS-enabled) — no server, no AI tokens.
      const fips = COUNTRY_FIPS[country] ?? 'US';
      const query = `${kw} sourcecountry:${fips}`;
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=10&sort=DateDesc&format=json`;
      const res = await fetch(url);
      const text = await res.text();
      let parsed: GdeltArticle[] = [];
      try { parsed = (JSON.parse(text).articles ?? []) as GdeltArticle[]; } catch { /* rate-limit / non-JSON */ }
      const seen = new Set<string>();
      const next: NewsItem[] = [];
      for (const a of parsed) {
        const title = (a.title || '').trim();
        const link = a.url || '';
        if (!title || !link || seen.has(title)) continue;
        seen.add(title);
        next.push({ title, link, source: a.domain || '', pubDate: a.seendate || '' });
        if (next.length >= 10) break;
      }
      if (next.length) {
        setItems(next);
        setStatus('idle');
        fetchedAtRef.current = Date.now();
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ q: kw, country, items: next, fetchedAt: fetchedAtRef.current })); } catch { /* */ }
      } else {
        setItems([]);
        setStatus('idle'); // valid response, just no headlines → show the "none" state
      }
    } catch { setStatus('error'); }
  }, []);

  // On open: refetch if the config changed or the cache is from a previous day
  // (so headlines refresh daily) — otherwise reuse the cached list.
  useEffect(() => {
    if (!open || !cfg.q.trim()) return;
    const c = loadCache();
    const stale = !c || c.q !== cfg.q || c.country !== cfg.country || dayStamp(c.fetchedAt) !== dayStamp(Date.now());
    if (stale) void fetchNews(cfg.q, cfg.country);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cfg.q, cfg.country]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    const next = { q: draft.q.trim(), country: draft.country };
    setCfg(next);
    try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch { /* */ }
    void fetchNews(next.q, next.country);
  }

  const inputStyle: React.CSSProperties = { backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' };

  return (
    <>
      {open && (
        <div
          data-news-card="1"
          onPointerDown={makeDragStart(pos, setPos)}
          onPointerMove={() => { if (!hover) setHover(true); }}
          onPointerLeave={() => setHover(false)}
          className="fixed z-30 flex max-h-[68vh] w-[320px] cursor-grab touch-none flex-col overflow-hidden rounded-xl active:cursor-grabbing"
          style={{
            ...anchoredStyle(pos.x, pos.y),
            backgroundColor: 'hsl(var(--surface))',
            border: `1px solid ${hover ? 'hsl(var(--border))' : 'hsl(var(--border) / 0.7)'}`,
            boxShadow: hover ? '0 20px 25px -5px rgb(0 0 0 / 0.14), 0 8px 10px -6px rgb(0 0 0 / 0.12)' : '0 10px 20px -8px rgb(0 0 0 / 0.12)',
          }}
        >
          <div className="flex items-center gap-1.5 px-3 pt-3">
            <Newspaper className="h-4 w-4 text-foreground" />
            <span className="flex-1 text-sm font-semibold text-foreground">{t('news.title')}</span>
            {cfg.q.trim() && (
              <button type="button" data-no-drag aria-label={t('news.refresh')} title={t('news.refresh')}
                onClick={() => void fetchNews(cfg.q, cfg.country)}
                className="grid h-6 w-6 place-items-center rounded transition-colors hover:bg-black/10">
                <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${status === 'loading' ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button type="button" data-no-drag aria-label={t('common.cancel')} onClick={() => setOpen(false)}
              className="grid h-6 w-6 place-items-center rounded transition-colors hover:bg-black/10">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Config: country + keyword. */}
          <form data-no-drag onSubmit={applySearch} className="flex items-center gap-1.5 px-3 pb-2 pt-2">
            <select
              value={draft.country}
              onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
              aria-label={t('news.country')}
              className="shrink-0 rounded-md px-1.5 py-1.5 text-xs"
              style={inputStyle}
            >
              {COUNTRIES.map((c) => <option key={c} value={c}>{countryName(c)}</option>)}
            </select>
            <input
              type="text"
              value={draft.q}
              onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
              placeholder={t('news.keyword')}
              aria-label={t('news.keyword')}
              className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-sm"
              style={inputStyle}
            />
            <button type="submit" aria-label={t('news.search')} title={t('news.search')}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors hover:bg-black/10" style={inputStyle}>
              <Search className="h-4 w-4" />
            </button>
          </form>

          {/* Headlines. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
            {!cfg.q.trim() ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">{t('news.empty')}</p>
            ) : status === 'loading' && items.length === 0 ? (
              <div className="grid place-items-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : status === 'error' && items.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">{t('news.error')}</p>
            ) : items.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">{t('news.none')}</p>
            ) : (
              <ol className="flex flex-col">
                {items.map((it, i) => (
                  <li key={i}>
                    <a
                      data-no-drag
                      href={it.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-black/[0.06]"
                    >
                      <span className="w-4 shrink-0 pt-0.5 text-right text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-snug text-foreground">{it.title}</span>
                        {it.source && <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{it.source}</span>}
                      </span>
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => { setDraft(cfg); setOpen((v) => !v); }}
        aria-label={t('news.open')}
        aria-expanded={open}
        title={t('news.open')}
        className="fixed bottom-5 right-[128px] z-30 grid h-12 w-12 place-items-center rounded-full shadow-lg transition-transform hover:scale-105 bg-surface text-muted-foreground border border-border"
      >
        <Newspaper className="h-5 w-5" />
      </button>
    </>
  );
}
