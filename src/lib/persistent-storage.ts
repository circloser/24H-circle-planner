/**
 * Ask the browser to make this origin's storage "persistent" so it is not
 * evicted automatically when the device is low on space. Best-effort: Chromium
 * grants it heuristically (no prompt), Firefox may prompt, others may not
 * support it. Either way the app keeps working — this only hardens durability.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
