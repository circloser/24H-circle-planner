import { useState, useEffect, useCallback, useRef } from 'react';
import { Newspaper, X, Search, RefreshCw, Loader2, Settings, Plus } from 'lucide-react';
import { useTranslation, usePreferences } from '@/hooks/usePreferences';
import { makeDragStart, anchoredStyle, marginSpawn, clampOffset, loadPosProfile, savePosProfile, type Pos } from '@/components/ClockTools/clock-utils';

const WINDOWS_KEY = '24h-news.windows';
const LEGACY_CFG_KEY = '24h-news.config';
const CARD_W = 300;
export const MAX_NEWS_WINDOWS = 3;

/** Countries offered in the picker — 'WW' = worldwide (no market filter); the
 *  rest must match the worker's NEWS_MARKETS keys. Labels are localized via
 *  Intl.DisplayNames (WW is special-cased). The fetch goes through our Worker
 *  (/api/news → Bing News RSS): reliable from any client, cached, no AI tokens. */
const COUNTRIES = ['WW', 'KR', 'US', 'GB', 'JP', 'CN', 'TW', 'HK', 'IN', 'CA', 'AU', 'NZ', 'IE', 'SG',
  'FR', 'DE', 'ES', 'IT', 'PT', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI', 'PL', 'TR', 'RU',
  'BR', 'MX', 'AR', 'CL', 'ID', 'MY', 'PH', 'ZA', 'SA', 'TH'];
/** Refresh-interval options (hours; 0 = manual only). */
const INTERVALS: { h: number; label: string }[] = [
  { h: 0, label: 'manual' }, { h: 1, label: '1h' }, { h: 6, label: '6h' }, { h: 24, label: '24h' },
];

interface NewsItem { title: string; link: string; source: string; pubDate: string }
interface NewsWindow { id: string; q: string; country: string; intervalH: number; pos: Pos }
interface CacheEntry { q: string; country: string; items: NewsItem[]; fetchedAt: number }

const uid = () => Math.random().toString(36).slice(2, 9);
const cacheKey = (id: string) => `24h-news.cache.${id}`;

function newWindow(index: number): NewsWindow {
  // First window lands in the BOTTOM-LEFT margin (the news toggle's home spot);
  // extra windows cascade up-and-right from it so each stays grabbable.
  const base = marginSpawn('news', CARD_W, 300);
  return { id: uid(), q: '', country: 'KR', intervalH: 24, pos: { x: base.x + index * 28, y: base.y - index * 46 } };
}

/** Load the window list; migrates the old single-config (comma keywords become
 *  up to 3 windows, one keyword each). */
function loadWindows(): NewsWindow[] {
  try {
    const raw = localStorage.getItem(WINDOWS_KEY);
    if (raw) {
      const list = JSON.parse(raw) as NewsWindow[];
      if (Array.isArray(list)) {
        return list.slice(0, MAX_NEWS_WINDOWS).map((w, i) => ({
          ...newWindow(i), ...w,
          pos: loadPosProfile(`news.${w.id}`) ?? clampOffset(w.pos ?? newWindow(i).pos, CARD_W, 300),
        }));
      }
    }
    const legacy = localStorage.getItem(LEGACY_CFG_KEY);
    if (legacy) {
      const c = JSON.parse(legacy) as { q?: string; country?: string; intervalH?: number };
      const terms = (c.q ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_NEWS_WINDOWS);
      if (terms.length) {
        return terms.map((q, i) => ({ ...newWindow(i), q, country: c.country || 'KR', intervalH: c.intervalH ?? 24 }));
      }
    }
  } catch { /* ignore */ }
  return [];
}

function saveWindows(list: NewsWindow[]): void {
  try { localStorage.setItem(WINDOWS_KEY, JSON.stringify(list)); } catch { /* */ }
  for (const w of list) savePosProfile(`news.${w.id}`, w.pos);
}

