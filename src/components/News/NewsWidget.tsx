import { useState, useEffect, useCallback, useRef } from 'react';
import { Newspaper, X, Search, RefreshCw, Loader2, Settings } from 'lucide-react';
import { useTranslation } from '@/hooks/usePreferences';
import { makeDragStart, anchoredStyle, spawnNearCentre, clampOffset, type Pos } from '@/components/ClockTools/clock-utils';

/** A single-line headline that, on hover, scrolls left to reveal the part cut
 *  off by the ellipsis (marquee), then eases back on leave. Duration scales with
 *  how much is hidden. */
function MarqueeTitle({ text }: { text: string }) {
  const inner = useRef<HTMLSpanElement>(null);
  function onEnter() {
    const el = inner.current;
    if (!el) return;
    const overflow = el.scrollWidth - (el.parentElement?.clientWidth ?? el.scrollWidth);
    if (overflow > 4) {
      el.style.transition = `transform ${Math.max(1.2, overflow / 45).toFixed(2)}s linear`;
      el.style.transform = `translateX(-${overflow}px)`;
    }
  }
  function onLeave() {
    const el = inner.current;
    if (!el) return;
    el.style.transition = 'transform .3s ease';
    el.style.transform = 'translateX(0)';
  }
  return (
    <span className="block overflow-hidden" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <span ref={inner} className="inline-block whitespace-nowrap align-bottom will-change-transform">{text}</span>
    </span>
  );
}

const POS_KEY = '24h-circle-planner.newswidget';
const CFG_KEY = '24h-news.config';
const CACHE_KEY = '24h-news.cache';
const CARD_W = 320;

/** Countries offered in the picker — must match the worker's NEWS_MARKETS keys.
 *  Labels are localized at render time via Intl.DisplayNames (no dict churn). The
 *  fetch goes through our own Worker (/api/news), which proxies Bing News RSS —
 *  reliable from any client (incl. shared mobile IPs), cached, no AI tokens. */
const COUNTRIES = ['KR', 'US', 'GB', 'JP', 'CN', 'TW', 'FR', 'DE', 'ES', 'IT', 'IN', 'BR', 'RU', 'CA', 'AU'];

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
 * News-headline reader. Set a country + keyword; it pulls ~10 fresh headline
 * titles (links) once a day (cached), refreshable on demand. NO AI tokens — a
 * server-side Bing News RSS fetch via /api/news. On desktop it's a floating FAB
 * + draggable card; on mobile (isMobile) it renders as a static section placed
 * at the very bottom of the stacked layout (no button).
 */
export function NewsWidget({ isMobile = false }: { isMobile?: boolean }) {
  const { t, lang } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>(loadPos);
  const [hover, setHover] = useState(false);
  const [cfg, setCfg] = useState<Config>(loadConfig);
  const [draft, setDraft] = useState<Config>(cfg);
  // Country + keyword live behind a settings toggle (gear); open by default only
  // until the user has configured a keyword.
  const [showSettings, setShowSettings] = useState<boolean>(() => !loadConfig().q.trim());
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
      // Our Worker proxies Bing News RSS (cached, retried, stale-served) — same
      // origin, so it works from any client incl. shared mobile IPs. No tokens.
      const res = await fetch(`/api/news?q=${encodeURIComponent(kw)}&country=${country}`);
      const j = await res.json();
      const next: NewsItem[] = Array.isArray(j.items) ? j.items : [];
      if (next.length) {
        setItems(next);
        setStatus('idle');
        fetchedAtRef.current = Date.now();
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ q: kw, country, items: next, fetchedAt: fetchedAtRef.current })); } catch { /* */ }
      } else if (res.ok) {
        setItems([]);
        setStatus('idle'); // valid response, just no headlines → "none" state
      } else {
        setItems([]);
        setStatus('error');
      }
    } catch { setStatus('error'); }
  }, []);

  // Refetch (when visible) if the config changed or the cache is from a previous
  // day (headlines refresh daily) — otherwise reuse the cached list. On mobile
  // the panel is always visible, so it loads on mount.
  useEffect(() => {
    if ((!open && !isMobile) || !cfg.q.trim()) return;
    const c = loadCache();
    const stale = !c || c.q !== cfg.q || c.country !== cfg.country || dayStamp(c.fetchedAt) !== dayStamp(Date.now());
    if (stale) void fetchNews(cfg.q, cfg.country);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isMobile, cfg.q, cfg.country]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    const next = { q: draft.q.trim(), country: draft.country };
    setCfg(next);
    try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch { /* */ }
    if (next.q) setShowSettings(false); // collapse to the clean headline list
    void fetchNews(next.q, next.country);
  }

  const inputStyle: React.CSSProperties = { backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' };

  // Shared inner content (header + config form + headline list). `inline` = the
  // static mobile section (no drag, no close button); otherwise the floating card.
  const panel = (inline: boolean) => (
    <>
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
        {/* Settings (country + keyword) live behind this gear. */}
        <button type="button" data-no-drag aria-label={t('news.settings')} title={t('news.settings')}
          aria-pressed={showSettings} onClick={() => { setDraft(cfg); setShowSettings((v) => !v); }}
          className="grid h-6 w-6 place-items-center rounded transition-colors hover:bg-black/10">
          <Settings className={`h-3.5 w-3.5 ${showSettings ? 'text-foreground' : 'text-muted-foreground'}`} />
        </button>
        {!inline && (
          <button type="button" data-no-drag aria-label={t('common.cancel')} onClick={() => setOpen(false)}
            className="grid h-6 w-6 place-items-center rounded transition-colors hover:bg-black/10">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Config: country + keyword — only when the gear is on. */}
      {showSettings && (
        <form data-no-drag onSubmit={applySearch} className="flex items-center gap-1.5 px-3 pb-1 pt-2">
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
      )}

      {/* Headlines — single-line titles (marquee on hover), no scrollbar. */}
      <div className="px-1.5 pb-2 pt-1">
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
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-black/[0.06]"
                >
                  <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-[13px] leading-snug text-foreground">
                    <MarqueeTitle text={it.title} />
                  </span>
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );

  // Mobile: a plain static section at the bottom of the stacked layout (no FAB).
  if (isMobile) {
    return (
      <section
        data-news-card="1"
        className="mt-4 w-full max-w-full overflow-hidden rounded-xl border border-border bg-surface"
      >
        {panel(true)}
      </section>
    );
  }

  // Desktop: floating FAB toggles a draggable card.
  return (
    <>
      {open && (
        <div
          data-news-card="1"
          data-hover={hover ? '1' : '0'}
          onPointerDown={makeDragStart(pos, setPos)}
          onPointerMove={() => { if (!hover) setHover(true); }}
          onPointerLeave={() => setHover(false)}
          className="fixed z-30 w-[300px] cursor-grab touch-none overflow-hidden rounded-xl active:cursor-grabbing"
          style={{
            ...anchoredStyle(pos.x, pos.y),
            // Transparent at rest like the other floating widgets; on hover the
            // same surface + border + shadow so the list is easy to read.
            backgroundColor: hover ? 'hsl(var(--surface) / 0.92)' : 'transparent',
            border: `1px solid ${hover ? 'hsl(var(--border))' : 'transparent'}`,
            boxShadow: hover ? '0 20px 25px -5px rgb(0 0 0 / 0.14), 0 8px 10px -6px rgb(0 0 0 / 0.12)' : 'none',
            transition: 'background-color 120ms ease',
          }}
        >
          {panel(false)}
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
