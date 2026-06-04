import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  define: {
    // Flag consumed by main.tsx to switch on runtime font injection.
    // Static string so the if-branch is dead-code-eliminated in the normal build.
    'import.meta.env.VITE_SINGLEFILE': JSON.stringify('true'),
  },
  build: {
    outDir: 'dist-single',
    // Inline ALL assets (fonts, images) as data: URIs — needed for file:// access.
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // viteSingleFile requires all dynamic imports to be collapsed into one chunk.
        inlineDynamicImports: true,
      },
    },
  },
});
