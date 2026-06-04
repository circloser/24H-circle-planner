// Tailwind v4.x — using @tailwindcss/vite plugin (replaces PostCSS in v4).
// No postcss.config.js needed; @tailwindcss/vite handles everything.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Explicitly false in the normal build — dead-code-eliminates the single-file
    // font-injection branch in main.tsx so fonts.ts stays out of the web main chunk.
    'import.meta.env.VITE_SINGLEFILE': JSON.stringify('false'),
  },
});
