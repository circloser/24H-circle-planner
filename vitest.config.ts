import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
    coverage: { include: ['src/lib/**'], thresholds: { lines: 60 } },
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
