/**
 * The 디자인 menu asking the life page for something — decorating with a given
 * tool. The page may not be on screen yet, so the request waits here until it
 * is (the same handover the calendar uses).
 */
import type { DecorTool } from '@/components/Calendar/decor-tools';

export const LIFE_REQUEST_EVENT = '24h:life-request';

let pending: { tool: DecorTool } | null = null;

export function requestLifeDecor(tool: DecorTool): void {
  pending = { tool };
  try {
    window.dispatchEvent(new Event(LIFE_REQUEST_EVENT));
  } catch {
    /* non-browser — the page reads it on mount */
  }
}

/** Take the waiting request, if any (read once). */
export function takeLifeRequest(): { tool: DecorTool } | null {
  const req = pending;
  pending = null;
  return req;
}
