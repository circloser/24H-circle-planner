import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { ScheduleStoreProvider } from './hooks/useScheduleStore.tsx'
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
}

const isSpike = new URLSearchParams(window.location.search).get('spike') === '1';
const root = createRoot(document.getElementById('root')!);

if (isSpike) {
  root.render(
    <StrictMode>
      <ScheduleStoreProvider>
        <SpikeRunner />
        <Toaster />
      </ScheduleStoreProvider>
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <ScheduleStoreProvider>
        <App />
        <Toaster />
      </ScheduleStoreProvider>
    </StrictMode>,
  );
}
