import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { ScheduleStoreProvider } from './hooks/useScheduleStore.tsx'
import { PreferencesProvider } from './hooks/usePreferences.tsx'
import { AuthProvider } from './hooks/useAuth.tsx'
import { SyncProvider } from './hooks/useSync.tsx'
import { MemoProvider } from './hooks/useMemos.tsx'
import { UserPresetsProvider } from './hooks/useUserPresets.tsx'
import { DaysProvider } from './hooks/useDays.tsx'
import { DiaryProvider } from './hooks/useDiary.tsx'
import { SpikeRunner } from './components/SpikeRunner.tsx'

// Single-file build: inject base64 fonts at runtime so they work on file://.
// import.meta.env.VITE_SINGLEFILE is statically 'false' in the normal web build,
// so this branch is dead-code-eliminated and fonts.ts is NOT pulled into the web chunk.
if (import.meta.env.VITE_SINGLEFILE === 'true') {
  void import('@/data/fonts').then(({ pretendardRegular, pretendardBold }) => {
    const style = document.createElement('style');
    style.textContent = `
      @font-face { font-family:'Pretendard'; font-weight:400; font-style:normal; font-display:swap; src:url('${pretendardRegular}') format('woff2'); }
      @font-face { font-family:'Pretendard'; font-weight:700; font-style:normal; font-display:swap; src:url('${pretendardBold}') format('woff2'); }
    `;
    document.head.appendChild(style);
  });
  // Also inline the selectable extra fonts for offline use.
  void import('@/data/extra-fonts').then(({ injectExtraFonts }) => injectExtraFonts());
}

const isSpike = new URLSearchParams(window.location.search).get('spike') === '1';
const root = createRoot(document.getElementById('root')!);

// PWA: register the service worker for offline + installability. Production only
// (https) — skips the Vite dev server (http://localhost) and the file:// build.
//
// Self-healing update: check for a new sw.js on every load and, when a freshly
// activated worker takes control of an ALREADY-controlled page, reload once so
// the page runs against the new worker + assets. Without this, a stale worker
// (e.g. one that wrongly cached a route) can survive ordinary reloads.
if (!isSpike && 'serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => reg.update().catch(() => {}))
      .catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // First-install claim (no prior controller) → don't reload. An update to an
      // already-controlled page → reload once to adopt the new worker.
      if (reloaded || !hadController) return;
      reloaded = true;
      window.location.reload();
    });
  });
}

if (isSpike) {
  root.render(
    <StrictMode>
      <PreferencesProvider>
        <ScheduleStoreProvider>
          <SpikeRunner />
          <Toaster />
        </ScheduleStoreProvider>
      </PreferencesProvider>
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <AuthProvider>
        <PreferencesProvider>
          <SyncProvider>
            <ScheduleStoreProvider>
              <DaysProvider>
                <UserPresetsProvider>
                  <MemoProvider>
                    <DiaryProvider>
                      <App />
                    </DiaryProvider>
                  </MemoProvider>
                </UserPresetsProvider>
              </DaysProvider>
              <Toaster />
            </ScheduleStoreProvider>
          </SyncProvider>
        </PreferencesProvider>
      </AuthProvider>
    </StrictMode>,
  );
}
