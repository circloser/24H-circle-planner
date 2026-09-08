import { track } from './track';
import { APP_STORAGE_PREFIX } from './backup';

type Phase = 'idle' | 'saving' | 'saved' | 'failed';
type Entry = { value: unknown; phase: Phase; timer?: ReturnType<typeof setTimeout> };
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
export function getPersistenceStatus(): Phase {
  const states = [...entries.values()].map((entry) => entry.phase);
  if (states.includes('failed')) return 'failed';
  if (states.includes('saving')) return 'saving';
  return states.length ? 'saved' : 'idle';
}
export function subscribePersistence(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function notify() { listeners.forEach((listener) => listener()); }
function write(key: string, entry: Entry) {
  // A replaced debounce must never report success for a newer edit.
  if (entries.get(key) !== entry) return;
  entry.timer = undefined;
  try {
    localStorage.setItem(key, JSON.stringify(entry.value));
    entry.phase = 'saved';
  } catch {
    entry.phase = 'failed';
  }
  track(entry.phase === 'saved' ? 'local_save_success' : 'local_save_failure', { storage: key });
  notify();
}
export function persistLocal(key: string, value: unknown, delay = 0) {
  const previous = entries.get(key);
  if (previous?.timer) clearTimeout(previous.timer);
  const entry: Entry = { value, phase: 'saving' };
  entries.set(key, entry);
  notify();
  if (delay) entry.timer = setTimeout(() => write(key, entry), delay);
  else write(key, entry);
}
export function retryPersistence() {
  for (const [key, entry] of entries) {
    if (entry.timer) clearTimeout(entry.timer);
    write(key, entry);
  }
}
/** Includes in-memory changes even when localStorage is unavailable. */
export function createPersistenceBackup() {
  const data: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(APP_STORAGE_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value !== null) data[key] = value;
      }
    }
  } catch {
    // Browser restrictions can prevent reads too; retain the live plans below.
  }
  for (const [key, entry] of entries) {
    if (key.startsWith(APP_STORAGE_PREFIX)) data[key] = JSON.stringify(entry.value);
  }
  return JSON.stringify({ app: '24h-circle-planner', version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
}