/** One floating (or inline) news card: one keyword, own country/interval/cache. */
function NewsCard({ win, inline, canAdd, onChange, onAdd, onRemove }: {
  win: NewsWindow;
  inline: boolean;
  canAdd: boolean;
  onChange: (patch: Partial<NewsWindow>) => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const { t, lang } = useTranslation();
  const [hover, setHover] = useState(false);
  const [showSettings, setShowSettings] = useState(() => !win.q.trim());
  const [draft, setDraft] = useState({ q: win.q, country: win.country, intervalH: win.intervalH });
  const [items, setItems] = useState<NewsItem[]>(() => {
    try { const raw = localStorage.getItem(cacheKey(win.id)); if (raw) return (JSON.parse(raw) as CacheEntry).items ?? []; } catch { /* */ }
    return [];
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const fetchedAt = useRef(0);

  const countryName = useCallback((code: string) => {
    if (code === 'WW') return t('news.worldwide');
    try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) || code; } catch { return code; }
  }, [lang, t]);

  const fetchNews = useCallback(async (q: string, country: string) => {
    const kw = q.trim();
    if (!kw) { setItems([]); return; }
    setStatus('loading');
    try {
      const res = await fetch(`/api/news?q=${encodeURIComponent(kw)}&country=${country}`);
      const j = await res.json();
      const next: NewsItem[] = Array.isArray(j.items) ? j.items : [];
      if (next.length) {
        setItems(next);
        setStatus('idle');
        fetchedAt.current = Date.now();
        try { localStorage.setItem(cacheKey(win.id), JSON.stringify({ q: kw, country, items: next, fetchedAt: fetchedAt.current })); } catch { /* */ }
      } else if (res.ok) { setItems([]); setStatus('idle'); }
      else { setItems([]); setStatus('error'); }
    } catch { setStatus('error'); }
  }, [win.id]);

  // Fetch when config changes or the cache is older than the interval.
  useEffect(() => {
    if (!win.q.trim()) return;
    let cached: CacheEntry | null = null;
    try { const raw = localStorage.getItem(cacheKey(win.id)); if (raw) cached = JSON.parse(raw) as CacheEntry; } catch { /* */ }
    const changed = !cached || cached.q !== win.q || cached.country !== win.country;
    const aged = win.intervalH > 0 && (!cached || Date.now() - cached.fetchedAt >= win.intervalH * 3600_000);
    if (changed || aged) void fetchNews(win.q, win.country);
    else if (cached) { setItems(cached.items); fetchedAt.current = cached.fetchedAt; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win.q, win.country, win.intervalH]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    const q = draft.q.trim();
    onChange({ q, country: draft.country, intervalH: draft.intervalH });
    if (q) setShowSettings(false);
  }

  const inputStyle: React.CSSProperties = { backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' };
  const controlsVisible = inline || hover;
  const hoverCtrl: React.CSSProperties = { opacity: controlsVisible ? 1 : 0, pointerEvents: controlsVisible ? 'auto' : 'none', transition: 'opacity .15s ease' };

  const body = (
    <>
      <div className="flex items-center gap-1 px-3 pt-3">
        <Newspaper className="h-4 w-4 shrink-0 text-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{win.q.trim() || t('news.title')}</span>
        {win.q.trim() && (
          <button type="button" data-no-drag aria-label={t('news.refresh')} title={t('news.refresh')}
            onClick={() => void fetchNews(win.q, win.country)} style={hoverCtrl}
            className="grid h-6 w-6 shrink-0 place-items-center rounded transition-colors hover:bg-black/10">
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${status === 'loading' ? 'animate-spin' : ''}`} />
          </button>
        )}
        <button type="button" data-no-drag aria-label={t('news.settings')} title={t('news.settings')}
          aria-pressed={showSettings} onClick={() => { setDraft({ q: win.q, country: win.country, intervalH: win.intervalH }); setShowSettings((v) => !v); }} style={hoverCtrl}
          className="grid h-6 w-6 shrink-0 place-items-center rounded transition-colors hover:bg-black/10">
          <Settings className={`h-3.5 w-3.5 ${showSettings ? 'text-foreground' : 'text-muted-foreground'}`} />
        </button>
        {canAdd && (
          <button type="button" data-no-drag aria-label={t('news.addWindow')} title={t('news.addWindow')}
            onClick={onAdd} style={hoverCtrl}
            className="grid h-6 w-6 shrink-0 place-items-center rounded transition-colors hover:bg-black/10">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <button type="button" data-no-drag aria-label={t('common.cancel')} onClick={onRemove} style={hoverCtrl}
          className="grid h-6 w-6 shrink-0 place-items-center rounded transition-colors hover:bg-black/10">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Config: country + ONE keyword + refresh interval. */}
      {showSettings && (
        <form data-no-drag onSubmit={applySearch} className="flex flex-col gap-1.5 px-3 pb-1 pt-2">
          <div className="flex items-center gap-1.5">
            <select value={draft.country} onChange={(e) => setDraft((d) => ({ ...d, country: e.target.value }))}
              aria-label={t('news.country')} className="min-w-0 flex-1 rounded-md px-1.5 py-1.5 text-xs" style={inputStyle}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{countryName(c)}</option>)}
            </select>
            <select value={draft.intervalH} onChange={(e) => setDraft((d) => ({ ...d, intervalH: Number(e.target.value) }))}
              aria-label={t('news.interval')} title={t('news.interval')} className="shrink-0 rounded-md px-1.5 py-1.5 text-xs" style={inputStyle}>
              {INTERVALS.map((iv) => <option key={iv.h} value={iv.h}>{iv.label === 'manual' ? t('news.intManual') : iv.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <input type="text" value={draft.q} onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
              placeholder={t('news.keyword')} aria-label={t('news.keyword')}
              className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-sm" style={inputStyle} />
            <button type="submit" aria-label={t('news.search')} title={t('news.search')}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors hover:bg-black/10" style={inputStyle}>
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}

      {/* Headlines — single-line marquee titles, no scrollbar. */}
      <div className="px-1.5 pb-2 pt-1">
        {!win.q.trim() ? (
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
                <a data-no-drag href={it.link} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-black/[0.06]">
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

  if (inline) {
    return <section data-news-card="1" className="mt-4 w-full max-w-full overflow-hidden rounded-xl border border-border bg-surface">{body}</section>;
  }
  return (
    <div
      data-news-card="1"
      onPointerDown={makeDragStart(win.pos, (p) => onChange({ pos: p }))}
      onPointerMove={() => { if (!hover) setHover(true); }}
      onPointerLeave={() => setHover(false)}
      className="fixed z-30 w-[300px] cursor-grab touch-none overflow-hidden rounded-xl active:cursor-grabbing"
      style={{
        ...anchoredStyle(win.pos.x, win.pos.y),
        backgroundColor: hover ? 'hsl(var(--surface) / 0.92)' : 'transparent',
        border: `1px solid ${hover ? 'hsl(var(--border))' : 'transparent'}`,
        boxShadow: hover ? '0 20px 25px -5px rgb(0 0 0 / 0.14), 0 8px 10px -6px rgb(0 0 0 / 0.12)' : 'none',
        transition: 'background-color 120ms ease',
      }}
    >
      {body}
    </div>
  );
}

/** A single-line headline that, on hover, scrolls left to reveal the part cut
 *  off by the ellipsis (marquee), then eases back on leave. */
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

/**
 * Keyword news. Up to MAX_NEWS_WINDOWS floating windows, ONE keyword each, with
 * their own country/interval/cache/position (per-resolution remembered). The
 * fixed FAB toggles all windows (newsOpen pref, so the design magician can flip
 * it); each window's + adds another, ✕ removes it. Mobile renders the windows
 * as stacked bottom sections. NO AI tokens — server-side Bing RSS via /api/news.
 */
export function NewsWidget({ isMobile = false }: { isMobile?: boolean }) {
  const { t } = useTranslation();
  const { prefs, setPreference } = usePreferences();
  const open = prefs.newsOpen;
  const [windows, setWindows] = useState<NewsWindow[]>(loadWindows);
  useEffect(() => { saveWindows(windows); }, [windows]);

  // The pref can be flipped on from OUTSIDE this widget (design magician) —
  // if it opens with no window yet, create the first one so the toggle is
  // visibly doing something.
  useEffect(() => {
    if (open && !isMobile) setWindows((ws) => (ws.length === 0 ? [newWindow(0)] : ws));
  }, [open, isMobile]);

  const patchWindow = (id: string, patch: Partial<NewsWindow>) =>
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const addWindow = () => setWindows((ws) => (ws.length >= MAX_NEWS_WINDOWS ? ws : [...ws, newWindow(ws.length)]));
  const removeWindow = (id: string) => setWindows((ws) => ws.filter((w) => w.id !== id));

  const toggleOpen = () => {
    if (!open && windows.length === 0) setWindows([newWindow(0)]);
    setPreference('newsOpen', !open);
  };

  if (isMobile) {
    if (!open && windows.every((w) => !w.q.trim())) return null;
    return (
      <>
        {windows.map((w) => (
          <NewsCard key={w.id} win={w} inline canAdd={windows.length < MAX_NEWS_WINDOWS}
            onChange={(p) => patchWindow(w.id, p)} onAdd={addWindow} onRemove={() => removeWindow(w.id)} />
        ))}
        {windows.length === 0 && null}
      </>
    );
  }

  return (
    <>
      {open && windows.map((w) => (
        <NewsCard key={w.id} win={w} inline={false} canAdd={windows.length < MAX_NEWS_WINDOWS}
          onChange={(p) => patchWindow(w.id, p)} onAdd={addWindow} onRemove={() => removeWindow(w.id)} />
      ))}

      <button
        type="button"
        onClick={toggleOpen}
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
