import { useEffect, useRef, useState } from 'react';
import { Images, X, Plus } from 'lucide-react';
import { useTranslation } from '@/hooks/usePreferences';
import { makeDragStart, anchoredStyle, spawnNearCentre, clampOffset, loadPosProfile, savePosProfile, type Pos } from '@/components/ClockTools/clock-utils';

/**
 * A polaroid photo wall — photos live ONLY on this device (IndexedDB; nothing
 * is ever uploaded, so it costs zero server storage). Each photo renders as a
 * draggable polaroid frame with an editable caption and a slight random tilt.
 */

const OPEN_KEY = '24h-polaroid.open';
const DB_NAME = '24h-polaroid';
const STORE = 'photos';
const MAX_PHOTOS = 12;
const MAX_EDGE = 720; // longest image edge kept (px) — keeps IndexedDB light

interface Photo { id: string; dataUrl: string; caption: string; pos: Pos; rot: number; createdAt: number }

const uid = () => Math.random().toString(36).slice(2, 9);

// ── Tiny IndexedDB helpers (no library) ──────────────────────────────────────
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbGetAll(): Promise<Photo[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as Photo[]) ?? []);
      req.onerror = () => resolve([]);
    });
  } catch { return []; }
}
async function dbPut(p: Photo): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(p);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* storage unavailable */ }
}
async function dbDelete(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* */ }
}

/** Downscale to MAX_EDGE and re-encode as JPEG so photos stay small locally. */
function shrinkImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); resolve(null); return; }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function PolaroidCard({ photo, onChange, onRemove }: { photo: Photo; onChange: (patch: Partial<Photo>) => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(false);
  return (
    <div
      onPointerDown={makeDragStart(photo.pos, (p) => onChange({ pos: p }))}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      className="fixed z-[28] w-[168px] cursor-grab touch-none select-none active:cursor-grabbing"
      style={{
        ...anchoredStyle(photo.pos.x, photo.pos.y),
        transform: `rotate(${photo.rot}deg)`,
        transition: 'box-shadow .15s ease',
      }}
    >
      <div
        className="rounded-sm bg-white p-2 pb-1"
        style={{ boxShadow: hover ? '0 14px 30px rgba(0,0,0,0.3)' : '0 6px 16px rgba(0,0,0,0.22)', border: '1px solid rgba(0,0,0,0.06)' }}
      >
        <img src={photo.dataUrl} alt={photo.caption || 'photo'} draggable={false}
          className="pointer-events-none h-[150px] w-[152px] rounded-[1px] object-cover" />
        <input
          data-no-drag
          type="text"
          value={photo.caption}
          onChange={(e) => onChange({ caption: e.target.value })}
          placeholder={t('polaroid.caption')}
          aria-label={t('polaroid.caption')}
          className="mt-1 w-full bg-transparent text-center text-[12px] outline-none"
          style={{ color: '#3a3a3a', fontFamily: "'Gaegu','Comic Sans MS',cursive" }}
        />
        <button
          type="button"
          data-no-drag
          onClick={onRemove}
          aria-label={t('polaroid.delete')}
          className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-border bg-surface text-muted-foreground shadow transition-opacity"
          style={{ opacity: hover ? 1 : 0, pointerEvents: hover ? 'auto' : 'none' }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function PolaroidAlbum() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<boolean>(() => { try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; } });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* */ } }, [open]);

  // Load photos once; apply per-resolution position profiles.
  useEffect(() => {
    void dbGetAll().then((list) => {
      setPhotos(list
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((p) => ({ ...p, pos: loadPosProfile(`pol.${p.id}`) ?? clampOffset(p.pos, 168, 210) })));
    });
  }, []);

  const patch = (id: string, patchObj: Partial<Photo>) => {
    setPhotos((ps) => ps.map((p) => {
      if (p.id !== id) return p;
      const next = { ...p, ...patchObj };
      void dbPut(next);
      if (patchObj.pos) savePosProfile(`pol.${id}`, patchObj.pos);
      return next;
    }));
  };
  const remove = (id: string) => { setPhotos((ps) => ps.filter((p) => p.id !== id)); void dbDelete(id); };

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const list = [...files].slice(0, Math.max(0, room));
    const added: Photo[] = [];
    for (let i = 0; i < list.length; i++) {
      const dataUrl = await shrinkImage(list[i]);
      if (!dataUrl) continue;
      const photo: Photo = {
        id: uid(), dataUrl, caption: '', createdAt: Date.now() + i,
        pos: spawnNearCentre(300 + ((photos.length + i) % 3) * 60, -120 + ((photos.length + i) % 4) * 70, 168, 210),
        rot: Math.round((Math.random() * 8 - 4) * 10) / 10,
      };
      added.push(photo);
      void dbPut(photo);
    }
    if (added.length) { setPhotos((ps) => [...ps, ...added]); setOpen(true); }
  }

  return (
    <>
      {open && photos.map((p) => (
        <PolaroidCard key={p.id} photo={p} onChange={(pt) => patch(p.id, pt)} onRemove={() => remove(p.id)} />
      ))}

      {/* Hidden picker — photos never leave the device (IndexedDB only). */}
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }} />

      {/* Add button rides above the album FAB while the album is open. */}
      {open && photos.length < MAX_PHOTOS && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label={t('polaroid.add')}
          title={t('polaroid.add')}
          className="fixed bottom-[76px] right-[182px] z-30 grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-muted-foreground shadow-md transition-transform hover:scale-105"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}

      <button
        type="button"
        onClick={() => { if (!open && photos.length === 0) fileRef.current?.click(); else setOpen((v) => !v); }}
        aria-label={t('polaroid.open')}
        aria-expanded={open}
        title={t('polaroid.open')}
        className="fixed bottom-5 right-[182px] z-30 grid h-12 w-12 place-items-center rounded-full shadow-lg transition-transform hover:scale-105 bg-surface text-muted-foreground border border-border"
      >
        <Images className="h-5 w-5" />
      </button>
    </>
  );
}
