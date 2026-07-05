/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/hooks/usePreferences';
import { collectSyncData, applySyncData, dataFingerprint, changedSyncKeys, LIVE_APPLY_KEYS, PREFS_KEY, PREFS_SYNC_EVENT, VIEW_KEY, VIEW_SYNC_EVENT, type SyncEnvelope } from '@/lib/sync/syncData';
import { pullRemote, pushRemote, deviceLabel } from '@/lib/sync/syncClient';
import { loadCachedKey, forgetKey, E2EE_EVENT, E2EE_REPUSH_EVENT, E2EE_DISABLE_EVENT } from '@/lib/sync/e2ee';

// 'locked' = the cloud copy is E2EE ciphertext and this device has no key yet;
// the engine pauses (no push/pull would clobber it) until the passphrase unlocks.
export type SyncStatus = 'disabled' | 'syncing' | 'synced' | 'offline' | 'error' | 'locked';

interface SyncContextValue {
  status: SyncStatus;
  lastSyncedAt: number | null;
}

const SyncContext = createContext<SyncContextValue>({ status: 'disabled', lastSyncedAt: null });
export const useSyncStatus = (): SyncContextValue => useContext(SyncContext);

const META_KEY = '24h-circle-planner.syncmeta';
const PREV_KEY = '24h-circle-planner.sync-prev';
const APPLIED_KEY = '24h-circle-planner.sync-applied';

const PUSH_DEBOUNCE_MS = 1500;
const TICK_MS = 2000;
const PULL_EVERY_TICKS = 8; // ~16s background pull

interface SyncMeta {
  version: number;
  baseFp: string; // fingerprint of the data we're in sync with
  modifiedAt: number; // content modification time for LWW
}

function loadMeta(): SyncMeta {
  try {
    const o = JSON.parse(localStorage.getItem(META_KEY) ?? '') as Partial<SyncMeta>;
    if (o && typeof o.version === 'number') {
      return { version: o.version, baseFp: String(o.baseFp ?? ''), modifiedAt: Number(o.modifiedAt) || 0 };
    }
  } catch {
    /* ignore */
  }
  return { version: 0, baseFp: '', modifiedAt: 0 };
}

