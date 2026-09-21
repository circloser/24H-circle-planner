/**
 * Google Analytics (GA4) for the app — loaded only where it may be.
 *
 * - Only on the live site (https://24houring.com), never local builds,
 *   previews or the offline file.
 * - Visitors from the EEA, the UK and Switzerland get nothing until they turn
 *   it on themselves (⚙ → 사용 통계); everyone else gets it unless they turn
 *   it off. The Worker tells us which applies (/api/geo, from Cloudflare's
 *   country), and an unknown country counts as "ask first".
 * - Advertising signals are denied everywhere; the page address is sent
 *   without its fragment and with only campaign parameters in the query, so
 *   share codes (#d=, #p=) and sign-in/checkout returns never reach Google.
 *
 * track() hands events to gaEvent(); events that arrive before the decision
 * wait in a short queue and are dropped if GA does not start.
 */
export const GA_ID = 'G-2YQFP0PTLZ';
export const GA_CHOICE_KEY = '24h-ga-choice';
const GEO_KEY = '24h-geo';
const LIVE_HOST = /^(www\.)?24houring\.com$/;
const CAMPAIGN = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const MAX_QUEUE = 50;

type Params = Record<string, string | number | boolean>;
type Gtag = (...args: unknown[]) => void;
type State = 'pending' | 'on' | 'off';

let state: State = 'pending';
let loaded = false;
let queue: Array<[string, Params | undefined]> = [];
const listeners = new Set<() => void>();

export type GaChoice = 'granted' | 'denied' | null;

export function gaChoice(): GaChoice {
  try {
    const v = localStorage.getItem(GA_CHOICE_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

/** Is this the live site? */
export function isLiveSite(loc: Pick<Location, 'protocol' | 'hostname'> = location): boolean {
  return loc.protocol === 'https:' && LIVE_HOST.test(loc.hostname);
}

/** The page address GA may see. */
export function safePageLocation(href: string): string {
  const u = new URL(href);
  const out = new URL(u.origin + u.pathname);
  for (const k of CAMPAIGN) {
    const v = u.searchParams.get(k);
    if (v && /^[\w.-]{1,40}$/.test(v)) out.searchParams.set(k, v);
  }
  return out.href;
}

/** Should GA run, given the stored choice and whether the region asks first? */
export function gaWanted(choice: GaChoice, consentRequired: boolean): boolean {
  if (choice) return choice === 'granted';
  return !consentRequired;
}

async function consentRequired(): Promise<boolean> {
  try {
    const cached = sessionStorage.getItem(GEO_KEY);
    if (cached === '0' || cached === '1') return cached === '1';
  } catch { /* no session storage */ }
  try {
    const res = await fetch('/api/geo', { credentials: 'omit' });
    const body = (await res.json()) as { consentRequired?: unknown };
    const required = body.consentRequired !== false;
    try { sessionStorage.setItem(GEO_KEY, required ? '1' : '0'); } catch { /* ignore */ }
    return required;
  } catch {
    return true; // not knowing where someone is means asking first
  }
}

function gtag(): Gtag {
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: Gtag };
  w.dataLayer = w.dataLayer || [];
  if (typeof w.gtag !== 'function') {
    // The standard stub: gtag.js reads the `arguments` objects from dataLayer.
    w.gtag = function gtagStub() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
  }
  return w.gtag;
}

function load(): void {
  if (loaded) return;
  loaded = true;
  const g = gtag();
  g('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  });
  g('js', new Date());
  g('config', GA_ID, {
    page_location: safePageLocation(location.href),
    page_referrer: document.referrer ? safePageLocation(document.referrer) : '',
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
}

function settle(next: State): void {
  state = next;
  const waiting = queue;
  queue = [];
  if (next === 'on') for (const [event, params] of waiting) gtag()('event', event, params);
  for (const l of listeners) l();
}

/** Decide once per page load whether GA runs, and start it if so. */
export async function startAnalytics(): Promise<boolean> {
  if (state !== 'pending') return state === 'on';
  if (!isLiveSite()) {
    settle('off');
    return false;
  }
  const choice = gaChoice();
  const required = choice ? false : await consentRequired();
  // The visitor may have chosen in ⚙ while we were asking where they are.
  if (state !== 'pending') return state === 'on';
  const wanted = gaWanted(choice, required);
  if (wanted) load();
  settle(wanted ? 'on' : 'off');
  return wanted;
}

/**
 * A page of the app, as GA understands pages.
 *
 * The app is one document: the timetable, the calendar, the life line and the
 * maps are views inside it, so without this GA sees a single page_view and can
 * say nothing about which of them anybody uses. The address is made here from
 * the view's own name rather than taken from the bar — the bar may be holding
 * a share code, and those never go to Google.
 */
export function gaView(view: string): void {
  const path = `/app/${view}`;
  gaEvent('page_view', {
    page_title: `24Houring · ${view}`,
    page_location: `${location.origin}${path}`,
    page_path: path,
  });
}

/** Send an event to GA (queued until the decision, dropped when off). */
export function gaEvent(event: string, params?: Params): void {
  if (state === 'on') gtag()('event', event, params);
  else if (state === 'pending' && queue.length < MAX_QUEUE) queue.push([event, params]);
}

/** Whether GA is running on this page. */
export const gaActive = (): boolean => state === 'on';

export function onGaChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The visitor's own choice (⚙ → 사용 통계). Turning it off stops collection
 *  at once; turning it on starts it now. */
export function setGaChoice(on: boolean): void {
  try { localStorage.setItem(GA_CHOICE_KEY, on ? 'granted' : 'denied'); } catch { /* ignore */ }
  const w = window as unknown as Record<string, unknown>;
  w[`ga-disable-${GA_ID}`] = !on;
  if (!on) {
    if (state === 'on') gtag()('consent', 'update', { analytics_storage: 'denied' });
    settle('off');
    return;
  }
  if (!isLiveSite()) return;
  if (loaded) gtag()('consent', 'update', { analytics_storage: 'granted' });
  else load();
  if (state !== 'on') settle('on');
}
