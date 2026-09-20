/**
 * Operator alerts that survive a dead database.
 *
 * The admin push notifications (notifyAdmins) read the devices out of D1, so
 * they say nothing in exactly the outage that matters most — the one where D1
 * is the thing that is down (see the 2026-09-19 incident, where sync and
 * sign-in were broken for hours before anyone noticed). This posts a line to
 * ALERT_WEBHOOK instead: a Slack, Discord or any other URL that takes JSON.
 * Unset, it only writes to the log, so nothing depends on it.
 *
 * Alerts repeat at most every ALERT_EVERY_MS per kind, so a database that is
 * down all afternoon is one message, not three hundred. The "back again" line
 * is sent as soon as the same kind recovers.
 */

/** How often the same kind of trouble may speak up. */
export const ALERT_EVERY_MS = 30 * 60_000;

export interface AlertState {
  /** kind → when it was last reported. */
  sent: Map<string, number>;
  /** Kinds currently in trouble (for the recovery line). */
  bad: Set<string>;
}

export const newAlertState = (): AlertState => ({ sent: new Map(), bad: new Set() });

/** Should this trouble be reported now? Marks it as reported when it should. */
export function shouldAlert(state: AlertState, kind: string, now: number, everyMs = ALERT_EVERY_MS): boolean {
  const last = state.sent.get(kind);
  state.bad.add(kind);
  // Never reported before → say it now, whatever the clock reads.
  if (last !== undefined && now - last < everyMs) return false;
  state.sent.set(kind, now);
  return true;
}

/** Should a "back again" line be sent — i.e. was this kind in trouble? */
export function shouldClear(state: AlertState, kind: string): boolean {
  if (!state.bad.has(kind)) return false;
  state.bad.delete(kind);
  state.sent.delete(kind);
  return true;
}

/** The shape every common webhook understands: Slack reads `text`, Discord
 *  `content`; anything else gets both. */
export const alertBody = (text: string): string => JSON.stringify({ text, content: text });

export async function postAlert(webhook: string | undefined, text: string): Promise<boolean> {
  if (!webhook) return false;
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: alertBody(text),
    });
    return res.ok;
  } catch {
    return false; // an alert that cannot be sent must never break the caller
  }
}

/** Module-global state: one isolate reports at most once per window. A new
 *  isolate may repeat a line — better twice than never. */
const state = newAlertState();

/** Report trouble (throttled per kind). `env.ALERT_WEBHOOK` carries it out. */
export function alertOps(env: { ALERT_WEBHOOK?: string }, kind: string, text: string, now = Date.now()): Promise<boolean> {
  console.error(`[ops] ${kind}: ${text}`);
  if (!shouldAlert(state, kind, now)) return Promise.resolve(false);
  return postAlert(env.ALERT_WEBHOOK, `🚨 24Houring — ${text}`);
}

/** Report that a kind of trouble is over (only if it was reported). */
export function clearOps(env: { ALERT_WEBHOOK?: string }, kind: string, text: string): Promise<boolean> {
  if (!shouldClear(state, kind)) return Promise.resolve(false);
  console.log(`[ops] ${kind}: recovered`);
  return postAlert(env.ALERT_WEBHOOK, `✅ 24Houring — ${text}`);
}
