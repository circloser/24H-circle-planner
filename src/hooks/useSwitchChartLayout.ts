import { useCallback } from 'react';
import { usePreferences } from '@/hooks/usePreferences';
import { useMemos } from '@/hooks/useMemos';
import { relocateSlot, loadPosProfile, savePosProfile, type MarginSlot, type Pos } from '@/components/ClockTools/clock-utils';
import { CLOCKTOOLS_SYNC_EVENT, NEWS_SYNC_EVENT, NEWS_WINDOWS_KEY } from '@/lib/sync/widgetSync';
import { isChartLayout, type ChartLayout } from '@/lib/chart-layout';

const CLOCKTOOLS_KEY = '24h-circle-planner.clocktools';

interface Placed { id?: string; pos?: Pos }
interface ClockToolsEnvelope { state?: { clocks?: Placed[]; calendar?: Placed; weathers?: Placed[] } }

/** Move one widget if it still sits on its margin spot. Judged by where THIS
 *  screen shows it — a per-resolution position profile wins over the stored
 *  value when the widget loads — and both are updated, or the profile would
 *  put the widget straight back on the old spot. */
function move(item: Placed | undefined, slot: MarginSlot, profileKey: string, from: ChartLayout, to: ChartLayout): number {
  if (!item?.pos) return 0;
  const next = relocateSlot(loadPosProfile(profileKey) ?? item.pos, slot, from, to);
  if (!next) return 0;
  item.pos = next;
  savePosProfile(profileKey, next);
  return 1;
}

/** Moves the magician's clock, calendar and weather inside a saved clock-tools
 *  envelope (in place). Returns how many moved. */
export function relocateClockToolsEnvelope(env: ClockToolsEnvelope, from: ChartLayout, to: ChartLayout): number {
  const s = env?.state;
  if (!s) return 0;
  const clock = s.clocks?.[0];
  const weather = s.weathers?.[0];
  return move(clock, 'clock', `ct.clock.${clock?.id}`, from, to)
    + move(s.calendar, 'calendar', 'ct.calendar', from, to)
    + move(weather, 'weather', `ct.weather.${weather?.id}`, from, to);
}

/** Same for the first news window (the news toggle's home spot). */
export function relocateNewsWindows(list: Placed[], from: ChartLayout, to: ChartLayout): number {
  return Array.isArray(list) ? move(list[0], 'news', `news.${list[0]?.id}`, from, to) : 0;
}

/** Rewrite a saved widget store, then nudge its live instances to adopt it —
 *  the same path cloud sync uses, so no second copy of the state can go stale. */
function rewriteStored(key: string, event: string, relocate: (value: never) => number): void {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const value = JSON.parse(raw) as never;
    if (relocate(value) === 0) return;
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(event));
  } catch { /* unreadable store: widgets simply stay where they are */ }
}

/** Set the chart layout, moving widgets the magician placed in the margins out
 *  of the chart's way when it lands on their side (Settings and the magician
 *  share this). Widgets the user dragged somewhere else are left alone. */
export function useSwitchChartLayout(): (next: ChartLayout) => void {
  const { prefs, setPreference } = usePreferences();
  const { memos, updateMemo } = useMemos();
  const current = prefs.chartLayout;

  return useCallback((next: ChartLayout) => {
    const from: ChartLayout = isChartLayout(current) ? current : 'center';
    setPreference('chartLayout', next);
    if (from === next) return;

    for (const m of memos) {
      if (!m.onScreen) continue;
      const to = relocateSlot({ x: m.x, y: m.y }, 'memo', from, next);
      if (to) updateMemo(m.id, to);
    }
    rewriteStored(CLOCKTOOLS_KEY, CLOCKTOOLS_SYNC_EVENT, (env: ClockToolsEnvelope) => relocateClockToolsEnvelope(env, from, next));
    rewriteStored(NEWS_WINDOWS_KEY, NEWS_SYNC_EVENT, (list: Placed[]) => relocateNewsWindows(list, from, next));
  }, [current, setPreference, memos, updateMemo]);
}