function saveMeta(m: SyncMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

/** Undo a cloud apply: restore the stashed local snapshot and mark it dirty +
 * newest so the engine re-pushes it as authoritative, then reload. */
function restorePrevious(): void {
  try {
    const prev = localStorage.getItem(PREV_KEY);
    if (!prev) return;
    applySyncData(JSON.parse(prev) as Record<string, string>);
    const m = loadMeta();
    saveMeta({ version: m.version, baseFp: '', modifiedAt: Date.now() });
    localStorage.removeItem(PREV_KEY);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

/**
 * Pro cross-device sync engine. Mirrors the synced content keys to the Worker
 * (`/api/sync`) with version-based last-write-wins. No-ops when signed out, so
 * the app is fully usable without an account.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { user, plan } = useAuth();
  // Cloud sync is a Pro feature (includes the free trial, which reports as 'pro').
  const pro = plan === 'pro';
  const { t } = useTranslation();
  // Latest translator, read from inside the long-lived [user] sync effect without
  // making that effect depend on (and re-subscribe on) every language change.
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);
  const [status, setStatus] = useState<SyncStatus>('disabled');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  // After a cloud apply we reload; surface a one-time toast (with undo) here.
  useEffect(() => {
    if (localStorage.getItem(APPLIED_KEY) !== '1') return;
    localStorage.removeItem(APPLIED_KEY);
    toast.success(t('sync.appliedFromCloud'), {
      action: { label: t('sync.undo'), onClick: () => restorePrevious() },
      duration: 8000,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user || !pro) return; // signed out / free → engine idle; status derived as 'disabled' below

    let stopped = false;
    let pushTimer: ReturnType<typeof setTimeout> | null = null;
    let busy = false;
    let locked = false; // set when the cloud is E2EE ciphertext we can't read yet
    let ready = false; // a first pull has round-tripped — until then, NEVER push
    let lastObserved = '';
    const meta = loadMeta();
    const setMeta = (m: SyncMeta) => {
      meta.version = m.version;
      meta.baseFp = m.baseFp;
      meta.modifiedAt = m.modifiedAt;
      saveMeta(meta);
    };
    const stat = (s: SyncStatus) => {
      if (!stopped) setStatus(s);
    };
    const currentFp = () => dataFingerprint(collectSyncData());

    // Adopt the cloud snapshot: stash local for undo, write content, reload.
    const applyRemote = (env: SyncEnvelope, version: number) => {
      const before = collectSyncData();
      const changed = changedSyncKeys(before, env.data);
      try {
        localStorage.setItem(PREV_KEY, JSON.stringify(before));
      } catch {
        /* ignore */
      }
      applySyncData(env.data);
      setMeta({ version, baseFp: dataFingerprint(env.data), modifiedAt: env.modifiedAt });

      // Nothing actually differs (canonically) → just mark synced, never reload.
      if (changed.length === 0) {
        setLastSyncedAt(Date.now());
        stat('synced');
        return;
      }
      // A change touching ONLY live-appliable keys (prefs, diary view) is applied
      // in place; anything else (days/diary/…) still reloads to re-hydrate stores.
      if (changed.every((k) => LIVE_APPLY_KEYS.includes(k))) {
        if (changed.includes(PREFS_KEY)) window.dispatchEvent(new Event(PREFS_SYNC_EVENT));
        if (changed.includes(VIEW_KEY)) window.dispatchEvent(new Event(VIEW_SYNC_EVENT));
        setLastSyncedAt(Date.now());
        stat('synced');
        // Toast only for a settings change; a diary-view follow is self-evident.
        if (changed.includes(PREFS_KEY)) {
          toast.success(tRef.current('sync.appliedFromCloud'), {
            action: { label: tRef.current('sync.undo'), onClick: () => restorePrevious() },
            duration: 8000,
          });
        }
        return;
      }
      try {
        localStorage.setItem(APPLIED_KEY, '1');
      } catch {
        /* ignore */
      }
      window.location.reload();
    };

    const doPush = async (baseVersion: number) => {
      if (stopped || busy) return;
      busy = true;
      stat('syncing');
      const data = collectSyncData();
      const fp = dataFingerprint(data);
      const env: SyncEnvelope = { v: 1, modifiedAt: meta.modifiedAt || Date.now(), data };
      const r = await pushRemote(env, baseVersion, deviceLabel());
      busy = false;
      if (stopped) return;
      if (r.kind === 'ok') {
        setMeta({ version: r.version, baseFp: fp, modifiedAt: env.modifiedAt });
        setLastSyncedAt(r.updatedAt);
        stat('synced');
      } else if (r.kind === 'conflict') {
        reconcile(r.envelope, r.version);
      } else if (r.kind === 'locked') {
        locked = true;
        stat('locked');
      } else if (r.kind === 'offline') {
        stat('offline');
      } else if (r.kind === 'unauth') {
        stat('disabled');
      } else {
        stat('error');
      }
    };

    // Decide between local and server when they diverge (last-write-wins).
    const reconcile = (serverEnv: SyncEnvelope, serverVersion: number) => {
      if (meta.modifiedAt > serverEnv.modifiedAt) {
        void doPush(serverVersion); // local is newer → overwrite server
      } else {
        applyRemote(serverEnv, serverVersion); // server is newer → adopt
      }
    };

    const pull = async () => {
      if (stopped || busy || !navigatorOnline()) return;
      const r = await pullRemote();
      if (stopped) return;
      // A pull has now round-tripped — pushes are safe from here. Before this,
      // a fresh device with local data must NOT push (it could clobber an
      // encrypted cloud copy it can't read yet with its own plaintext).
      ready = true;
      if (r.kind === 'locked') {
        locked = true;
        return stat('locked');
      }
      if (r.kind === 'empty') {
        const data = collectSyncData();
        if (Object.keys(data).length > 0) {
          if (!meta.modifiedAt) setMeta({ ...meta, modifiedAt: Date.now() });
          void doPush(0); // seed the cloud from this device
        } else {
          stat('synced');
        }
        return;
      }
      if (r.kind === 'offline') return stat('offline');
      if (r.kind === 'unauth') return stat('disabled');
      if (r.kind === 'error') return stat('error');

      const cur = currentFp();
      const serverFp = dataFingerprint(r.envelope.data);
      if (cur === serverFp) {
        setMeta({ version: r.version, baseFp: serverFp, modifiedAt: r.envelope.modifiedAt });
        setLastSyncedAt(r.updatedAt);
        return stat('synced');
      }
      // Content differs from the server.
      const localDirty = cur !== meta.baseFp;
      if (!localDirty) {
        applyRemote(r.envelope, r.version); // no local edits → cloud is authoritative
      } else {
        reconcile(r.envelope, r.version);
      }
    };

    const tick = () => {
      if (stopped || busy || locked || !ready) return; // not-ready/locked → never push (would clobber the cloud)
      if (!navigatorOnline()) {
        stat('offline');
        return;
      }
      const cur = currentFp();
      if (cur !== lastObserved) {
        lastObserved = cur;
        if (cur !== meta.baseFp) setMeta({ ...meta, modifiedAt: Date.now() });
      }
      if (cur !== meta.baseFp) {
        if (pushTimer) clearTimeout(pushTimer);
        stat('syncing');
        pushTimer = setTimeout(() => void doPush(meta.version), PUSH_DEBOUNCE_MS);
      }
    };

    // Kick off — restore this device's cached E2EE key (if any) BEFORE the first
    // pull, so an already-set-up device unlocks silently instead of flashing 'locked'.
    stat('syncing');
    lastObserved = currentFp();
    void loadCachedKey().then(() => { if (!stopped) void pull(); });

    let n = 0;
    const iv = setInterval(() => {
      n += 1;
      tick();
      if (n % PULL_EVERY_TICKS === 0 && !locked) void pull();
    }, TICK_MS);

    const onWake = () => {
      if (document.visibilityState !== 'hidden' && !locked) void pull();
    };
    // Unlocked (or newly enabled) → a key is now available: clear the lock and
    // re-pull so the ciphertext decrypts and the engine resumes.
    const onE2ee = () => {
      locked = false;
      void pull();
    };
    // Enabling encryption doesn't change the DATA (so the fingerprint is
    // unchanged and a normal pull would see "in sync") — force a push so the
    // cloud plaintext is replaced with ciphertext right away.
    const onRepush = () => {
      locked = false;
      void doPush(meta.version);
    };
    // Disable cloud-wide: forget the key SILENTLY (no resume-pull race), then
    // push the current data as plaintext (v1) so other devices read it keyless.
    const onDisable = () => {
      forgetKey(true);
      locked = false;
      void doPush(meta.version);
    };
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    window.addEventListener(E2EE_EVENT, onE2ee);
    window.addEventListener(E2EE_REPUSH_EVENT, onRepush);
    window.addEventListener(E2EE_DISABLE_EVENT, onDisable);
    document.addEventListener('visibilitychange', onWake);

    return () => {
      stopped = true;
      clearInterval(iv);
      if (pushTimer) clearTimeout(pushTimer);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onWake);
      window.removeEventListener(E2EE_EVENT, onE2ee);
      window.removeEventListener(E2EE_REPUSH_EVENT, onRepush);
      window.removeEventListener(E2EE_DISABLE_EVENT, onDisable);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [user, pro]);

  // Signed out or on the free plan → engine idle; always present 'disabled'.
  return <SyncContext.Provider value={{ status: user && pro ? status : 'disabled', lastSyncedAt }}>{children}</SyncContext.Provider>;
}

function navigatorOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}
