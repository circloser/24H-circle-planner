/**
 * Pictures for the calendar's photo stickers. They stay on THIS device
 * (IndexedDB): a photo is far larger than the whole synced blob may be, so only
 * the sticker (its id and place) syncs, and another device shows an empty
 * frame where the picture would be.
 */
const DB_NAME = '24h-calendar-photos';
const STORE = 'photos';
/** Longest edge kept — a sticker is small, so this is plenty. */
const MAX_EDGE = 480;

interface Row { id: string; dataUrl: string }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export const newPhotoId = (): string => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export async function loadPhoto(id: string): Promise<string | null> {
  const row = await run<Row | undefined>('readonly', (s) => s.get(id) as IDBRequest<Row | undefined>);
  return row?.dataUrl ?? null;
}

export async function savePhoto(id: string, dataUrl: string): Promise<boolean> {
  return (await run('readwrite', (s) => s.put({ id, dataUrl } satisfies Row))) !== null;
}

export async function deletePhoto(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
}

/** Downscale and re-encode as JPEG, so a phone photo becomes a few dozen KB. */
export function shrinkPhoto(file: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
